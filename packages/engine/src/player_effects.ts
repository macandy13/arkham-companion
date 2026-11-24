import type {
  AdjustInvestigator,
  Adjustment,
  AttachPlayerCard,
  DiscoverClues,
  DrawWeakness,
  EvadeEnemy,
  MoveEnemy,
  MoveInvestigator,
  ReleaseChaosToken,
  SealChaosToken,
} from './commands';
import type { CardCode, InstanceId, InvestigatorId } from './ids';
import type { ChaosToken, InvestigatorStat, SkillName, TokenKind } from './state';

/*
 * What the players carry out by hand on the play screen that card data never writes, as plain
 * commands (`GameActions.perform`), and the corrections they make (`GameActions.correct`). What
 * both cards and players do is built with the card factories (`dealDamageTo(enemy, 1)`), whose
 * overloads take instance IDs too.
 */

/**
 * `delta` more (or, negative, fewer) of the investigator's `stat` (`AdjustInvestigator`), as a
 * counter's stepper or a token dragged onto their card changes it: damage and horror can defeat
 * them, as the rules say.
 */
export function adjustStat(
  stat: InvestigatorStat,
  delta: number,
  investigator: InvestigatorId,
): AdjustInvestigator {
  return { type: 'AdjustInvestigator', investigatorId: investigator, stat, delta };
}

/** "[Investigator] evaded it": the enemy is evaded by them as a card effect evades it (`EvadeEnemy`). */
export function evadeEnemy(enemy: InstanceId, by: InvestigatorId): EvadeEnemy {
  return { type: 'EvadeEnemy', enemyId: enemy, investigatorId: by };
}

/** The enemy moves straight to `to`, engaged or not, as the players drag it there (`MoveEnemy`). */
export function moveEnemyTo(enemy: InstanceId, to: InstanceId): MoveEnemy {
  return { type: 'MoveEnemy', enemyId: enemy, to, forced: true };
}

/**
 * The investigator moves to `to` along a connection without spending an action
 * (`MoveInvestigator`), as a pawn dragged there catches the screen up with a move made at the table.
 */
export function moveAlong(investigator: InvestigatorId, to: InstanceId): MoveInvestigator {
  return { type: 'MoveInvestigator', investigatorId: investigator, to };
}

/** The investigator takes one clue from `location`, their own, without a test (`DiscoverClues`). */
export function takeOneClue(location: InstanceId, investigator: InvestigatorId): DiscoverClues {
  return { type: 'DiscoverClues', investigatorId: investigator, locationId: location, amount: 1 };
}

/** A player card seals `token` on the investigator (`SealChaosToken`). */
export function sealChaosToken(token: ChaosToken, on: InvestigatorId): SealChaosToken {
  return { type: 'SealChaosToken', token, investigatorId: on };
}

/** The token sealed on the investigator goes back into the chaos bag (`ReleaseChaosToken`). */
export function releaseChaosToken(token: ChaosToken, from: InvestigatorId): ReleaseChaosToken {
  return { type: 'ReleaseChaosToken', token, investigatorId: from };
}

/** A player card attached to the card `host` in play, such as a Barricade (`AttachPlayerCard`). */
export function attachPlayerCard(host: InstanceId, code: CardCode): AttachPlayerCard {
  return { type: 'AttachPlayerCard', hostId: host, code };
}

/** The investigator draws the weakness `code` into their threat area (`DrawWeakness`). */
export function drawWeakness(investigator: InvestigatorId, code: CardCode): DrawWeakness {
  return { type: 'DrawWeakness', investigatorId: investigator, code };
}

/** Corrects the count of `token` on `card` by `delta`, without placing or removing it by rule. */
export function correctTokens(card: InstanceId, token: TokenKind, delta: number): Adjustment {
  return { kind: 'tokens', cardId: card, token, delta };
}

/** Corrects the investigator's lasting boost of `skill` by `delta` (`Investigator.skillBoosts`). */
export function correctSkillBoost(
  investigator: InvestigatorId,
  skill: SkillName,
  delta: number,
): Adjustment {
  return { kind: 'skillBoost', investigatorId: investigator, skill, delta };
}
