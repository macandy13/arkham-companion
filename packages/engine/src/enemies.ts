import { cardStats, type EngineContext } from './cards';
import type { InstanceId, InvestigatorId } from './ids';
import { hasKeyword } from './keywords';
import type { GameState } from './state';
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
 * investigators in seat order (the order of `state.investigators`), and for
 * each the ready enemies engaged with them, then ready massive enemies at their
 * location. A massive enemy is not in the `engaged` zone (it is engaged with
 * everyone at its location at once, which one zone cannot express), which is
 * why it is added here. Exhausted enemies and defeated or resigned
 * investigators produce no attacks. The players still order simultaneous
 * attacks of one investigator; the list only gives a stable default.
 */
export function enemyAttackList(ctx: EngineContext, state: GameState): EnemyAttack[] {
  return state.investigators
    .filter((investigator) => investigator.status === 'active')
    .flatMap((investigator) =>
      readyAttackers(ctx, state, investigator.id, investigator.locationId).map((enemyId) => {
        const stats = cardStats(ctx.cards, state.cards[enemyId]?.code ?? '');
        return {
          enemyId,
          investigatorId: investigator.id,
          damage: stats.damage ?? 0,
          horror: stats.horror ?? 0,
        };
      }),
    );
}

function readyAttackers(
  ctx: EngineContext,
  state: GameState,
  investigatorId: InvestigatorId,
  locationId: InstanceId | undefined,
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
