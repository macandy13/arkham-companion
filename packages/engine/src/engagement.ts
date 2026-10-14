import { cardStats, type CardStats, type EngineContext } from './cards';
import type { DecisionRequested, EnemyEngaged, Event } from './events';
import { decisionId, type InstanceId } from './ids';
import {
  lowestRemainingHealth,
  lowestRemainingSanity,
  mostClues,
  mostResources,
} from './investigators';
import { hasKeyword } from './keywords';
import { replay } from './reducer';
import type { Decision, GameState, Investigator } from './state';

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
  const criterion = detail === undefined ? undefined : PREY_CRITERIA[normalised(detail)];
  return criterion ? criterion(active) : active;
}

/**
 * What happens when the unengaged enemy `enemyId` is at a location with
 * investigators (it just spawned or arrived, or was readied): it engages the
 * only investigator there, or the one its prey picks. If several remain the
 * players choose (`chooseInvestigator` decision, to be answered by
 * `EngageEnemy`). Nothing for aloof enemies and when nobody is there.
 * Massive enemies never use the engaged zone (see `enemyAttackList`).
 */
export function engageEvents(ctx: EngineContext, state: GameState, enemyId: InstanceId): Event[] {
  const enemy = state.cards[enemyId];
  if (enemy?.zone.kind !== 'atLocation') return [];
  const stats = cardStats(ctx.cards, enemy.code);
  if (hasKeyword(stats, 'aloof') || hasKeyword(stats, 'massive')) return [];
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
  );
}

/**
 * Engagement for every enemy that starts the scenario at a location, so a
 * setup `spawn` next to the investigators behaves like a spawn during play.
 * `state` is the state right after `ScenarioStarted`.
 */
export function startingEngagements(ctx: EngineContext, state: GameState): Event[] {
  const enemies = Object.values(state.cards).filter(
    (card) => card.zone.kind === 'atLocation' && ctx.cards.get(card.code)?.typeCode === 'enemy',
  );
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
): DecisionRequested[] {
  return requested(state, {
    id: decisionId(id),
    kind: 'chooseInvestigator',
    subject,
    prompt,
    options: options.map((inv) => ({ id: inv.id, label: inv.name, target: inv.id })),
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
): DecisionRequested[] {
  return requested(state, {
    id: decisionId(id),
    kind: 'chooseLocation',
    subject,
    prompt,
    options: locations.map((locationId) => ({
      id: locationId,
      label: ctx.cards.get(state.cards[locationId]?.code ?? '')?.name ?? locationId,
      target: locationId,
    })),
  });
}

function requested(state: GameState, decision: Decision): DecisionRequested[] {
  if (state.pending.some((pending) => pending.id === decision.id)) return [];
  return [{ type: 'DecisionRequested', decision }];
}

function engaged(enemyId: InstanceId, investigator: Investigator): EnemyEngaged {
  return { type: 'EnemyEngaged', enemyId, investigatorId: investigator.id };
}

function normalised(detail: string): string {
  return detail.trim().replace(/\.$/, '').toLowerCase();
}
