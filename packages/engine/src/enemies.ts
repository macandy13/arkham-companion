import { cardStats, type EngineContext } from './cards';
import { investigatorLeavesEvents } from './elimination';
import type { Event, InvestigatorChanged } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import { requireCard } from './lookup';
import { defeatCause, playerOrder, withStatDelta } from './investigators';
import { hasKeyword } from './keywords';
import { CommandRejected } from './rejection';
import type { GameState, Investigator } from './state';
import { zoneKey } from './zone';

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
  const engaged = state.order[zoneKey({ kind: 'engaged', investigatorId })] ?? [];
  const unengaged =
    locationId === undefined
      ? []
      : (state.order[zoneKey({ kind: 'atLocation', locationId })] ?? []);
  const massive = unengaged.filter((id) => {
    const code = state.cards[id]?.code;
    const stats = code === undefined ? undefined : ctx.cards.get(code);
    return stats?.typeCode === 'enemy' && hasKeyword(stats, 'massive');
  });
  return [...engaged, ...massive].filter((id) => state.cards[id]?.exhausted === false);
}

/**
 * Damage and horror of one enemy attack, followed by a single defeat check
 * over both, as the rules deal them simultaneously, and on a defeat the
 * clean-up (`investigatorLeavesEvents`). Shared by the enemy phase
 * (`ResolveEnemyAttack`) and attacks outside it (`DealEnemyAttack`), so an
 * attack of opportunity that defeats leaves the same board.
 * Rejects an amount that is not a non-negative integer.
 */
export function enemyAttackEvents(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  damage: number,
  horror: number,
): Event[] {
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
  if (cause === undefined) return changes;
  return [
    ...changes,
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
