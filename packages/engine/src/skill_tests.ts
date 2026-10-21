import { locationAttachments, locationShroud } from './board';
import type { CardStats, EngineContext } from './cards';
import type { Command, Evade, Fight, Investigate, TestSkill } from './commands';
import { requestDecision, skillTestDecision, type SkillTestOutcomes } from './decisions';
import type { DecisionRequested } from './events';
import { keywordAttackCommands } from './forced_attacks';
import { enemyOf, isInPlay, locationOf } from './handle_enemy';
import { activeInvestigator } from './handle_investigator';
import { decisionId, type InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { requireCard } from './lookup';
import { discardToTop } from './placement';
import { CommandRejected } from './rejection';
import { withSuggestion } from './skill_modifiers';
import type { CardInstance, GameState, Investigator, SkillTest } from './state';

/**
 * `Investigate`: an intellect test against the shroud of the investigator's
 * location (`locationShroud`, attachments included). A pass discovers 1 clue
 * unless the players confirm another count (cards that discover more, or more
 * on a good result), up to the clues on the location. A location without
 * clues left makes the pass do nothing rather than fail the answer. A pass
 * also discards the attachments that leave after a successful investigation
 * (`LocationAttachment.discardWhenInvestigated`), after the clues, as their
 * "After … is successfully investigated" says.
 */
export function handleInvestigate(
  ctx: EngineContext,
  state: GameState,
  cmd: Investigate,
): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const location = investigatorLocation(state, investigator);
  const clues = location.tokens.clue ?? 0;
  const discoverClues: Pick<SkillTestOutcomes, 'onPass' | 'passAmount'> =
    clues > 0
      ? {
          onPass: [
            {
              type: 'DiscoverClues',
              investigatorId: investigator.id,
              locationId: location.id,
              amount: 1,
            },
          ],
          passAmount: { default: 1, min: 1, max: clues },
        }
      : { onPass: [] };
  const discardAttachments: Command[] = locationAttachments(ctx, state, location)
    .filter(({ attachment }) => attachment.discardWhenInvestigated)
    .map(({ card }) => discardToTop(card.id));
  return skillTest(ctx, state, {
    investigator,
    id: `investigate:${investigator.id}`,
    prompt: 'decision.investigate',
    subject: location.id,
    test: { skill: 'intellect', difficulty: locationShroud(ctx, state, location) },
    outcomes: {
      ...discoverClues,
      onPass: [...discoverClues.onPass, ...discardAttachments],
      onFail: [],
    },
  });
}

/**
 * `Fight`: a combat test against the fight value of an enemy at the
 * investigator's location. A pass deals the attack's damage (`DamageEnemy`):
 * `damage` (1 for the basic attack) unless the players confirm another
 * amount. A fail deals that damage to the other investigator the enemy is
 * engaged with, if any (see `failedFightCommands`), and then lets a ready
 * retaliate enemy attack the fighter (`keywordAttackCommands`).
 */
export function handleFight(ctx: EngineContext, state: GameState, cmd: Fight): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { enemy, stats } = enemyOf(ctx, state, cmd.enemyId);
  if (!isInPlay(enemy)) throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
  const enemyLocation = locationOf(state, enemy);
  if (enemyLocation !== investigator.locationId)
    throw new CommandRejected({
      code: 'investigatorNotAtLocation',
      investigatorId: investigator.id,
      locationId: enemyLocation,
    });
  if (isUnengagedAloof(enemy, stats))
    throw new CommandRejected({ code: 'aloofNotEngaged', cardId: enemy.id });
  const damage = cmd.damage ?? 1;
  if (!Number.isInteger(damage) || damage <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: damage });
  return skillTest(ctx, state, {
    investigator,
    id: `fight:${investigator.id}:${enemy.id}`,
    prompt: 'decision.fight',
    subject: enemy.id,
    test: { skill: 'combat', difficulty: stats.fight ?? 0 },
    outcomes: {
      onPass: [{ type: 'DamageEnemy', enemyId: enemy.id, amount: damage }],
      passAmount: { default: damage, min: 1 },
      onFail: [
        ...failedFightCommands(state, investigator, enemy, damage),
        ...keywordAttackCommands(ctx, state, 'retaliate', enemy, stats, investigator.id),
      ],
    },
  });
}

/**
 * Rules Reference, "Aloof": an aloof enemy cannot be attacked while it is not
 * engaged with an investigator, though anyone at its location may attack it
 * once it is. A massive enemy counts as engaged with everyone at its location,
 * so it is never unengaged even though it is not in the `engaged` zone.
 */
