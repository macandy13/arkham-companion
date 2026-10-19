import type { EngineContext } from './cards';
import { commandSpec, type CommandSpec, type Continuation, type Step } from './command_specs';
import type { Command, DrawEncounter } from './commands';
import { attackOfOpportunityDecisions, isOwnTurnAction } from './attacks_of_opportunity';
import { answerCommands } from './decisions';
import type { Event } from './events';
import {
  canDrawEncounter,
  encounterCardCount,
  placeDrawnCard,
  surgeDraw,
} from './handle_encounter';
import { completeAdvance } from './handle_scenario';
import { nextStepPlan } from './phases';
import { apply } from './reducer';
import { CommandRejected, type Rejection } from './rejection';
import type { GameState, HeldAction, QueuedStep } from './state';
import { MAX_TRIGGERED_COMMANDS, triggeredCommands } from './triggers';

/**
 * Validates a command against the current state and returns the resulting events.
 * Card data comes from `ctx.cards`; whatever a rule reads from it ends up in the
 * events, so `apply` never needs the `CardDb`.
 *
 * The command resolves as a queue of steps (`Step`, `run`). A step's own
 * events come first, then the follow-up commands they trigger
 * (`ctx.scenario.hooks`, `ctx.effects`), then whatever continues the step
 * (`CommandSpec.continueWith`: advancing agenda/act, placing a drawn card,
 * surge, the outstanding phase steps after `NextPhase`). Each follow-up is a
 * step of its own and goes in front of the rest, so a follow-up's chain
 * resolves before the next sibling (depth first). An answer
 * (`ResolveDecision`) is the same: the forced effects of its own events
 * come before the commands of the chosen option, as "after" abilities
 * resolve before a skill test's results (ST.6 before ST.7).
 * A step that raises a decision stops the queue: the rest waits in state
 * (`GameMeta.queue`, `StepsQueued`), and once nothing is pending any command
 * (usually the last answer) goes on with it after its own steps
 * (`StepResumed`). Outstanding phase steps do not wait: the players go on
 * with the next "Next".
 * One player command yields one list of events, which undo (M1.11) removes
 * as a unit. A rejected follow-up or a chain longer than
 * `MAX_TRIGGERED_COMMANDS` rejects the originating command, so a bad hook
 * can neither hang the app nor leave half its effect behind.
 * Which commands are accepted once the scenario has ended or while a
 * decision is pending is up to their `CommandSpec`.
 * A player command that is an action provoking attacks of opportunity
 * (`CommandSpec.provokes`, `attackOfOpportunityDecisions`) yields one
 * decision per attacking enemy and queues the action until all of them are
 * answered; follow-ups never provoke, which is why this happens here and not
 * in `resolveCommand`.
 * Pure: the same state, command and context always yield the same events.
 * Inside, the chain grows one `Resolution`, which never leaves this call.
 */
export function handle(ctx: EngineContext, state: GameState, command: Command): Event[] {
  const spec = commandSpec(command);
  assertAccepted(state, command, spec);
  const provoking = spec.provokes?.(command);
  const action = provoking && isOwnTurnAction(state, provoking) ? provoking : undefined;
  const attacks = action ? attackOfOpportunityDecisions(ctx, state, action) : [];
  if (action && attacks.length > 0) {
    // An illegal action must be rejected before it provokes anything; this
    // dry run gets a resolution of its own that is dropped, the action
    // resolves after the attacks. It stops at the first decision the action's
    // chain asks, like the real run: what follows that answer is checked only
    // when it resolves, and a rejection there rejects the answer.
    run({ ctx, state, events: [] }, [{ kind: 'command', command }], newBudget(), {
      resumesStored: false,
    });
    return [...attacks, { type: 'StepsQueued', steps: [{ kind: 'action', command: action }] }];
  }
  const resolution: Resolution = { ctx, state, events: [] };
  run(resolution, [{ kind: 'command', command }], newBudget(), { resumesStored: true });
  return resolution.events;
}

