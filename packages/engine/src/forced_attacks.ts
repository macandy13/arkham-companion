import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import { decisionId, type DecisionId, type InstanceId, type InvestigatorId } from './ids';
import { requireCard } from './lookup';
import type { Decision, GameState } from './state';

/**
 * Every enemy attack the engine asks the attacked investigator about, each a `confirm` decision
 * (`attackDecision`) whose `attack` option deals the damage and horror and whose `skip` is the way
 * out for what the engine cannot read:
 * - `enemyPhase`: one attack of enemy step 3.3 (`DueAttack`); the enemy exhausts after its last
 *   due attack, cancelled or not (`ResolveEnemyAttack`, Dodge FAQ).
 * - `attackOfOpportunity`: an action taken while engaged with the ready enemy
 *   (`attackOfOpportunityDecisions`); `skip` is a card that "does not provoke".
 * - `retaliate`: a failed attack against the ready retaliate enemy (`KeywordAttackKind`).
 * - `alert`: a failed evade against the ready alert enemy (`KeywordAttackKind`).
 * - `cardAttack`: a card that says the enemy attacks (`EnemyAttacks`).
 *
 * None but `enemyPhase` exhausts the enemy (`DealEnemyAttack`).
 */
export type AttackKind =
  'enemyPhase' | 'attackOfOpportunity' | 'retaliate' | 'alert' | 'cardAttack';

/** The attacks the rules force outside the enemy phase. */
export type ForcedAttackKind = Exclude<AttackKind, 'enemyPhase'>;

/** How each kind of attack is asked: its prompt and the label of its way out. */
const ASKED: Readonly<Record<AttackKind, { prompt: string; skip: string }>> = {
  enemyPhase: { prompt: 'decision.enemyAttack', skip: 'decision.attackCancelled' },
  attackOfOpportunity: {
    prompt: 'decision.attackOfOpportunity',
    skip: 'decision.doesNotProvoke',
  },
  retaliate: { prompt: 'decision.retaliate', skip: 'decision.attackCancelled' },
  alert: { prompt: 'decision.alert', skip: 'decision.attackCancelled' },
  cardAttack: { prompt: 'decision.cardAttack', skip: 'decision.attackCancelled' },
};

/**
 * The decision for one attack of `kind` of the enemy on the investigator. Its `attack` option
 * deals the enemy's printed damage and horror, which the players may lower (assets soak part of
 * it) through `ResolveDecision.amounts`. `skip` deals nothing; an enemy phase attack is still
 * resolved by it, cancelled, so that the enemy exhausts.
 */
export function attackDecision(
  ctx: EngineContext,
  state: GameState,
  kind: AttackKind,
  enemyId: InstanceId,
  investigatorId: InvestigatorId,
): Decision {
  const asked = ASKED[kind];
  return {
    id: attackDecisionId(kind, enemyId, investigatorId),
    kind: 'confirm',
    subject: enemyId,
    prompt: asked.prompt,
    decider: { kind: 'investigator', investigatorId },
    options: [
      {
        id: 'attack',
        label: 'decision.attack',
        commands: [
          kind === 'enemyPhase'
            ? {
                type: 'ResolveEnemyAttack',
                enemyId,
                investigatorId,
                damage: { answer: 'damage' },
                horror: { answer: 'horror' },
              }
            : {
                type: 'DealEnemyAttack',
                enemyId,
                investigatorId,
                damage: { answer: 'damage' },
                horror: { answer: 'horror' },
              },
        ],
        amounts: printedAttack(ctx, state, enemyId),
      },
      {
        id: 'skip',
        label: asked.skip,
        commands:
          kind === 'enemyPhase'
            ? [{ type: 'ResolveEnemyAttack', enemyId, investigatorId, cancelled: true }]
            : [],
      },
    ],
  };
}

/**
 * The id of the `attackDecision` of `kind` about the enemy and the investigator. An enemy phase
 * or card attack names both, since a massive enemy or "attacks each investigator at its location"
 * asks several investigators about one enemy; the others name the enemy only, as one enemy makes
 * at most one such attack at a time.
 */
export function attackDecisionId(
  kind: AttackKind,
  enemyId: InstanceId,
  investigatorId: InvestigatorId,
): DecisionId {
  switch (kind) {
    case 'enemyPhase':
      return decisionId(`enemyAttack:${enemyId}:${investigatorId}`);
    case 'cardAttack':
      return decisionId(`cardAttack:${enemyId}:${investigatorId}`);
    case 'attackOfOpportunity':
    case 'retaliate':
    case 'alert':
      return decisionId(`${kind}:${enemyId}`);
    default:
      return assertNever(kind);
  }
}

/**
 * Whether `decision` is an enemy attack on an investigator (`attackDecision`), whose `skip`
 * option is the attack cancelled (Dodge): its `attack` option deals the attack.
 */
export function isEnemyAttackDecision(decision: Pick<Decision, 'options'>): boolean {
  return decision.options.some((option) =>
    option.commands.some(
      (command) => command.type === 'DealEnemyAttack' || command.type === 'ResolveEnemyAttack',
    ),
  );
}

/** The prompt of an `attackDecision` of `kind`, so views can tell which attack asks. */
export function attackPrompt(kind: AttackKind): string {
  return ASKED[kind].prompt;
}

/** The enemy's printed damage and horror, as the amounts an attack option starts from. */
function printedAttack(ctx: EngineContext, state: GameState, enemyId: InstanceId) {
  const { damage = 0, horror = 0 } = cardStats(ctx.cards, requireCard(state.cards, enemyId).code);
  return { damage: { default: damage, min: 0 }, horror: { default: horror, min: 0 } };
}

/**
 * The forced attacks a keyword triggers after a failed test; the kind is also the keyword's name.
 * Rules Reference, "Retaliate" and "Alert": after an investigator fails a fight (retaliate) or an
 * evade (alert) against a ready enemy with that keyword, and after applying all results of the
 * test, the enemy attacks that investigator, engaged with them or not (`keywordAbilities`, an
 * `EnemyAttacks` with its `keyword`). The 2026 Core rulebook requires a ready enemy for both; the
 * older Rules Reference text leaves it out for alert.
 */
export type KeywordAttackKind = Extract<ForcedAttackKind, 'retaliate' | 'alert'>;
