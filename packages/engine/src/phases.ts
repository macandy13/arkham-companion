import type { EngineContext } from './cards';
import type { Command, EndTurn, ResolveEnemyAttack } from './commands';
import { enemyAttackList } from './enemies';
import type {
  Event,
  ExhaustChanged,
  InvestigatorChanged,
  InvestigatorDefeated,
  PhaseChanged,
  PhaseStepsChanged,
  TurnEnded,
} from './events';
import { isInPlay } from './handle-enemy';
import { activeInvestigator } from './handle-investigator';
import { defeatCause, withStatDelta } from './investigators';
import { replay } from './reducer';
import { CommandRejected } from './rejection';
import type { GameState, Investigator, Phase, PhaseStep } from './state';
import { zoneKey } from './zone';

/** The phase that follows each phase; the first round starts with investigation (no mythos). */
const NEXT_PHASE: Readonly<Record<Phase, Phase>> = {
  setup: 'investigation',
  mythos: 'investigation',
  investigation: 'enemy',
  enemy: 'upkeep',
  upkeep: 'mythos',
};

type AttackStep = Extract<PhaseStep, { kind: 'enemyAttack' }>;

/** What running one phase step produces: its own events, then commands handled as follow-ups. */
export interface StepPlan {
  events: Event[];
  commands: Command[];
}

/**
 * `NextPhase`, own part: nothing while steps of the current phase remain
 * (`handle` then resumes them), otherwise the change to the next phase with
 * its steps. A new round begins with the mythos phase, or with investigation
 * in round 1, whose mythos phase the rules skip.
 */
