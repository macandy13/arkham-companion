import { shortestPaths } from './board';
import { cardStats, resolveValue, type CardStats, type EngineContext, type Trait } from './cards';
import { woundEvents } from './elimination';
import type { EnemyAttacked, Event } from './events';
import type { CardCode, InstanceId, InvestigatorId } from './ids';
import { cardsInZone, requireCard } from './lookup';
import { playerOrder } from './investigators';
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
  const amounts = { damage: attackAmount(damage), horror: attackAmount(horror) };
  return woundEvents(ctx, state, investigator, amounts, [attacked]);
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
 * The health of an enemy with `stats` in this game, scaled by the player count, or undefined when
 * it prints none: such an enemy cannot be defeated by damage (`handleDamageEnemy`).
 */
export function enemyHealth(stats: CardStats, state: GameState): number | undefined {
  return stats.health && resolveValue(stats.health, state.meta.playerCount);
}

/** Whether the enemy is in the investigator's engaged zone (a massive enemy never is). */
export function isEngagedWith(enemy: CardInstance, investigator: Investigator): boolean {
  return enemy.zone.kind === 'engaged' && enemy.zone.investigatorId === investigator.id;
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
 * location" (e.g. The Gathering's skull token). Other cards at the location,
 * such as a story asset, are left out.
 */
export function enemiesAt(
  ctx: EngineContext,
  state: GameState,
  locationId: InstanceId,
): CardInstance[] {
  return Object.values(state.cards).filter((card) => {
    const zone = card.zone;
    if (zone.kind === 'atLocation')
      return zone.locationId === locationId && cardStats(ctx.cards, card.code).typeCode === 'enemy';
    if (zone.kind !== 'engaged') return false;
    const engaged = state.investigators.find((inv) => inv.id === zone.investigatorId);
    return engaged?.locationId === locationId;
  });
}

/**
 * The enemies on the table with `trait` (any enemy without one) nearest to
 * `from`, counted in connections along each enemy's path there, engaged ones
 * where their investigator is ("the nearest [[Cultist]] enemy"). Several when
 * they are equally near, in card order; none when there is no such enemy. An
 * enemy with no path counts as farther than every enemy with one (FAQ:
 * "Even if it has no valid path to an investigator, an enemy can still
 * qualify as the 'nearest' enemy").
 */
export function nearestEnemies(
  ctx: EngineContext,
  state: GameState,
  from: InstanceId,
  trait?: Trait,
): CardInstance[] {
  const candidates = enemiesOnTable(ctx, state, trait).map((card) => {
    const [path] = shortestPaths(state, locationOf(state, card), from);
    return { card, distance: path ? path.length - 1 : Infinity };
  });
  const nearest = Math.min(...candidates.map(({ distance }) => distance));
  return candidates.filter(({ distance }) => distance === nearest).map(({ card }) => card);
}

/**
 * Which enemies on the table a card means: those with `trait` (any enemy
 * without one) and without `withoutTrait` ("each non-Nightgaunt enemy"), only
 * the unengaged ones with `unengaged`, and only those at a location of one of
 * the codes in `at` when it is given ("each Ghoul enemy in the Hallway or
 * Parlor").
 */
export interface EnemyFilter {
  trait?: Trait;
  withoutTrait?: Trait;
  unengaged?: true;
  at?: readonly CardCode[];
}

/** The enemies on the table that `filter` matches, in card order. */
export function enemiesMatching(
  ctx: EngineContext,
  state: GameState,
  filter: EnemyFilter,
): CardInstance[] {
  return enemiesOnTable(ctx, state, filter.trait).filter(
    (card) =>
      (filter.withoutTrait === undefined ||
        !cardStats(ctx.cards, card.code).traits.includes(filter.withoutTrait)) &&
      (filter.unengaged === undefined || card.zone.kind === 'atLocation') &&
      (filter.at === undefined ||
        filter.at.includes(requireCard(state.cards, locationOf(state, card)).code)),
  );
}

/**
 * The enemies on the table with `trait`, or every enemy without one, in card
 * order: "[[Cultist]] enemies in play" (`isEnemyOnTable`).
 */
export function enemiesOnTable(
  ctx: EngineContext,
  state: GameState,
  trait?: Trait,
): CardInstance[] {
  return Object.values(state.cards).filter((card) => {
    const stats = cardStats(ctx.cards, card.code);
    return (
      isEnemyOnTable(card) &&
      stats.typeCode === 'enemy' &&
      (trait === undefined || stats.traits.includes(trait))
    );
  });
}