/**
 * The growing result of one `handle` call: the state so far and the events
 * that led there. The chain appends to it (`emit`) instead of passing
 * states and event lists along and replaying them at every step. It is
 * created by `handle` and never escapes it, so `handle` stays pure.
 */
interface Resolution {
  readonly ctx: EngineContext;
  state: GameState;
  readonly events: Event[];
}

/** Appends `events` to the chain and applies them to its state. */
function emit(resolution: Resolution, events: readonly Event[]): void {
  for (const event of events) {
    resolution.state = apply(resolution.state, event);
    resolution.events.push(event);
  }
}

/** A way back to the chain as it is now: the returned function takes back everything emitted since. */
function checkpoint(resolution: Resolution): () => void {
  const { state } = resolution;
  const length = resolution.events.length;
  return () => {
    resolution.state = state;
    resolution.events.length = length;
  };
}

/**
 * Rejects a command from outside that its spec does not accept now: after
 * the scenario has ended (`allowedAfterEnd`) or while a decision is pending
 * (`allowedWhilePending`). Only checked for commands from outside; the rest
 * of a chain still resolves.
 */
function assertAccepted<C extends Command>(
  state: GameState,
  command: C,
  spec: CommandSpec<C>,
): void {
  if (state.meta.ended && !spec.allowedAfterEnd)
    throw new CommandRejected({ code: 'scenarioEnded', command: command.type });
  const [pending] = state.pending;
  if (pending !== undefined && !spec.allowedWhilePending)
    throw new CommandRejected({ code: 'decisionPending', decisionId: pending.id });
}

/** How many follow-up commands the current chain may still run; shared by the whole chain. */
interface TriggerBudget {
  remaining: number;
  /**
   * Surge draws so far, and the cards the deck and discard held before the
   * first surging draw of this `handle` call. A deck made only of surge cards
   * would reshuffle and draw forever, so one call makes at most that many
   * draws in surge chains. A stored surge resumes in a later call and counts
   * afresh; it only waits there because the players have to answer first.
   */
  surges: number;
  encounterCards?: number;
}

function newBudget(): TriggerBudget {
  return { remaining: MAX_TRIGGERED_COMMANDS, surges: 0 };
}

/** Gives the chain a fresh budget from here on (`newBudget`), for steps that share its object. */
function resetBudget(budget: TriggerBudget): void {
  delete budget.encounterCards;
  Object.assign(budget, newBudget());
}

/**
 * Resolves `steps` in order, each step's own steps in front of the rest,
 * until none is left or one raised a decision; then the rest is stored
 * (`suspend`). Decisions that were already pending when the run began do
 * not stop it: answering one of several attacks of opportunity resolves that
 * attack now. With `resumesStored`, an empty queue goes on with the stored
 * steps once nothing is pending at all (`resumeStored`).
 */
function run(
  resolution: Resolution,
  steps: readonly Step[],
  budget: TriggerBudget,
  { resumesStored }: { resumesStored: boolean },
): void {
  const queue = [...steps];
  const pendingBefore = new Set(resolution.state.pending.map((decision) => decision.id));
  for (;;) {
    if (resolution.state.pending.some((decision) => !pendingBefore.has(decision.id))) {
      suspend(resolution, queue);
      return;
    }
    const step = queue.shift();
    if (step) queue.unshift(...resolveStep(resolution, step, budget));
    else if (!resumesStored || !resumeStored(resolution, queue)) return;
  }
}

/**
 * Stores the steps that wait for a decision (`StepsQueued`), in front of any
 * that already wait. A `finishAdvance` remembers that a decision came first:
 * on the last card, its answer is what ends the scenario.
 */
function suspend(resolution: Resolution, queue: readonly Step[]): void {
  const steps = queue.flatMap((step): QueuedStep[] => {
    if (step.kind === 'phaseStep') return [];
    return step.kind === 'finishAdvance' ? [{ ...step, asked: true }] : [step];
  });
  if (steps.length > 0) emit(resolution, [{ type: 'StepsQueued', steps }]);
}

