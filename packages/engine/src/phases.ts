import type { EngineContext } from './cards';
import type { Command, ResolveEnemyAttack } from './commands';
import { enemyAttackEvents, enemyAttackList } from './enemies';
import type { Event, ExhaustChanged, PhaseChanged, PhaseStepsChanged } from './events';
import { isOnTable } from './enemies';
import { activeInvestigator } from './investigators';
import { playerOrder } from './investigators';
import { canDrawEncounter } from './handle_encounter';
import { cardsOfType } from './lookup';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { DueAttack, GameState, Phase, PhaseStep, PhaseStepId } from './state';
import { actionsResetEvents, assertTurnsTaken } from './turns';

/** The phase that follows each phase; the first round starts with investigation (no mythos). */
const NEXT_PHASE: Readonly<Record<Phase, Phase>> = {
  setup: 'investigation',
  mythos: 'investigation',
  investigation: 'enemy',
  enemy: 'upkeep',
  upkeep: 'mythos',
};

/** The Rules Reference number and title of each step the phase assistant runs, for debugging output. */
export const PHASE_STEP_TITLES: Readonly<Record<PhaseStepId, string>> = {
  placeDoom: '1.2 place 1 doom on the current agenda',
  checkDoomThreshold: '1.3 check doom threshold',
  drawEncounterCard: '1.4 each investigator draws 1 encounter card',
  huntersMove: '3.2 hunter enemies move',
  enemiesAttack: '3.3 resolve engaged enemy attacks',
  resetActions: '4.2 reset actions',
  readyExhausted: '4.3 ready each exhausted enemy (players ready their own cards)',
  gainResources: '4.4 each investigator gains 1 resource (and draws 1 card at the table)',
  endRound: '4.6 round ends',
};

type AttackStep = Extract<PhaseStep, { id: 'enemiesAttack' }>;

/**
 * What running one phase step produces: its own events, then commands handled
 * as follow-ups. The step loop stops after a step that raised a decision, but
 * not inside it: a step's later commands still run after an earlier one raised
 * a decision (e.g. one `ReadyEnemy` asking whom to engage, then the next
 * `ReadyEnemy`). Step authors must keep that invariant: the commands of one
 * step must not depend on the answer to a decision raised by an earlier one;
 * split them into separate steps if they do.
 */
export interface StepPlan {
  events: Event[];
  commands: Command[];
}

/**
 * `NextPhase`, own part: nothing while steps of the current phase remain
 * (`handle` then resumes them), otherwise the change to the next phase with
 * its steps. A new round begins with the mythos phase, or with investigation
 * in round 1, whose mythos phase the rules skip. The investigation phase ends
 * only once every active investigator has taken their turn.
 */
export function handleNextPhase(ctx: EngineContext, state: GameState): PhaseChanged[] {
  const due = dueAttacksOf(ctx, state, state.meta.steps[0]);
  if (due[0])
    throw new CommandRejected({
      code: 'enemyAttackPending',
      enemyId: due[0].enemyId,
      investigatorId: due[0].investigatorId,
    });
  if (state.meta.steps.length > 0) return [];
  const { phase: current, round } = state.meta;
  if (current === 'investigation') assertTurnsTaken(state);
  const phase = NEXT_PHASE[current];
  const newRound = phase === 'mythos' || current === 'setup';
  return [
    {
      type: 'PhaseChanged',
      phase,
      round: newRound ? round + 1 : round,
      steps: stepsOf(state, phase),
    },
  ];
}

/**
 * The next phase step that can run on its own, or `undefined` when none is
 * left or step 3.3 waits for the players to resolve an attack. Each plan
 * starts with the `PhaseStepsChanged` that removes the step, so a decision the
 * step raises leaves the cursor after it.
 */
export function nextStepPlan(ctx: EngineContext, state: GameState): StepPlan | undefined {
  const [step, ...rest] = state.meta.steps;
  if (step === undefined) return undefined;
  const done: PhaseStepsChanged = { type: 'PhaseStepsChanged', steps: rest };
  switch (step.id) {
    case 'enemiesAttack':
      return attackStepPlan(ctx, state, step, rest);
    case 'resetActions':
      return { events: [done, ...actionsResetEvents(state)], commands: [] };
    case 'endRound': {
      const ended: Event = { type: 'RoundEnded', round: state.meta.round };
      return { events: [done, ended], commands: [] };
    }
    default:
      return { events: [done], commands: stepCommands(ctx, state, step) };
  }
}

/**
 * Step 3.3 when reached: lists the due attacks (in player order, see
 * `enemyAttackList`) and waits; once none of them is due any more (resolved,
 * or the enemy was defeated, evaded or exhausted meanwhile) the step is done.
 */
function attackStepPlan(
  ctx: EngineContext,
  state: GameState,
  step: AttackStep,
  rest: PhaseStep[],
): StepPlan | undefined {
  if (step.attacks === undefined) {
    const listed: AttackStep = { id: 'enemiesAttack', attacks: attacksDue(ctx, state) };
    return { events: [{ type: 'PhaseStepsChanged', steps: [listed, ...rest] }], commands: [] };
  }
  if (dueAttacksOf(ctx, state, step).length > 0) return undefined;
  return { events: [{ type: 'PhaseStepsChanged', steps: rest }], commands: [] };
}

