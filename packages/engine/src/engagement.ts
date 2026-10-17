import { cardStats, comparableName, type CardStats, type EngineContext } from './cards';
import type { Command } from './commands';
import type { DecisionRequested, EnemyEngaged, Event } from './events';
import { cardCode, decisionId, type InstanceId, type InvestigatorId } from './ids';
import {
  lowestRemainingHealth,
  lowestRemainingSanity,
  mostClues,
  mostResources,
} from './investigators';
import { requestDecision } from './decisions';
import { hasKeyword } from './keywords';
import { cardsAtLocation, cardsOfType } from './lookup';
import { replay } from './reducer';
import type { CardInstance, GameState, Investigator } from './state';

/** Prey criteria the engine can evaluate from investigator counters; each returns the tied best. */
const PREY_CRITERIA: Record<string, (investigators: readonly Investigator[]) => Investigator[]> = {
  'lowest remaining health': lowestRemainingHealth,
  'lowest remaining sanity': lowestRemainingSanity,
  'most clues': mostClues,
  'most resources': mostResources,
};

/** Active investigators standing at `locationId`, in seat order of `state.investigators`. */
export function investigatorsAt(state: GameState, locationId: InstanceId): Investigator[] {
  return state.investigators.filter(
    (inv) => inv.status === 'active' && inv.locationId === locationId,
  );
}

/**
 * The investigators the enemy prefers among `candidates` according to its
 * `prey` keyword: the tied best. Without a prey keyword, or with a criterion
 * the engine cannot evaluate yet (skill based prey needs investigator card
 * data), all active candidates stay, so the players decide.
 */
export function preferredByPrey(
  stats: CardStats,
  candidates: readonly Investigator[],
): Investigator[] {
  const active = candidates.filter((inv) => inv.status === 'active');
  const detail = stats.keywords?.find((keyword) => keyword.name === 'prey')?.detail;
  const criterion = detail === undefined ? undefined : PREY_CRITERIA[comparableName(detail)];
  return criterion ? criterion(active) : active;
}

/**
 * What happens when the unengaged enemy `enemyId` is at a location with
 * investigators (it just spawned or arrived, or was readied): it engages the
 * only investigator there, or the one its prey picks. If several remain the
 * players choose (`chooseInvestigator` decision whose options run
 * `EngageEnemy`). `drawerId` is the investigator who drew an enemy without a
 * spawn instruction: that one is engaged whatever the prey (Rules Reference,
 * "Spawn"). Nothing for aloof or exhausted enemies and when nobody is there.
 * Massive enemies never use the engaged zone (see `enemyAttackList`).
 */
export function engageEvents(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
  drawerId?: InvestigatorId,
): Event[] {
  const enemy = state.cards[enemyId];
  if (enemy?.zone.kind !== 'atLocation' || enemy.exhausted) return [];
  const stats = cardStats(ctx.cards, enemy.code);
  if (hasKeyword(stats, 'aloof') || hasKeyword(stats, 'massive')) return [];
  const drawer = investigatorsAt(state, enemy.zone.locationId).find((inv) => inv.id === drawerId);
  if (drawer) return [engaged(enemyId, drawer)];
  const preferred = preferredByPrey(stats, investigatorsAt(state, enemy.zone.locationId));
  const [only] = preferred;
  if (only === undefined) return [];
  if (preferred.length === 1) return [engaged(enemyId, only)];
  return chooseInvestigator(
    state,
    enemyId,
    `engage:${enemyId}`,
    'decision.chooseEngagement',
    preferred,
    (chosen) => ({ type: 'EngageEnemy', enemyId, investigatorId: chosen.id }),
  );
}

/**
 * Engagement for every enemy that starts the scenario at a location, so a
 * setup `spawn` next to the investigators behaves like a spawn during play.
 * `state` is the state right after `ScenarioStarted`.
 */
export function startingEngagements(ctx: EngineContext, state: GameState): Event[] {
  const enemies = cardsOfType(ctx, state, 'enemy').filter(
    (card) => card.zone.kind === 'atLocation',
  );
  return engageEach(ctx, state, enemies);
}

/**
 * Rules Reference, "Enemy Engagement": a ready, unengaged enemy engages an
 * investigator who moves into its location. `state` is the state right after
 * the investigator arrived at `locationId`; each unengaged enemy there goes
 * through `engageEvents`, so aloof, massive and exhausted enemies stay where
 * they are.
 */
export function arrivalEngagements(
  ctx: EngineContext,
  state: GameState,
  locationId: InstanceId,
): Event[] {
  const enemies = cardsAtLocation(state, locationId).filter(
    (card) => ctx.cards.get(card.code)?.typeCode === 'enemy',
  );
  return engageEach(ctx, state, enemies);
}

/** `engageEvents` for each enemy in turn, each one seeing the engagements before it. */
function engageEach(
  ctx: EngineContext,
  state: GameState,
  enemies: readonly CardInstance[],
): Event[] {
  let current = state;
  const events: Event[] = [];
  for (const enemy of enemies) {
    const next = engageEvents(ctx, current, enemy.id);
    events.push(...next);
    current = replay(next, current);
  }
  return events;
}

/** A `chooseInvestigator` decision about `subject`, unless one with this id is already open. */
export function chooseInvestigator(
  state: GameState,
  subject: InstanceId,
  id: string,
  prompt: string,
  options: readonly Investigator[],
  answer: (chosen: Investigator) => Command,
): DecisionRequested[] {
  return requestDecision(state, {
    id: decisionId(id),
    kind: 'chooseInvestigator',
    subject,
    prompt,
    decider: { kind: 'lead' },
    options: options.map((inv) => ({
      id: inv.id,
      label: inv.name,
      target: inv.id,
      commands: [answer(inv)],
    })),
  });
}

/** A `chooseLocation` decision about `subject`, unless one with this id is already open. */
export function chooseLocation(
  ctx: EngineContext,
  state: GameState,
  subject: InstanceId,
  id: string,
  prompt: string,
  locations: readonly InstanceId[],
  answer: (chosen: InstanceId) => Command,
): DecisionRequested[] {
  return requestDecision(state, {
    id: decisionId(id),
    kind: 'chooseLocation',
    subject,
    prompt,
    decider: { kind: 'lead' },
    options: locations.map((locationId) => ({
      id: locationId,
      label: ctx.cards.get(state.cards[locationId]?.code ?? cardCode(''))?.name ?? locationId,
      target: locationId,
      commands: [answer(locationId)],
    })),
  });
}

function engaged(enemyId: InstanceId, investigator: Investigator): EnemyEngaged {
  return { type: 'EnemyEngaged', enemyId, investigatorId: investigator.id };
}