function isUnengagedAloof(enemy: CardInstance, stats: CardStats): boolean {
  return (
    hasKeyword(stats, 'aloof') && enemy.zone.kind !== 'engaged' && !hasKeyword(stats, 'massive')
  );
}

/**
 * Rules Reference, "Fight": failing against an enemy engaged with another
 * single investigator deals the attack's damage to that investigator, through
 * `AdjustInvestigator` so the usual defeat check applies. A massive enemy is
 * never in the `engaged` zone (it is engaged with several investigators), so it
 * is not redirected, nor is an enemy that is unengaged or engaged with the
 * fighter.
 */
function failedFightCommands(
  state: GameState,
  fighter: Investigator,
  enemy: CardInstance,
  damage: number,
): Command[] {
  if (enemy.zone.kind !== 'engaged' || enemy.zone.investigatorId === fighter.id) return [];
  const engagedId = enemy.zone.investigatorId;
  const engaged = state.investigators.find((inv) => inv.id === engagedId);
  if (engaged?.status !== 'active') return [];
  return [
    { type: 'AdjustInvestigator', investigatorId: engaged.id, stat: 'damage', delta: damage },
  ];
}

/**
 * `Evade`: an agility test against the evade value of an enemy engaged with
 * the investigator (a massive enemy at their location counts, see
 * `enemyAttackList`). A pass exhausts and disengages it; a massive enemy only
 * exhausts, since it is never in the `engaged` zone. A fail lets an alert
 * enemy attack the evader (`keywordAttackCommands`).
 */
export function handleEvade(ctx: EngineContext, state: GameState, cmd: Evade): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { enemy, stats } = enemyOf(ctx, state, cmd.enemyId);
  const engaged = enemy.zone.kind === 'engaged' && enemy.zone.investigatorId === investigator.id;
  const massiveHere =
    enemy.zone.kind === 'atLocation' &&
    enemy.zone.locationId === investigator.locationId &&
    hasKeyword(stats, 'massive');
  if (!engaged && !massiveHere) throw new CommandRejected({ code: 'notEngaged', cardId: enemy.id });
  const onPass: Command[] = [
    ...(enemy.exhausted ? [] : [{ type: 'ExhaustEnemy', enemyId: enemy.id } as const]),
    ...(engaged ? [{ type: 'DisengageEnemy', enemyId: enemy.id } as const] : []),
  ];
  return skillTest(ctx, state, {
    investigator,
    id: `evade:${investigator.id}:${enemy.id}`,
    prompt: 'decision.evade',
    subject: enemy.id,
    test: { skill: 'agility', difficulty: stats.evade ?? 0 },
    outcomes: {
      onPass,
      onFail: keywordAttackCommands(ctx, state, 'alert', enemy, stats, investigator.id),
    },
  });
}

/**
 * `TestSkill`: the test a card asks of an investigator, as a decision about
 * the card (`test:<card>`) for that investigator, who must still be in the
 * scenario.
 */
export function handleTestSkill(
  ctx: EngineContext,
  state: GameState,
  cmd: TestSkill,
): DecisionRequested[] {
  const card = requireCard(state.cards, cmd.cardId);
  return skillTest(ctx, state, {
    investigator: activeInvestigator(state, cmd.investigatorId),
    id: `test:${card.id}`,
    prompt: 'decision.cardTest',
    subject: card.id,
    test: cmd.test,
    outcomes: { onPass: [...cmd.onPass], onFail: [...cmd.onFail] },
  });
}

/** What `skillTest` turns into a decision. */
interface SkillTestRequest {
  /** Who takes the test and answers it. */
  investigator: Investigator;
  id: string;
  prompt: string;
  subject: InstanceId;
  test: SkillTest;
  outcomes: SkillTestOutcomes;
}

/**
 * The `skillTestResult` decision of a test, answered by the investigator
 * taking it, with the suggested modified values (`withSuggestion`).
 */
function skillTest(
  ctx: EngineContext,
  state: GameState,
  { investigator, id, prompt, subject, test, outcomes }: SkillTestRequest,
): DecisionRequested[] {
  const decision = skillTestDecision(
    {
      id: decisionId(id),
      prompt,
      subject,
      decider: { kind: 'investigator', investigatorId: investigator.id },
      test,
    },
    outcomes,
  );
  return requestDecision(state, withSuggestion(ctx, state, decision));
}

function investigatorLocation(state: GameState, investigator: Investigator): CardInstance {
  const location =
    investigator.locationId === undefined ? undefined : state.cards[investigator.locationId];
  if (!location)
    throw new CommandRejected({
      code: 'investigatorHasNoLocation',
      investigatorId: investigator.id,
    });
  return location;
}
