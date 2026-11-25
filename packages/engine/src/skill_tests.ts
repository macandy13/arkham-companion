import { takeDamage } from './abilities';
import { effectiveValue, modifiedValue, type CardValue } from './modifiers';
import type { EngineContext } from './cards';
import type { EndSkillTest, Evade, FailedAttack, Fight, Investigate, TestSkill } from './commands';
import { requestDecision, skillTestDecision, type SkillTestOutcomes } from './decisions';
import type { DecisionRequested, Event, SkillTestEnded } from './events';
import { handleTakeDamageAndHorror } from './handle_investigator';
import { enemyOf, isEngagedWith, isEnemyOnTable, locationOf } from './enemies';
import { activeInvestigator, findInvestigator } from './investigators';
import { decisionId, type InstanceId } from './ids';
import { cardHasKeyword } from './card_keywords';
import { requireCard } from './lookup';
import { requireLocationInPlay } from './board';
import { CommandRejected } from './rejection';
import { isRestricted } from './restrictions';
import { withSuggestion } from './skill_modifiers';
import type {
  AmountRange,
  AnswerableCommand,
  CardInstance,
  Decision,
  GameState,
  Investigator,
  SkillName,
  SkillTest,
  SkillTestOutcome,
} from './state';

/**
 * A `skill` test against `value` of `card` now (`effectiveValue`), with the printed value and the
 * cards in play that changed it (`modifiedValue`), so the trace names each card.
 */
function testAgainst(
  ctx: EngineContext,
  state: GameState,
  skill: SkillName,
  card: CardInstance,
  value: CardValue,
): SkillTest {
  const modifiedFrom = modifiedValue(ctx, state, card, value);
  return {
    skill,
    difficulty: effectiveValue(ctx, state, card, value),
    ...(modifiedFrom.changes.length > 0 ? { modifiedFrom } : {}),
  };
}

/**
 * `Investigate`: an intellect test against the shroud of the investigator's
 * location, or of `locationId` in play when a card investigates another one (`testAgainst`,
 * constant abilities included). A pass discovers 1 clue unless the players confirm another count,
 * up to the clues on the location when the test starts (`investigationDiscovery`). A location
 * without clues makes the count not adjustable. Rejected at a location a card forbids
 * investigating (`isRestricted`, Locked Door).
 */
export function handleInvestigate(
  ctx: EngineContext,
  state: GameState,
  cmd: Investigate,
): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const location =
    cmd.locationId === undefined
      ? investigatorLocation(state, investigator)
      : requireLocationInPlay(state, cmd.locationId);
  if (
    cmd.locationId !== undefined &&
    cmd.locationId !== investigator.locationId &&
    !location.faceUp
  )
    throw new CommandRejected({ code: 'locationUnrevealed', cardId: location.id });
  if (isRestricted(ctx, state, location, 'investigate'))
    throw new CommandRejected({
      code: 'restricted',
      cannot: 'investigate',
      locationId: location.id,
    });
  const clues = location.tokens.clue ?? 0;
  const discovery: AnswerableCommand = {
    type: 'DiscoverClues',
    investigatorId: investigator.id,
    locationId: location.id,
    amount: clues > 0 ? { answer: 'amount' } : 1,
    investigation: true,
  };
  return skillTest(ctx, state, {
    investigator,
    id: `investigate:${investigator.id}`,
    prompt: 'decision.investigate',
    subject: location.id,
    test: { ...testAgainst(ctx, state, 'intellect', location, 'shroud'), action: 'investigate' },
    ...(clues > 0 ? { passAmount: { default: 1, min: 1, max: clues } } : {}),
    outcomes: { onPass: [discovery], onFail: [] },
  });
}

/**
 * `Fight`: a combat test against the fight value of an enemy at the
 * investigator's location (anywhere with `atAnyLocation`). A pass deals `damage` (1 for the basic
 * attack) unless the players confirm another amount; a fail deals it to the other investigator
 * the enemy is engaged with, if any (`FailedAttack`). Retaliate and elusive act after these
 * results, when the test ends (`keywordAbilities`).
 */
