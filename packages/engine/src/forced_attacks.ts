import { cardStats, type CardStats, type EngineContext } from './cards';
import type { RequestDecision } from './commands';
import { decisionId, type InstanceId, type InvestigatorId } from './ids';
import { requireCard } from './lookup';
import { hasKeyword } from './keywords';
import type { CardInstance, Decision, GameState } from './state';

/**
 * The enemy attacks the rules force outside the enemy phase, each asked as a
 * `confirm` decision (`<kind>:<enemy>`) for the attacked investigator:
 * - `attackOfOpportunity`: an action taken while engaged with the ready enemy
 *   (`attackOfOpportunityDecisions`).
 * - `retaliate`: a failed attack against the ready retaliate enemy (`keywordAttackCommands`).
 * - `alert`: a failed evade against the ready alert enemy (`keywordAttackCommands`).
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
  const { damage = 0, horror = 0 } = cardStats(ctx.cards, requireCard(state.cards, enemyId).code);
  return {
    id: decisionId(`${kind}:${enemyId}`),
    kind: 'confirm',
    subject: enemyId,
    prompt: forcedAttackPrompt(kind),
    decider: { kind: 'investigator', investigatorId },
    options: [
      {
        id: 'attack',
        label: 'decision.attack',
        commands: [
          {
            type: 'DealEnemyAttack',
            enemyId,
            investigatorId,
            damage: { answer: 'damage' },
            horror: { answer: 'horror' },
          },
        ],
        amounts: { damage: { default: damage, min: 0 }, horror: { default: horror, min: 0 } },
      },
      { id: 'skip', label: SKIP_LABELS[kind], commands: [] },
    ],
  };
}

/** The prompt of a `forcedAttackDecision` of `kind`, so views can tell which forced attack asks. */
export function forcedAttackPrompt(kind: ForcedAttackKind): string {
  return `decision.${kind}`;
}

/** The forced attacks a keyword triggers after a failed test; the kind is also the keyword's name. */
export type KeywordAttackKind = Extract<ForcedAttackKind, 'retaliate' | 'alert'>;

/**
 * Rules Reference, "Retaliate" and "Alert": after an investigator fails a
 * fight (retaliate) or an evade (alert) against a ready enemy with that
 * keyword, and after the test's other results, the enemy attacks that
 * investigator, engaged with them or not. The 2026 Core rulebook requires a
 * ready enemy for both; the older Rules Reference text leaves it out for
 * alert. Belongs at the end of the test's fail commands, which are computed
 * as the answer arrives (`testedActionCommands`), so readiness is read then.
 */
export function keywordAttackCommands(
  ctx: EngineContext,
  state: GameState,
  kind: KeywordAttackKind,
  enemy: CardInstance,
  stats: CardStats,
  investigatorId: InvestigatorId,
): RequestDecision[] {
  if (!hasKeyword(stats, kind) || enemy.exhausted) return [];
  return [
    {
      type: 'RequestDecision',
      decision: forcedAttackDecision(ctx, state, kind, enemy.id, investigatorId),
    },
  ];
}
