import { cardStats, type CardStats, type EngineContext } from './cards';
import type { Command, DealEnemyAttack, RequestDecision } from './commands';
import { decisionId, type InstanceId, type InvestigatorId } from './ids';
import { hasKeyword } from './keywords';
import type { CardInstance, Decision, GameState } from './state';

/**
 * The enemy attacks the rules force outside the enemy phase, each asked as a
 * `confirm` decision (`<kind>:<enemy>`) for the attacked investigator:
 * - `attackOfOpportunity`: an action taken while engaged with the ready enemy
 *   (`attackOfOpportunityDecisions`).
 * - `retaliate`: a failed attack against the ready retaliate enemy (`retaliateCommands`).
 * - `alert`: a failed evade against the alert enemy (`alertCommands`).
 *
 * None of them exhausts the enemy (`DealEnemyAttack`).
 */
export type ForcedAttackKind = 'attackOfOpportunity' | 'retaliate' | 'alert';

/**
 * The way out of each kind, for what the engine cannot read: a card that
 * "does not provoke attacks of opportunity", or one that cancels the attack.
 */
const SKIP_LABELS: Readonly<Record<ForcedAttackKind, string>> = {
  attackOfOpportunity: 'decision.doesNotProvoke',
  retaliate: 'decision.attackCancelled',
  alert: 'decision.attackCancelled',
};

/**
 * The decision for one forced attack of the enemy on the investigator. Its
 * `attack` option deals the enemy's printed damage and horror, which the
 * players may lower (assets soak part of it) through
 * `ResolveDecision.amounts`; `skip` deals nothing.
 */
export function forcedAttackDecision(
  ctx: EngineContext,
  state: GameState,
  kind: ForcedAttackKind,
  enemyId: InstanceId,
  investigatorId: InvestigatorId,
): Decision {
  const { damage = 0, horror = 0 } = cardStats(ctx.cards, state.cards[enemyId]?.code ?? '');
  const attack: DealEnemyAttack = {
    type: 'DealEnemyAttack',
    enemyId,
    investigatorId,
    damage,
    horror,
  };
  return {
    id: decisionId(`${kind}:${enemyId}`),
    kind: 'confirm',
    subject: enemyId,
    prompt: `decision.${kind}`,
    decider: { kind: 'investigator', investigatorId },
    options: [
      {
        id: 'attack',
        label: 'decision.attack',
        commands: [attack],
        amounts: { damage: { default: damage, min: 0 }, horror: { default: horror, min: 0 } },
      },
      { id: 'skip', label: SKIP_LABELS[kind], commands: [] },
    ],
  };
}

/**
 * Rules Reference, "Retaliate": after an investigator fails an attack against
 * a ready retaliate enemy, and after the test's other results, the enemy
 * attacks that investigator, engaged with them or not. Belongs at the end of
 * a fight's fail commands. Readiness is read when the fight starts: nothing
 * but a `ManualAdjust` can change it while the test is pending.
 */
export function retaliateCommands(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  stats: CardStats,
  investigatorId: InvestigatorId,
): RequestDecision[] {
  if (!hasKeyword(stats, 'retaliate') || enemy.exhausted) return [];
  return [attackRequest(ctx, state, 'retaliate', enemy.id, investigatorId)];
}

/**
 * Rules Reference, "Alert": after an investigator fails to evade a ready
 * alert enemy (the 2026 Core rulebook names "ready"; the older Rules
 * Reference text does not), and after the test's other results, the enemy
 * attacks that investigator, engaged with them or not. Belongs at the end of
 * an evade's fail commands; readiness is read when the evade starts, as for
 * retaliate.
 */
export function alertCommands(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  stats: CardStats,
  investigatorId: InvestigatorId,
): RequestDecision[] {
  if (!hasKeyword(stats, 'alert') || enemy.exhausted) return [];
  return [attackRequest(ctx, state, 'alert', enemy.id, investigatorId)];
}

function attackRequest(
  ctx: EngineContext,
  state: GameState,
  kind: ForcedAttackKind,
  enemyId: InstanceId,
  investigatorId: InvestigatorId,
): RequestDecision & Command {
  return {
    type: 'RequestDecision',
    decision: forcedAttackDecision(ctx, state, kind, enemyId, investigatorId),
  };
}