export function handleFight(ctx: EngineContext, state: GameState, cmd: Fight): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { enemy } = enemyOf(ctx, state, cmd.enemyId);
  if (!isEnemyOnTable(enemy))
    throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
  const enemyLocation = locationOf(state, enemy);
  if (!cmd.atAnyLocation && enemyLocation !== investigator.locationId)
    throw new CommandRejected({
      code: 'investigatorNotAtLocation',
      investigatorId: investigator.id,
      locationId: enemyLocation,
    });
  if (!cmd.ignoreAloof && isUnengagedAloof(ctx, state, enemy))
    throw new CommandRejected({ code: 'aloofNotEngaged', cardId: enemy.id });
  const damage = cmd.damage ?? 1;
  if (!Number.isInteger(damage) || damage <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: damage });
  return skillTest(ctx, state, {
    investigator,
    id: `fight:${investigator.id}:${enemy.id}`,
    prompt: 'decision.fight',
    subject: enemy.id,
    test: { ...testAgainst(ctx, state, 'combat', enemy, 'fight'), action: 'fight' },
    passAmount: { default: damage, min: 1 },
    outcomes: {
      onPass: [{ type: 'DamageEnemy', enemyId: enemy.id, amount: { answer: 'amount' } }],
      onFail: [
        { type: 'FailedAttack', investigatorId: investigator.id, enemyId: enemy.id, damage },
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
function isUnengagedAloof(ctx: EngineContext, state: GameState, enemy: CardInstance): boolean {
  return (
    cardHasKeyword(ctx, state, enemy, 'aloof') &&
    enemy.zone.kind !== 'engaged' &&
    !cardHasKeyword(ctx, state, enemy, 'massive')
  );
}

/**
 * `FailedAttack`: failing against an enemy engaged with another single investigator deals the
 * attack's damage to that investigator, as a `TakeDamageAndHorror`, so the usual defeat check
 * applies. A massive enemy is never in the `engaged` zone (it is engaged with several
 * investigators), so it is not redirected, nor is an enemy that is unengaged or engaged with the
 * fighter.
 */
export function handleFailedAttack(
  ctx: EngineContext,
  state: GameState,
  { investigatorId, enemyId, damage }: FailedAttack,
): Event[] {
  const { enemy } = enemyOf(ctx, state, enemyId);
  if (enemy.zone.kind !== 'engaged' || enemy.zone.investigatorId === investigatorId) return [];
  const engaged = findInvestigator(state, enemy.zone.investigatorId);
  if (engaged?.status !== 'active') return [];
  return handleTakeDamageAndHorror(ctx, state, takeDamage(damage, engaged.id));
}

/**
 * `Evade`: an agility test against the evade value of an enemy engaged with
 * the investigator (a massive enemy at their location counts, see
 * `enemyAttackList`), or of any enemy on the table with `atAnyLocation`. A pass evades it.
 */
export function handleEvade(ctx: EngineContext, state: GameState, cmd: Evade): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { enemy } = enemyOf(ctx, state, cmd.enemyId);
  const massiveHere =
    enemy.zone.kind === 'atLocation' &&
    enemy.zone.locationId === investigator.locationId &&
    cardHasKeyword(ctx, state, enemy, 'massive');
  if (cmd.atAnyLocation) {
    if (!isEnemyOnTable(enemy))
      throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
  } else if (!isEngagedWith(enemy, investigator) && !massiveHere)
    throw new CommandRejected({ code: 'notEngaged', cardId: enemy.id });
  return skillTest(ctx, state, {
    investigator,
    id: `evade:${investigator.id}:${enemy.id}`,
    prompt: 'decision.evade',
    subject: enemy.id,
    test: { ...testAgainst(ctx, state, 'agility', enemy, 'evade'), action: 'evade' },
    outcomes: {
      onPass: [
        {
          type: 'EvadeEnemy',
          enemyId: enemy.id,
          investigatorId: investigator.id,
          successful: true,
        },
      ],
      onFail: [],
    },
  });
}

/**
 * `EndSkillTest`: marks the end of the test (`SkillTestEnded`), which opens `testEnded` for the
 * subject.
 */
export function handleEndSkillTest(
  _ctx: EngineContext,
  _state: GameState,
  { investigatorId, subject, action, outcome }: EndSkillTest,
): SkillTestEnded[] {
  return [{ type: 'SkillTestEnded', investigatorId, subject, action, outcome }];
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
    outcomes: {
      onPass: [...cmd.onPass],
      onFail: [...cmd.onFail],
    },
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
  /**
   * Makes the pass of an action's test a count the players confirm (clues
   * discovered, damage dealt), which fills in its `{ answer: 'amount' }` (`DecisionOption.amount`).
   */
  passAmount?: AmountRange;
  outcomes: SkillTestOutcomes;
}

/**
 * The `skillTestResult` decision of a test, answered by the investigator
 * taking it, with the suggested modified values (`withSuggestion`). The test of a basic action
 * ends after each outcome's results (`EndSkillTest`, ST.8).
 */
function skillTest(
  ctx: EngineContext,
  state: GameState,
  { investigator, id, prompt, subject, test, passAmount, outcomes }: SkillTestRequest,
): DecisionRequested[] {
  const ended = (outcome: SkillTestOutcome): AnswerableCommand[] =>
    test.action === undefined
      ? []
      : [
          {
            type: 'EndSkillTest',
            investigatorId: investigator.id,
            subject,
            action: test.action,
            outcome,
          },
        ];
  const asked = skillTestDecision(
    {
      id: decisionId(id),
      prompt,
      subject,
      decider: { kind: 'investigator', investigatorId: investigator.id },
      test,
    },
    {
      onPass: [...outcomes.onPass, ...ended('pass')],
      onFail: [...outcomes.onFail, ...ended('fail')],
    },
  );
  const decision: Decision = {
    ...asked,
    options: asked.options.map((option) =>
      passAmount && option.id === 'pass' ? { ...option, amount: passAmount } : option,
    ),
  };
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
