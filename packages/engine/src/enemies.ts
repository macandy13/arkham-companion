import { cardStats, type CardStats, type EngineContext } from './cards';
import { investigatorLeavesEvents } from './elimination';
import type { EnemyAttacked, Event, InvestigatorChanged } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import { cardsInZone, requireCard } from './lookup';
import { defeatCause, playerOrder, withStatDelta } from './investigators';
import { hasKeyword } from './keywords';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, Investigator } from './state';

/** One enemy attack of the enemy phase: who attacks whom, and for how much. */
export interface EnemyAttack {
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
  damage: number;
  horror: number;
}

/**
 * The attacks of the enemy phase, in the order the rules resolve them:
 * investigators in player order (`playerOrder`: by seat, starting with the
 * lead investigator; Rules Reference, "Enemy Phase"), and for each the ready
 * enemies engaged with them, then ready massive enemies at their location. A
 * massive enemy is not in the `engaged` zone (it is engaged with everyone at
 * its location at once, which one zone cannot express), which is why it is
 * added here. Exhausted enemies and defeated or resigned investigators produce
 * no attacks. Within one investigator the order is only a suggestion: the
 * attacked player chooses the order of their attacks, so `ResolveEnemyAttack`
 * accepts any due attack, not just the first of the list.
 */
export function enemyAttackList(ctx: EngineContext, state: GameState): EnemyAttack[] {
  return playerOrder(state).flatMap((investigator) =>
    readyEngagedEnemies(ctx, state, investigator).map((enemyId) => {
      const stats = cardStats(ctx.cards, requireCard(state.cards, enemyId).code);
      return {
        enemyId,
        investigatorId: investigator.id,
        damage: stats.damage ?? 0,
        horror: stats.horror ?? 0,
      };
    }),
  );
}

/**
 * The ready enemies engaged with `investigator`: those in their `engaged`
 * zone, then ready massive enemies at their location, which count as engaged
 * with everyone there (see `enemyAttackList`). These are the enemies that
 * attack in the enemy phase and make attacks of opportunity
 * (`attackOfOpportunityDecisions`).
 */
export function readyEngagedEnemies(
  ctx: EngineContext,
  state: GameState,
  { id: investigatorId, locationId }: Pick<Investigator, 'id' | 'locationId'>,
): InstanceId[] {
  const engaged = cardsInZone(state, { kind: 'engaged', investigatorId });
  const unengaged =
    locationId === undefined ? [] : cardsInZone(state, { kind: 'atLocation', locationId });
  const massive = unengaged.filter((id) => {
    const code = state.cards[id]?.code;
    const stats = code === undefined ? undefined : ctx.cards.get(code);
    return stats?.typeCode === 'enemy' && hasKeyword(stats, 'massive');
  });
  return [...engaged, ...massive].filter((id) => state.cards[id]?.exhausted === false);
}

/**
 * One attack of `enemyId`: its damage and horror, then `EnemyAttacked`
 * (so the log reads in rule order), then a single defeat check over both, as
 * the rules deal them simultaneously, and on a defeat the clean-up
 * (`investigatorLeavesEvents`). Shared by the enemy phase
 * (`ResolveEnemyAttack`) and attacks outside it (`DealEnemyAttack`), so an
 * attack of opportunity that defeats leaves the same board.
 * Rejects an amount that is not a non-negative integer.
 */
export function enemyAttackEvents(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
  investigator: Investigator,
  damage: number,
  horror: number,
): Event[] {
  const attacked: EnemyAttacked = {
    type: 'EnemyAttacked',
    enemyId,
    investigatorId: investigator.id,
  };
  const changes: InvestigatorChanged[] = (
    [
      ['damage', attackAmount(damage)],
      ['horror', attackAmount(horror)],
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
  if (cause === undefined) return [...changes, attacked];
  return [
    ...changes,
    attacked,
    ...investigatorLeavesEvents(ctx, state, investigator, {
      type: 'InvestigatorDefeated',
      investigatorId: investigator.id,
      cause,
    }),
  ];
}

function attackAmount(amount: number): number {
  if (!Number.isInteger(amount) || amount < 0)
    throw new CommandRejected({ code: 'invalidAttackAmount', amount });
  return amount;
}

/** A card that is an enemy by type, with its stats; rejects anything else. */
export function enemyOf(
  ctx: EngineContext,
  state: GameState,
  enemyId: InstanceId,
): { enemy: CardInstance; stats: CardStats } {
  const enemy = requireCard(state.cards, enemyId);
  const stats = cardStats(ctx.cards, enemy.code);
  if (stats.typeCode !== 'enemy')
    throw new CommandRejected({ code: 'notAnEnemy', cardId: enemyId });
  return { enemy, stats };
}

/**
 * Whether the enemy is on the table: unengaged at a location or engaged with
 * an investigator. Narrower than `isInPlay` (`doom.ts`), which also counts
 * cards in threat areas and attached to cards in play.
 */
export function isEnemyOnTable(enemy: CardInstance): boolean {
  return enemy.zone.kind === 'atLocation' || enemy.zone.kind === 'engaged';
}

/** The location an enemy on the table is at; an engaged enemy is where its investigator is. */
export function locationOf(state: GameState, enemy: CardInstance): InstanceId {
  if (enemy.zone.kind === 'atLocation') return enemy.zone.locationId;
  if (enemy.zone.kind === 'engaged') {
    const { investigatorId } = enemy.zone;
    const location = state.investigators.find((inv) => inv.id === investigatorId)?.locationId;
    if (location !== undefined) return location;
    throw new CommandRejected({ code: 'investigatorHasNoLocation', investigatorId });
  }
  throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
}

/**
 * The enemies in play at `locationId`, unengaged there or engaged with an
 * investigator standing there, in card order. Used for "enemies at your
 * location" (e.g. The Gathering's skull token).
 */
export function enemiesAt(state: GameState, locationId: InstanceId): CardInstance[] {
  return Object.values(state.cards).filter((card) => {
    const zone = card.zone;
    if (zone.kind === 'atLocation') return zone.locationId === locationId;
    if (zone.kind !== 'engaged') return false;
    const engaged = state.investigators.find((inv) => inv.id === zone.investigatorId);
    return engaged?.locationId === locationId;
  });
}
