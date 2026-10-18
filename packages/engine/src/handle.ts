import type { EngineContext } from './cards';
import { commandSpec, type CommandSpec } from './command_specs';
import type { Command, DrawEncounter } from './commands';
import { attackOfOpportunityDecisions, isOwnTurnAction } from './attacks_of_opportunity';
import { answerCommands } from './decisions';
import type { Event } from './events';
import { canDrawEncounter, encounterCardCount, surgeDraw } from './handle_encounter';
import { nextStepPlan } from './phases';
import { replay } from './reducer';
import { CommandRejected, type Rejection } from './rejection';
import type { GameState } from './state';
import { MAX_TRIGGERED_COMMANDS, triggeredCommands } from './triggers';

/**
 * Validates a command against the current state and returns the resulting events.
 * Card data comes from `ctx.cards`; whatever a rule reads from it ends up in the
 * events, so `apply` never needs the `CardDb`.
 *
 * The returned events include the whole chain of forced effects the command
 * triggered (`ctx.scenario.hooks`, `ctx.effects`): the follow-up commands are handled
 * like player commands after the events of the command that triggered them
 * (depth first, so a follow-up's own chain resolves before the next sibling),
 * and their events are appended to the originating command's list. A command
 * whose rules continue after those effects (advancing agenda/act, see
 * `CommandSpec.complete`) appends its remaining events and their chains, under the
 * same loop guard. One player command
 * therefore yields one list of events, which undo (M1.11) removes as a unit.
 * A rejected follow-up or a chain longer than `MAX_TRIGGERED_COMMANDS`
 * rejects the originating command, so a bad hook can neither hang the app nor
 * leave half its effect behind.
 * Which commands are accepted once the scenario has ended or while a
 * decision is pending is up to their `CommandSpec`; the commands of an answer (`ResolveDecision`) run first in the
 * chain, like a hook's follow-ups, before the forced effects of its events.
 * `NextPhase` continues with the outstanding phase steps (`phaseStepEvents`),
 * so one "Next" yields the whole automated part of a phase.
 * A player command that is an action provoking attacks of opportunity
 * (`CommandSpec.provokes`, `attackOfOpportunityDecisions`) yields one decision per attacking enemy
 * and is held (`ActionHeld`) until all of them are answered; follow-ups
 * never provoke, which is why this happens here and not in
 * `handleWithTriggers`. A surge draw waiting for the decisions of the card
 * before it is held the same way (`surgeEvents`). Once no decision is
 * pending, any command (usually the last answer) ends with the held command
 * (`resumeHeldAction`).
 * Pure: the same state, command and context always yield the same events.
 */