/**
 * Takes the first stored step (`StepResumed`) into `queue` once nothing is
 * pending; false when there is none or a decision is still open.
 */
function resumeStored(resolution: Resolution, queue: Step[]): boolean {
  const [step] = resolution.state.meta.queue ?? [];
  if (step === undefined || resolution.state.pending.length > 0) return false;
  // A held action takes itself off, so that dropping it can roll back to before.
  if (step.kind !== 'action') emit(resolution, [{ type: 'StepResumed' }]);
  queue.push(step);
  return true;
}

/** One step, naming the follow-up it belongs to when it is rejected. */
function resolveStep(resolution: Resolution, step: Step, budget: TriggerBudget): Step[] {
  switch (step.kind) {
    case 'phaseStep':
      return resolvePhaseStep(resolution, budget);
    case 'action':
      resumeHeldAction(resolution, step.command, budget);
      return [];
    default: {
      if (step.kind === 'command' && step.origin !== undefined) spend(budget);
      try {
        return resolveQueuedStep(resolution, step, budget);
      } catch (error) {
        // Rethrow nested wrappers and loop reports as they are: the innermost reason is the useful one.
        if (!(error instanceof CommandRejected) || step.origin === undefined) throw error;
        if (isChainRejection(error.rejection)) throw error;
        throw new CommandRejected({
          code: 'triggeredCommandRejected',
          command: step.origin,
          reason: error.rejection,
        });
      }
    }
  }
}