export function handleNextPhase(ctx: EngineContext, state: GameState): PhaseChanged[] {
  const due = state.meta.steps.find(
    (step): step is AttackStep => step.kind === 'enemyAttack' && isAttackDue(ctx, state, step),
  );
  if (due)
    throw new CommandRejected({
      code: 'enemyAttackPending',
      enemyId: due.enemyId,
      investigatorId: due.investigatorId,
    });
  if (state.meta.steps.length > 0) return [];
  const { phase: current, round } = state.meta;
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
 * left or the next one is an enemy attack the players have to resolve. Each
 * plan starts with the `PhaseStepsChanged` that removes the step, so a
 * decision the step raises leaves the cursor after it.
 */
export function nextStepPlan(ctx: EngineContext, state: GameState): StepPlan | undefined {
  const [step, ...rest] = state.meta.steps;
  if (step === undefined) return undefined;
  const done: PhaseStepsChanged = { type: 'PhaseStepsChanged', steps: rest };
  switch (step.kind) {
    case 'enemyAttack':
      // An attack whose enemy was defeated, evaded or exhausted meanwhile is simply gone.
      return isAttackDue(ctx, state, step) ? undefined : { events: [done], commands: [] };
    case 'enemyAttacks':
      return {
        events: [{ type: 'PhaseStepsChanged', steps: [...attackSteps(ctx, state), ...rest] }],
        commands: [],
      };
    case 'endRound':
      return { events: [done, { type: 'RoundEnded', round: state.meta.round }], commands: [] };
    default:
      return { events: [done], commands: stepCommands(ctx, state, step) };
  }
}

/** `EndTurn`: marks the investigator's turn of this round as taken. */
export function handleEndTurn(state: GameState, cmd: EndTurn): TurnEnded[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  if (state.meta.phase !== 'investigation')
    throw new CommandRejected({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: state.meta.phase,
    });
  if (state.meta.turnsTaken.includes(investigator.id))
    throw new CommandRejected({ code: 'turnAlreadyTaken', investigatorId: investigator.id });
  return [{ type: 'TurnEnded', investigatorId: investigator.id }];
}

/**
 * `ResolveEnemyAttack`: removes the attack step, deals its damage and horror
 * at once (one defeat check, as the rules deal them simultaneously) and
 * exhausts the enemy once it has no other due attack.
 */
export function handleResolveEnemyAttack(
  ctx: EngineContext,
  state: GameState,
  cmd: ResolveEnemyAttack,
): Event[] {
  const isThisAttack = (step: PhaseStep) =>
    step.kind === 'enemyAttack' &&
    step.enemyId === cmd.enemyId &&
    step.investigatorId === cmd.investigatorId;
  const attack = enemyAttackList(ctx, state).find(
    (a) => a.enemyId === cmd.enemyId && a.investigatorId === cmd.investigatorId,
  );
  if (!state.meta.steps.some(isThisAttack) || !attack)
    throw new CommandRejected({
      code: 'attackNotDue',
      enemyId: cmd.enemyId,
      investigatorId: cmd.investigatorId,
    });
  const steps = state.meta.steps.filter((step) => !isThisAttack(step));
  const dealt = attackEvents(
    activeInvestigator(state, cmd.investigatorId),
    attackAmount(cmd.damage ?? attack.damage),
    attackAmount(cmd.horror ?? attack.horror),
  );
  const events: Event[] = [{ type: 'PhaseStepsChanged', steps }, ...dealt];
  const after = replay(events, state);
  const attacksLeft = steps.some(
    (step) =>
      step.kind === 'enemyAttack' && step.enemyId === cmd.enemyId && isAttackDue(ctx, after, step),
  );
  const exhausted: ExhaustChanged[] = attacksLeft
    ? []
    : [{ type: 'ExhaustChanged', cardId: cmd.enemyId, exhausted: true }];
  return [...events, ...exhausted];
}

/**
 * The active investigators in player order: by seat, starting with the lead
 * investigator (Rules Reference, "Player Order").
 */
export function playerOrder(state: GameState): Investigator[] {
  const seated = [...state.investigators].sort((a, b) => a.seat - b.seat);
  const lead = Math.max(
    0,
    seated.findIndex((inv) => inv.id === state.meta.leadInvestigator),
  );
  return [...seated.slice(lead), ...seated.slice(0, lead)].filter((inv) => inv.status === 'active');
}

function stepsOf(state: GameState, phase: Phase): PhaseStep[] {
  switch (phase) {
    case 'mythos':
      return [
        { kind: 'placeDoom' },
        { kind: 'checkDoomThreshold' },
        ...playerOrder(state).map((inv): PhaseStep => ({
          kind: 'drawEncounter',
          investigatorId: inv.id,
        })),
      ];
    case 'enemy':
      return [{ kind: 'moveHunters' }, { kind: 'enemyAttacks' }];
    case 'upkeep':
      return [{ kind: 'readyEnemies' }, { kind: 'gainResources' }, { kind: 'endRound' }];
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
  step: Exclude<PhaseStep, { kind: 'enemyAttack' | 'enemyAttacks' | 'endRound' }>,
): Command[] {
  switch (step.kind) {
    case 'placeDoom':
      return state.agenda.current === undefined ? [] : [{ type: 'PlaceDoom', amount: 1 }];
    case 'checkDoomThreshold':
      return [{ type: 'CheckDoomThreshold' }];
    case 'drawEncounter':
      return canDraw(state, step.investigatorId)
        ? [{ type: 'DrawEncounter', investigatorId: step.investigatorId }]
        : [];
    case 'moveHunters':
      return [{ type: 'MoveHunters' }];
    case 'readyEnemies':
      return Object.values(state.cards)
        .filter(
          (card) =>
            card.exhausted && isInPlay(card) && ctx.cards.get(card.code)?.typeCode === 'enemy',
        )
        .map((card) => ({ type: 'ReadyEnemy', enemyId: card.id }));
    case 'gainResources':
      return state.investigators
        .filter((inv) => inv.status === 'active')
        .map((inv) => ({
          type: 'AdjustInvestigator',
          investigatorId: inv.id,
          stat: 'resources',
          delta: 1,
        }));
  }
}

function canDraw(state: GameState, investigatorId: Investigator['id']): boolean {
  const active = state.investigators.some(
    (inv) => inv.id === investigatorId && inv.status === 'active',
  );
  const cards =
    (state.order[zoneKey({ kind: 'encounterDeck' })]?.length ?? 0) +
    (state.order[zoneKey({ kind: 'encounterDiscard' })]?.length ?? 0);
  return active && cards > 0;
}

function isAttackDue(ctx: EngineContext, state: GameState, step: AttackStep): boolean {
  return enemyAttackList(ctx, state).some(
    (attack) => attack.enemyId === step.enemyId && attack.investigatorId === step.investigatorId,
  );
}

function attackSteps(ctx: EngineContext, state: GameState): AttackStep[] {
  return enemyAttackList(ctx, state).map((attack) => ({
    kind: 'enemyAttack',
    enemyId: attack.enemyId,
    investigatorId: attack.investigatorId,
  }));
}

function attackAmount(amount: number): number {
  if (!Number.isInteger(amount) || amount < 0)
    throw new CommandRejected({ code: 'invalidAttackAmount', amount });
  return amount;
}

/** Damage and horror of one attack, followed by a single defeat check over both. */
function attackEvents(
  investigator: Investigator,
  damage: number,
  horror: number,
): (InvestigatorChanged | InvestigatorDefeated)[] {
  const changes: InvestigatorChanged[] = (
    [
      ['damage', damage],
      ['horror', horror],
    ] as const
  )
    .filter(([, amount]) => amount > 0)
    .map(([stat, delta]) => ({
      type: 'InvestigatorChanged',
      investigatorId: investigator.id,
      stat,
      delta,
    }));
  const after = changes.reduce(
    (inv, change) => withStatDelta(inv, change.stat, change.delta),
    investigator,
  );
  const cause = defeatCause(after);
  return cause === undefined
    ? changes
    : [...changes, { type: 'InvestigatorDefeated', investigatorId: investigator.id, cause }];
}
