import { assertNever } from '@arkham/util';
import { effectiveValue } from './card_values';
import type { CardStats, EngineContext } from './cards';
import type { Command, Evade, Fight, Investigate, TestSkill } from './commands';
import {
  answerOutcome,
  pendingDecision,
  requestDecision,
  skillTestDecision,
  type SkillTestOutcomes,
} from './decisions';
import type { DecisionRequested } from './events';
import { keywordAttackCommands } from './forced_attacks';
import { enemyOf, isEnemyOnTable, locationOf } from './enemies';
import { activeInvestigator } from './investigators';
import { decisionId, type InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import { isRestricted } from './restrictions';
import { withSuggestion } from './skill_modifiers';
import type {
  AmountRange,
  CardInstance,
  Decision,
  GameState,
  Investigator,
  SkillTest,
  SkillTestKind,
  SkillTestOutcome,
} from './state';

/**
 * `Investigate`: an intellect test against the shroud of the investigator's
 * location (`effectiveValue`, constant abilities included). Its consequences follow
 * the answer (`investigateCommands`); a pass discovers 1 clue unless the
 * players confirm another count, up to the clues on the location when the
 * test starts. A location without clues makes the count not adjustable. Rejected at a location
 * a card forbids investigating (`isRestricted`, Locked Door).
 */
export function handleInvestigate(
  ctx: EngineContext,
  state: GameState,
  cmd: Investigate,
): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const location = investigatorLocation(state, investigator);
  if (isRestricted(ctx, state, location, 'investigate'))
    throw new CommandRejected({
      code: 'restricted',
      cannot: 'investigate',
      locationId: location.id,
    });
  const clues = location.tokens.clue ?? 0;
  return skillTest(ctx, state, {
    investigator,
    id: `investigate:${investigator.id}`,
    prompt: 'decision.investigate',
    subject: location.id,
    test: { skill: 'intellect', difficulty: effectiveValue(ctx, state, location, 'shroud') },
    testKind: { kind: 'investigate', locationId: location.id },
    ...(clues > 0 ? { passAmount: { default: 1, min: 1, max: clues } } : {}),
    outcomes: { onPass: [], onFail: [] },
  });
}

/**
 * `Fight`: a combat test against the fight value of an enemy at the
 * investigator's location. Its consequences follow the answer
 * (`fightCommands`); a pass deals `damage` (1 for the basic attack) unless
 * the players confirm another amount.
 */
export function handleFight(ctx: EngineContext, state: GameState, cmd: Fight): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { enemy, stats } = enemyOf(ctx, state, cmd.enemyId);
  if (!isEnemyOnTable(enemy))
    throw new CommandRejected({ code: 'enemyNotInPlay', cardId: enemy.id });
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
    test: { skill: 'combat', difficulty: effectiveValue(ctx, state, enemy, 'fight') },
    testKind: { kind: 'fight', enemyId: enemy.id, damage },
    passAmount: { default: damage, min: 1 },
    outcomes: { onPass: [], onFail: [] },
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
 * `enemyAttackList`). Its consequences follow the answer (`evadeCommands`).
 */
export function handleEvade(ctx: EngineContext, state: GameState, cmd: Evade): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { enemy, stats } = enemyOf(ctx, state, cmd.enemyId);
  const massiveHere =
    enemy.zone.kind === 'atLocation' &&
    enemy.zone.locationId === investigator.locationId &&
    hasKeyword(stats, 'massive');
  if (!isEngagedWith(enemy, investigator) && !massiveHere)
    throw new CommandRejected({ code: 'notEngaged', cardId: enemy.id });
  return skillTest(ctx, state, {
    investigator,
    id: `evade:${investigator.id}:${enemy.id}`,
    prompt: 'decision.evade',
    subject: enemy.id,
    test: { skill: 'agility', difficulty: effectiveValue(ctx, state, enemy, 'evade') },
    testKind: { kind: 'evade', enemyId: enemy.id },
    outcomes: { onPass: [], onFail: [] },
  });
}

function isEngagedWith(enemy: CardInstance, investigator: Investigator): boolean {
  return enemy.zone.kind === 'engaged' && enemy.zone.investigatorId === investigator.id;
}

/**
 * The commands that follow the answer `command` to the skill test of a basic
 * action (`Decision.testKind`), computed from `state` as the answer arrives
 * rather than when the test started, so they act on the table as it is then.
 * Nothing for any other command or decision: their options carry their
 * commands (`answerCommands`). The amount was checked against the option's
 * range by `handleResolveDecision` before this runs.
 */
