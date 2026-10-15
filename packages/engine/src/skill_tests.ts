import { cardStats, type EngineContext } from './cards';
import type { Command, Evade, Fight, Investigate } from './commands';
import { skillTestDecision, type SkillTestOutcomes } from './decisions';
import type { DecisionRequested } from './events';
import { enemyOf, isInPlay, locationOf } from './handle-enemy';
import { activeInvestigator } from './handle-investigator';
import { decisionId, type InstanceId } from './ids';
import { hasKeyword } from './keywords';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, Investigator, SkillTest } from './state';

/**
 * `Investigate`: an intellect test against the shroud of the investigator's
 * location; a pass discovers 1 clue. A location without clues left makes the
 * pass do nothing rather than fail the answer.
 */
export function handleInvestigate(
  ctx: EngineContext,
  state: GameState,
  cmd: Investigate,
): DecisionRequested[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const location = investigatorLocation(state, investigator);
  const onPass: Command[] =
    (location.tokens.clue ?? 0) > 0
      ? [
          {
            type: 'DiscoverClues',
            investigatorId: investigator.id,
            locationId: location.id,
            amount: 1,
          },
        ]
      : [];
  const shroud = cardStats(ctx.cards, location.code).shroud ?? 0;
  return skillTest(
    investigator,
    `investigate:${investigator.id}`,
    location.id,
    { skill: 'intellect', difficulty: shroud },
    { onPass, onFail: [] },
  );
}

/**
 * `Fight`: a combat test against the fight value of an enemy at the
 * investigator's location; a pass deals the attack's damage (`DamageEnemy`).
 * A fail deals that damage to the other investigator the enemy is engaged
 * with, if any (see `failedFightCommands`).
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
  const damage = cmd.damage ?? 1;
  if (!Number.isInteger(damage) || damage <= 0)
    throw new CommandRejected({ code: 'invalidTokenDelta', delta: damage });
  return skillTest(
    investigator,
    `fight:${investigator.id}:${enemy.id}`,
    enemy.id,
    { skill: 'combat', difficulty: stats.fight ?? 0 },
    {
      onPass: [{ type: 'DamageEnemy', enemyId: enemy.id, amount: damage }],
      onFail: failedFightCommands(state, investigator, enemy, damage),
    },
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
 * exhausts, since it is never in the `engaged` zone.
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
  return skillTest(
    investigator,
    `evade:${investigator.id}:${enemy.id}`,
    enemy.id,
    { skill: 'agility', difficulty: stats.evade ?? 0 },
    { onPass, onFail: [] },
  );
}

/** The `skillTestResult` decision of a quick action, answered by the acting investigator. */
function skillTest(
  investigator: Investigator,
  id: string,
  subject: InstanceId,
  test: SkillTest,
  outcomes: SkillTestOutcomes,
): DecisionRequested[] {
  const decision = skillTestDecision(
    {
      id: decisionId(id),
      prompt: `decision.skillTest.${test.skill}`,
      subject,
      decider: { kind: 'investigator', investigatorId: investigator.id },
      test,
    },
    outcomes,
  );
  return [{ type: 'DecisionRequested', decision }];
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
