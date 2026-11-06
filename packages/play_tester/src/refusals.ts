import type { RejectionCode } from '@arkham/engine';

/**
 * How the tester judges a refused step (product.md "Continuous play tester", check 2):
 * `expected` when players at the table could try it and be told no (a move to a location that
 * isn't connected, an action in the wrong phase), `never` when it means the engine or the bot
 * offered something the engine then refuses (an unknown card, a decision's own option refused).
 * A `never` refusal is a finding; expected ones are only counted.
 */
export type RefusalKind = 'expected' | 'never';

/**
 * The kind of every rejection code. A record over all codes, so a new code fails typecheck until
 * it is marked here.
 */
const REFUSAL_KINDS: Readonly<Record<RejectionCode, RefusalKind>> = {
  // Moves and actions the board forbids right now.
  investigatorNotActive: 'expected',
  investigatorHasNoLocation: 'expected',
  notConnected: 'expected',
  restricted: 'expected',
  restrictedFor: 'expected',
  alreadyAtLocation: 'expected',
  investigatorNotAtLocation: 'expected',
  notEnoughClues: 'expected',
  wrongClueTotal: 'expected',
  negativeInvestigatorStat: 'expected',
  changesNothing: 'expected',
  scenarioEnded: 'expected',
  resolutionRequired: 'expected',
  encounterDeckEmpty: 'expected',
  // Enemies the action does not reach.
  enemyEngaged: 'expected',
  alreadyEngaged: 'expected',
  notEngaged: 'expected',
  aloofNotEngaged: 'expected',
  massiveNotEngageable: 'expected',
  attackNotDue: 'expected',
  // Card actions whose limit, cost or condition the board does not meet.
  cardActionUnavailable: 'expected',
  cardActionLimitReached: 'expected',
  cardActionCostUnpaid: 'expected',
  cardActionConditionUnmet: 'expected',
  // Steps out of the round's order.
  decisionPending: 'expected',
  wrongPhase: 'expected',
  turnAlreadyTaken: 'expected',
  turnInProgress: 'expected',
  turnNotInProgress: 'expected',
  noTurnInProgress: 'expected',
  invalidActionAdjustment: 'expected',
  turnsNotTaken: 'expected',
  noCurrentCard: 'expected',
  // Setup and card data: the scenario itself is broken.
  invalidSeed: 'never',
  duplicateInvestigator: 'never',
  duplicateCard: 'never',
  unknownCard: 'never',
  unknownCardCode: 'never',
  unknownInvestigator: 'never',
  unknownInvestigatorCard: 'never',
  notNextCampaignScenario: 'never',
  notOnCampaignTeam: 'never',
  investigatorNeedsReplacement: 'never',
  storyConditionMismatch: 'never',
  campaignMemberNotSeated: 'never',
  unknownMap: 'never',
  duplicateMap: 'never',
  layoutNotOnMap: 'never',
  invalidGridCell: 'never',
  duplicateConnection: 'never',
  connectionNotFound: 'never',
  selfConnection: 'never',
  setupTargetNotFound: 'never',
  setupTargetAmbiguous: 'never',
  unknownEncounterSet: 'never',
  invalidStartingTokens: 'never',
  // Cards the engine itself moves: a refusal means a rule sent a wrong command.
  cardAlreadyInPlay: 'never',
  cardNotInPlay: 'never',
  cardNotInZone: 'never',
  hostingCycle: 'never',
  indexOutOfRange: 'never',
  invalidTokenDelta: 'never',
  negativeTokens: 'never',
  notALocation: 'never',
  alreadyRevealed: 'never',
  unexpectedResolution: 'never',
  noGroupCost: 'never',
  scenarioDeckEmpty: 'never',
  currentStageCard: 'never',
  notAnEnemy: 'never',
  enemyAlreadyInPlay: 'never',
  enemyNotInPlay: 'never',
  noSpawnLocation: 'never',
  notResolving: 'never',
  exhaustUnchanged: 'never',
  notAHunter: 'never',
  hunterCannotMove: 'never',
  noRoute: 'never',
  triggerLoop: 'never',
  triggeredCommandRejected: 'never',
  alreadyLeadInvestigator: 'never',
  // Decisions: an option the board offers must be accepted.
  duplicateDecision: 'never',
  invalidDecisionOptions: 'never',
  unknownDecision: 'never',
  noPendingDecision: 'never',
  unknownOption: 'never',
  notTheDecider: 'never',
  unknownCardAction: 'never',
  invalidModifierAmount: 'never',
  invalidAttackAmount: 'never',
  invalidWounds: 'never',
  amountNotAdjustable: 'never',
  marginNotApplicable: 'never',
  invalidMargin: 'never',
  amountOutOfRange: 'never',
};

/** How the tester judges a step the engine refused with `code`. */
export function refusalKind(code: RejectionCode): RefusalKind {
  return REFUSAL_KINDS[code];
}