export function testedActionCommands(
  ctx: EngineContext,
  state: GameState,
  command: Command,
): Command[] {
  if (command.type !== 'ResolveDecision') return [];
  const decision = pendingDecision(state, command.decisionId);
  if (!decision?.testKind || decision.decider.kind !== 'investigator') return [];
  const investigator = activeInvestigator(state, decision.decider.investigatorId);
  const answer: TestAnswer = {
    outcome: answerOutcome(command),
    ...(command.amount === undefined ? {} : { amount: command.amount }),
  };
  const kind = decision.testKind;
  switch (kind.kind) {
    case 'investigate':
      return investigateCommands(state, investigator, kind.locationId, answer);
    case 'fight':
      return fightCommands(ctx, state, investigator, kind, answer);
    case 'evade':
      return evadeCommands(ctx, state, investigator, kind.enemyId, answer);
    default:
      return assertNever(kind);
  }
}

/** The outcome of an action's skill test and the count the players confirmed for a pass, if any. */
interface TestAnswer {
  outcome: SkillTestOutcome;
  amount?: number;
}

/**
 * A passed investigation discovers the confirmed number of clues (1 by
 * default), at most the clues the location has left as the answer arrives
 * (a correction may have taken some off since the test started). A fail
 * does nothing.
 */
function investigateCommands(
  state: GameState,
  investigator: Investigator,
  locationId: InstanceId,
  { outcome, amount = 1 }: TestAnswer,
): Command[] {
  if (outcome === 'fail') return [];
  const location = requireCard(state.cards, locationId);
  const clues = Math.min(amount, location.tokens.clue ?? 0);
  return clues > 0
    ? [{ type: 'DiscoverClues', investigatorId: investigator.id, locationId, amount: clues }]
    : [];
}

/**
 * A passed attack deals the confirmed damage (the attack's by default). A
 * failed one deals the attack's damage to the other investigator the enemy is
 * engaged with, if any (see `failedFightCommands`), and then lets a ready
 * retaliate enemy attack the fighter (`keywordAttackCommands`).
 */
function fightCommands(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  { enemyId, damage }: { enemyId: InstanceId; damage: number },
  { outcome, amount = damage }: TestAnswer,
): Command[] {
  if (outcome === 'pass') return [{ type: 'DamageEnemy', enemyId, amount }];
  const { enemy, stats } = enemyOf(ctx, state, enemyId);
  return [
    ...failedFightCommands(state, investigator, enemy, damage),
    ...keywordAttackCommands(ctx, state, 'retaliate', enemy, stats, investigator.id),
  ];
}

/**
 * A passed evasion exhausts the enemy and disengages it; a massive enemy only
 * exhausts, since it is never in the `engaged` zone. A failed one lets an
 * alert enemy attack the evader (`keywordAttackCommands`).
 */
function evadeCommands(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  enemyId: InstanceId,
  { outcome }: TestAnswer,
): Command[] {
  const { enemy, stats } = enemyOf(ctx, state, enemyId);
  if (outcome === 'fail')
    return keywordAttackCommands(ctx, state, 'alert', enemy, stats, investigator.id);
  return [
    ...(enemy.exhausted ? [] : [{ type: 'ExhaustEnemy', enemyId } as const]),
    ...(isEngagedWith(enemy, investigator) ? [{ type: 'DisengageEnemy', enemyId } as const] : []),
  ];
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
      ...(cmd.perPointFailed ? { perPointFailed: cmd.perPointFailed } : {}),
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
  /** Set for a basic action, whose consequences follow the answer (`testedActionCommands`). */
  testKind?: SkillTestKind;
  /**
   * Makes the pass of an action's test a count the players confirm (clues
   * discovered, damage dealt), which its resolver reads (`DecisionOption.amount`).
   */
  passAmount?: AmountRange;
  outcomes: SkillTestOutcomes;
}

/**
 * The `skillTestResult` decision of a test, answered by the investigator
 * taking it, with the suggested modified values (`withSuggestion`).
 */
function skillTest(
  ctx: EngineContext,
  state: GameState,
  { investigator, id, prompt, subject, test, testKind, passAmount, outcomes }: SkillTestRequest,
): DecisionRequested[] {
  const asked = skillTestDecision(
    {
      id: decisionId(id),
      prompt,
      subject,
      decider: { kind: 'investigator', investigatorId: investigator.id },
      test,
    },
    outcomes,
  );
  const decision: Decision = {
    ...asked,
    ...(testKind ? { testKind } : {}),
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