export function handle(ctx: EngineContext, state: GameState, command: Command): Event[] {
  const spec = commandSpec(command);
  assertAccepted(state, command, spec);
  const budget = newBudget();
  const provoking = spec.provokes?.(command);
  const action = provoking && isOwnTurnAction(state, provoking) ? provoking : undefined;
  const attacks = action ? attackOfOpportunityDecisions(ctx, state, action) : [];
  if (action && attacks.length > 0) {
    // An illegal action must be rejected before it provokes anything; the
    // events of this dry run are dropped, the action resolves after the attacks.
    handleWithTriggers(ctx, state, command, budget);
    return [...attacks, { type: 'ActionHeld', command: action }];
  }
  const events = handleWithTriggers(ctx, state, command, budget);
  return [...events, ...resumeHeldAction(ctx, replay(events, state), budget)];
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

/**
 * The held action (`GameMeta.heldAction`) once nothing is pending any more:
 * `ActionResumed` and the action's own events, or `ActionDropped` when an
 * attack of opportunity defeated the investigator or the action has become
 * illegal meanwhile (an attack's forced effect moved them, say). Dropping
 * rather than rejecting keeps the answer that released it valid.
 */
function resumeHeldAction(ctx: EngineContext, state: GameState, budget: TriggerBudget): Event[] {
  const held = state.meta.heldAction;
  if (held === undefined || state.pending.length > 0) return [];
  const investigator = state.investigators.find((inv) => inv.id === held.investigatorId);
  if (investigator?.status !== 'active')
    return [
      {
        type: 'ActionDropped',
        command: held,
        reason: { code: 'investigatorNotActive', investigatorId: held.investigatorId },
      },
    ];
  const resumed: Event = { type: 'ActionResumed' };
  try {
    return [resumed, ...handleWithTriggers(ctx, replay([resumed], state), held, budget)];
  } catch (error) {
    if (!(error instanceof CommandRejected)) throw error;
    return [{ type: 'ActionDropped', command: held, reason: error.rejection }];
  }
}

/** How many follow-up commands the current chain may still run; shared by the whole chain. */
interface TriggerBudget {
  remaining: number;
  /**
   * Surge draws so far, and the cards the deck and discard held before the
   * first surging draw of this `handle` call. A deck made only of surge cards
   * would reshuffle and draw forever, so one call makes at most that many
   * draws in surge chains. A held surge resumes in a later call and counts
   * afresh; it only waits there because the players have to answer first.
   */
  surges: number;
  encounterCards?: number;
}

function newBudget(): TriggerBudget {
  return { remaining: MAX_TRIGGERED_COMMANDS, surges: 0 };
}

function handleWithTriggers(
  ctx: EngineContext,
  state: GameState,
  command: Command,
  budget: TriggerBudget,
): Event[] {
  const spec = commandSpec(command);
  const own = spec.handle(ctx, state, command);
  const events = withForcedEffects(ctx, state, own, command, budget);
  const after = replay(events, state);
  if (spec.continuesWithPhaseSteps) return [...events, ...phaseStepEvents(ctx, after)];
  const completion = spec.complete?.(ctx, state, after, command, own) ?? [];
  const completed =
    completion.length === 0
      ? events
      : [...events, ...withForcedEffects(ctx, after, completion, command, budget)];
  const surge = surgeDraw(own);
  if (!surge) return completed;
  budget.encounterCards ??= encounterCardCount(state);
  return [...completed, ...surgeEvents(ctx, replay(completed, state), surge, budget)];
}

/** `events` (produced from `state`) followed by the chains of forced effects they trigger. */
function withForcedEffects(
  ctx: EngineContext,
  state: GameState,
  events: Event[],
  command: Command,
  budget: TriggerBudget,
): Event[] {
  if (commandSpec(command).firesNoTriggers) return events;
  const followUps = [...answerCommands(state, command), ...triggeredCommands(ctx, state, events)];
  return withFollowUps(ctx, state, events, followUps, budget);
}

/** `events` (produced from `state`) followed by the events of `followUps`, handled in order. */
function withFollowUps(
  ctx: EngineContext,
  state: GameState,
  events: Event[],
  followUps: readonly Command[],
  budget: TriggerBudget,
): Event[] {
  let current = replay(events, state);
  const chain = [...events];
  for (const followUp of followUps) {
    if (budget.remaining === 0)
      throw new CommandRejected({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
    budget.remaining -= 1;
    const followUpEvents = handleFollowUp(ctx, current, followUp, budget);
    current = replay(followUpEvents, current);
    chain.push(...followUpEvents);
  }
  return chain;
}

/**
 * `NextPhase`, continued: runs the outstanding phase steps one at a time
 * until one leaves a decision pending or an enemy attack waits for the
 * players. A step's commands come first, then the forced effects of its own
 * events (`RoundEnded` -> `onRoundEnd`). Each step gets its own loop budget:
 * a phase has a fixed, small number of steps, and the guard is about hooks
 * re-triggering themselves within one of them.
 */
function phaseStepEvents(ctx: EngineContext, state: GameState): Event[] {
  const events: Event[] = [];
  let current = state;
  while (current.pending.length === 0) {
    const plan = nextStepPlan(ctx, current);
    if (!plan) break;
    const followUps = [...plan.commands, ...triggeredCommands(ctx, current, plan.events)];
    const stepEvents = withFollowUps(ctx, current, plan.events, followUps, newBudget());
    events.push(...stepEvents);
    current = replay(stepEvents, current);
  }
  return events;
}

/**
 * The surge draw, once the surging card and its forced effects have resolved
 * (`after`). While one of them still waits for an answer, the draw is held
 * (`ActionHeld`) and `resumeHeldAction` makes it after the last answer, so
 * the next card is not drawn before the players have resolved this one.
 * Nothing when the drawer has left the scenario, no card is left, or the
 * chain has already drawn every card (`TriggerBudget.encounterCards`).
 * If a held action is already waiting (a forced effect during attacks of
 * opportunity drew the card), the slot is taken and the draw happens at once.
 * No trigger point fires during those attacks today, so that case cannot
 * arise yet; M1V.1 tracks it.
 */
function surgeEvents(
  ctx: EngineContext,
  after: GameState,
  surge: DrawEncounter,
  budget: TriggerBudget,
): Event[] {
  if (!canDrawEncounter(after, surge.investigatorId)) return [];
  // The first draw counts too.
  if (budget.surges + 1 >= (budget.encounterCards ?? 0)) return [];
  budget.surges += 1;
  if (after.pending.length > 0 && after.meta.heldAction === undefined)
    return [{ type: 'ActionHeld', command: surge }];
  return withFollowUps(ctx, after, [], [surge], budget);
}

/** Handles a hook's command, naming the command when it is rejected. */
function handleFollowUp(
  ctx: EngineContext,
  state: GameState,
  command: Command,
  budget: TriggerBudget,
): Event[] {
  try {
    return handleWithTriggers(ctx, state, command, budget);
  } catch (error) {
    // Rethrow nested wrappers and loop reports as they are: the innermost reason is the useful one.
    if (!(error instanceof CommandRejected) || isChainRejection(error.rejection)) throw error;
    throw new CommandRejected({
      code: 'triggeredCommandRejected',
      command: command.type,
      reason: error.rejection,
    });
  }
}

function isChainRejection(rejection: Rejection): boolean {
  return rejection.code === 'triggerLoop' || rejection.code === 'triggeredCommandRejected';
}