/**
 * `ResolveEnemyAttack`: removes the attack from step 3.3, deals its damage and
 * horror at once (one defeat check, as the rules deal them simultaneously) and
 * exhausts the enemy once it has no other due attack. The step ends with its
 * last due attack.
 */
export function handleResolveEnemyAttack(
  ctx: EngineContext,
  state: GameState,
  cmd: ResolveEnemyAttack,
): Event[] {
  const [step, ...rest] = state.meta.steps;
  const isThisAttack = (attack: DueAttack) =>
    attack.enemyId === cmd.enemyId && attack.investigatorId === cmd.investigatorId;
  const attack = enemyAttackList(ctx, state).find(isThisAttack);
  if (!dueAttacksOf(ctx, state, step).some(isThisAttack) || !attack)
    throw new CommandRejected({
      code: 'attackNotDue',
      enemyId: cmd.enemyId,
      investigatorId: cmd.investigatorId,
    });
  const dealt = enemyAttackEvents(
    ctx,
    state,
    activeInvestigator(state, cmd.investigatorId),
    cmd.damage ?? attack.damage,
    cmd.horror ?? attack.horror,
  );
  const after = replay(dealt, state);
  const remaining = dueAttacksOf(ctx, after, step).filter((due) => !isThisAttack(due));
  const steps: PhaseStep[] =
    remaining.length > 0 ? [{ id: 'enemiesAttack', attacks: remaining }, ...rest] : rest;
  const exhausted: ExhaustChanged[] = remaining.some((due) => due.enemyId === cmd.enemyId)
    ? []
    : [{ type: 'ExhaustChanged', cardId: cmd.enemyId, exhausted: true }];
  return [{ type: 'PhaseStepsChanged', steps }, ...dealt, ...exhausted];
}

function stepsOf(state: GameState, phase: Phase): PhaseStep[] {
  switch (phase) {
    case 'mythos':
      return [
        { id: 'placeDoom' },
        { id: 'checkDoomThreshold' },
        ...playerOrder(state).map((inv): PhaseStep => ({
          id: 'drawEncounterCard',
          investigatorId: inv.id,
        })),
      ];
    case 'enemy':
      return [{ id: 'huntersMove' }, { id: 'enemiesAttack' }];
    case 'upkeep':
      return [
        { id: 'resetActions' },
        { id: 'readyExhausted' },
        { id: 'gainResources' },
        { id: 'endRound' },
      ];
    case 'setup':
    case 'investigation':
      return [];
  }
}

/**
 * The commands of a step that the generic commands implement. A step whose
 * subject is gone (no agenda left, a defeated drawer, nothing to draw) does
 * nothing instead of rejecting, so the round can always go on.
 */
function stepCommands(
  ctx: EngineContext,
  state: GameState,
  step: Exclude<PhaseStep, { id: 'enemiesAttack' | 'resetActions' | 'endRound' }>,
): Command[] {
  switch (step.id) {
    case 'placeDoom':
      return state.agenda.current === undefined ? [] : [{ type: 'PlaceDoom', amount: 1 }];
    case 'checkDoomThreshold':
      return [{ type: 'CheckDoomThreshold' }];
    case 'drawEncounterCard':
      return canDrawEncounter(state, step.investigatorId)
        ? [{ type: 'DrawEncounter', investigatorId: step.investigatorId }]
        : [];
    case 'huntersMove':
      return [{ type: 'MoveHunters' }];
    case 'readyExhausted':
      return cardsOfType(ctx, state, 'enemy')
        .filter((card) => card.exhausted && isOnTable(card))
        .map((card) => ({ type: 'ReadyEnemy', enemyId: card.id }));
    case 'gainResources':
      return playerOrder(state).map((inv) => ({
        type: 'AdjustInvestigator',
        investigatorId: inv.id,
        stat: 'resources',
        delta: 1,
      }));
  }
}

/** The attacks of `enemyAttackList` as step 3.3 lists them. */
function attacksDue(ctx: EngineContext, state: GameState): DueAttack[] {
  return enemyAttackList(ctx, state).map(({ enemyId, investigatorId }) => ({
    enemyId,
    investigatorId,
  }));
}

/**
 * The attacks enemy step 3.3 still has to resolve when it is the current
 * step: those it listed whose enemy is still ready and engaged with that
 * investigator. None outside that step. `PlayTable` and `BoardView` read the
 * step through this, so they never replay an attack the step dropped.
 */
export function attacksStillDue(ctx: EngineContext, state: GameState): DueAttack[] {
  return dueAttacksOf(ctx, state, state.meta.steps[0]);
}

/** The attacks a listed step 3.3 still has to resolve; none for any other step. */
function dueAttacksOf(
  ctx: EngineContext,
  state: GameState,
  step: PhaseStep | undefined,
): DueAttack[] {
  if (step?.id !== 'enemiesAttack' || step.attacks === undefined) return [];
  const due = enemyAttackList(ctx, state);
  return step.attacks.filter((listed) =>
    due.some(
      (attack) =>
        attack.enemyId === listed.enemyId && attack.investigatorId === listed.investigatorId,
    ),
  );
}