/** Counts one follow-up against the loop guard. */
function spend(budget: TriggerBudget): void {
  if (budget.remaining === 0)
    throw new CommandRejected({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
  budget.remaining -= 1;
}

function resolveQueuedStep(
  resolution: Resolution,
  step: Exclude<QueuedStep, { kind: 'action' }>,
  budget: TriggerBudget,
): Step[] {
  const { ctx, state } = resolution;
  switch (step.kind) {
    case 'command':
      return resolveCommand(resolution, step.command, step.origin, budget);
    case 'finishAdvance': {
      const deck = step.command.type === 'AdvanceAgenda' ? 'agenda' : 'act';
      const resolutionName = step.command.resolution;
      const events = completeAdvance(state, deck, step.cardId, resolutionName, step.asked === true);
      return emitWithEffects(resolution, events);
    }
    case 'placeDrawnCard':
      return emitWithEffects(resolution, placeDrawnCard(ctx, state, step.drawn));
    case 'surge':
      return resolveSurge(resolution, step.draw);
  }
}

/**
 * `command`'s own events, then the steps that follow them: the follow-ups
 * their forced effects trigger, then the chosen option's commands if it is
 * an answer, then whatever continues it (`CommandSpec.continueWith`).
 * Triggers on an answer's events coming first is right for a skill test
 * (`SkillTestResolved`: "after you fail" is ST.6, the results ST.7). For a
 * plain choice the chosen option is part of the effect, so an "after" hook
 * on `DecisionResolved` would have to wait for it; no hook reads either
 * event yet, and the timing windows (P1) decide where each one fires.
 */
function resolveCommand(
  resolution: Resolution,
  command: Command,
  origin: Command['type'] | undefined,
  budget: TriggerBudget,
): Step[] {
  const spec = commandSpec(command);
  const before = resolution.state;
  const own = spec.handle(resolution.ctx, before, command);
  if (surgeDraw(own)) budget.encounterCards ??= encounterCardCount(before);
  const continuation = withOrigin(
    withinSurgeLimit(spec.continueWith?.(command, own) ?? [], budget),
    origin,
  );
  if (spec.firesNoTriggers) {
    emit(resolution, own);
    return continuation;
  }
  const triggered = emitWithEffects(resolution, own);
  return [...triggered, ...answerCommands(before, command).map(followUp), ...continuation];
}

/** Emits `events` and returns the follow-ups their forced effects trigger. */
function emitWithEffects(resolution: Resolution, events: readonly Event[]): Step[] {
  const before = resolution.state;
  emit(resolution, events);
  return triggeredCommands(resolution.ctx, before, events).map(followUp);
}

function followUp(command: Command): Step {
  return { kind: 'command', command, origin: command.type };
}

/** Continuation steps of a follow-up belong to it, so a rejection names it. */
function withOrigin(steps: readonly Continuation[], origin: Command['type'] | undefined): Step[] {
  return origin === undefined ? [...steps] : steps.map((step) => ({ ...step, origin }));
}

/**
 * The next of the outstanding phase steps after `NextPhase`: a step's
 * commands come first, then the forced effects of its own events
 * (`RoundEnded` -> `onRoundEnd`), then the next phase step. Nothing once
 * none is left or an enemy attack waits for the players. Each step gets its
 * own loop budget: a phase has a fixed, small number of steps, and the
 * guard is about hooks re-triggering themselves within one of them.
 */
function resolvePhaseStep(resolution: Resolution, budget: TriggerBudget): Step[] {
  const plan = nextStepPlan(resolution.ctx, resolution.state);
  if (!plan) return [];
  resetBudget(budget);
  const before = resolution.state;
  emit(resolution, plan.events);
  return [
    ...plan.commands.map(followUp),
    ...triggeredCommands(resolution.ctx, before, plan.events).map(followUp),
    { kind: 'phaseStep' },
  ];
}

/**
 * `steps` without a surge the chain may not make any more, counting each one
 * it may: no more surge draws than the cards the deck and discard held
 * (`TriggerBudget.encounterCards`). Counted when the surge is queued, so a
 * surge stored for an answer keeps the count of the call that drew its card.
 */
function withinSurgeLimit(steps: readonly Continuation[], budget: TriggerBudget): Continuation[] {
  const allowed: Continuation[] = [];
  for (const step of steps) {
    // The first draw counts too.
    if (step.kind === 'surge' && budget.surges + 1 >= (budget.encounterCards ?? 0)) continue;
    if (step.kind === 'surge') budget.surges += 1;
    allowed.push(step);
  }
  return allowed;
}

/**
 * The surge draw, once the surging card has been placed and its forced
 * effects have resolved; if one of them asked something, this step waited
 * in state until the answer. Nothing when the drawer has left the scenario
 * or no card is left.
 */
function resolveSurge(resolution: Resolution, surge: DrawEncounter): Step[] {
  return canDrawEncounter(resolution.state, surge.investigatorId) ? [followUp(surge)] : [];
}

/**
 * The held action once nothing is pending any more: `StepResumed` and the
 * action's own chain, or `ActionDropped` when an attack of opportunity
 * defeated the investigator or the action has become illegal meanwhile (an
 * attack's forced effect moved them, say). Dropping rather than rejecting
 * keeps the answer that released it valid. The chain runs in a run of its
 * own, so a rejection anywhere in it drops all of it.
 */
function resumeHeldAction(resolution: Resolution, held: HeldAction, budget: TriggerBudget): void {
  const investigator = resolution.state.investigators.find((inv) => inv.id === held.investigatorId);
  if (investigator?.status !== 'active') {
    emit(resolution, [
      {
        type: 'ActionDropped',
        command: held,
        reason: { code: 'investigatorNotActive', investigatorId: held.investigatorId },
      },
    ]);
    return;
  }
  const restore = checkpoint(resolution);
  try {
    emit(resolution, [{ type: 'StepResumed' }]);
    run(resolution, [{ kind: 'command', command: held }], budget, { resumesStored: false });
  } catch (error) {
    if (!(error instanceof CommandRejected)) throw error;
    restore();
    emit(resolution, [{ type: 'ActionDropped', command: held, reason: error.rejection }]);
  }
}

function isChainRejection(rejection: Rejection): boolean {
  return rejection.code === 'triggerLoop' || rejection.code === 'triggeredCommandRejected';
}
