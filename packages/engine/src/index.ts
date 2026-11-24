export const PACKAGE_NAME = '@arkham/engine';

export * from './ids';
export * from './zone';
export * from './rng';
export * from './state';
export * from './map';
export * from './spawn';
export type * from './scenario';
export * from './cards';
export * from './modifiers';
export * from './scopes';
export * from './restrictions';
export * from './action_costs';
export * from './blank_cards';
export * from './game_builder';
export * from './investigator_cards';
export * from './keywords';
export * from './commands';
export * from './events';
export { apply, replay } from './reducer';
export { handle, type CausedEvents } from './handle';
export { type ChangeCause } from './change_cause';
export { DEFAULT_RELIANCE, RELIANCES, showsNotice, type Reliance } from './reliance';
export { changeNotices, noticeKindOf, type ChangeNotice, type NoticeKind } from './change_notices';
export { neighbours, openConnections, shortestPaths } from './board';
export { cardsInZones, currentCard, matchesStats, zoneOf, type CardFilter } from './lookup';
export {
  byAny,
  byCode,
  byId,
  byName,
  cardMatcher,
  describeMatcher,
  enemyMatcher,
  enemyMatching,
  investigatorMatcher,
  matchingCards,
  matchingInvestigators,
  type AnyIdentifierMatcher,
  type CardMatcher,
  type CardRef,
  type CodeMatcher,
  type EnemyMatcher,
  type EnemyNarrowingMatcher,
  type EnemyRef,
  type InstanceIdMatcher,
  type InvestigatorIdMatcher,
  type InvestigatorMatcher,
  type InvestigatorRef,
  type NameMatcher,
} from './card_matchers';
export {
  BoardView,
  boardView,
  TableError,
  type ActAdvance,
  type ActView,
  type AgendaView,
  type CardActionView,
  type CluePayerView,
  type PrintedActionView,
  type CardFaceView,
  type CardPlaceView,
  type DecisionCounts,
  type ChoiceView,
  type DecisionView,
  type DueAttackView,
  type EncounterCardView,
  type EncounterPilesView,
  type EnemyAction,
  type EnemyCardEffectsView,
  type EnemyStatsView,
  type EnemyView,
  type InvestigatorView,
  type LocationView,
  type MapEnemyView,
  type MapView,
  type ProvokingActionView,
  type ReferenceRowView,
  type ReferenceView,
  type ResolvingCardView,
} from './board_view';
export {
  InvariantBroken,
  PlayTable,
  TableRejected,
  type LoggedEvent,
  type PhaseStop,
  type SkillTestResult,
} from './play_table';
export { CommandRejected, type Rejection, type RejectionCode } from './rejection';
export { execute, type ExecuteResult } from './execute';
export type * from './setup';
// Scenario functions are reached as `scenario.compileSetup` and so on, like
// the `campaign` namespace below.
export * as scenario from './scenario_api';
export * from './investigators';
export { enemyAttackList, type EnemyAttack } from './enemies';
export { describeDecision, optionName, optionNamed } from './describe_decision';
export { isEnemyAttackDecision } from './forced_attacks';
export { confirmOptions, skillTestDecision, type SkillTestOutcomes } from './decisions';
export {
  continueDraw,
  drawFinished,
  drawTokens,
  redrawToken,
  replaceToken,
  resolvedTokens,
  revealAnother,
  revealedTokens,
  withTokenState,
  type DrawnToken,
  type DrawnTokenState,
  type TestDraw,
} from './draw_tokens';
export { poolTokensLeft, tokenCounts, type PoolToken, type TokenCount } from './chaos_bag';
export { skillTestOdds, type SkillTestOdds } from './skill_test_odds';
export {
  revealsAnotherToken,
  skillTestSuggestion,
  suggestSkillTest,
  tokenModifier,
  type SkillModifierRegistry,
  type SkillTestContext,
  type SkillTestInput,
  type TokenValue,
} from './skill_modifiers';
export { enemiesAt, type EnemyFilter, enemiesOnTable } from './enemies';
export { CANCEL_REVELATION_OPTION, encounterDraw, isRevelationDecision } from './handle_encounter';
export { doomInPlay, isInPlay } from './doom';
export { checkInvariants } from './invariants';
export { PHASE_OF_STEP, PHASE_STEP_TITLES } from './phases';
export { BASE_ACTIONS_PER_TURN } from './turns';
export { formatBoard } from './format_board';
export { victoryPoints } from './victory';
export {
  advanceAct,
  advanceAgenda,
  removeConnection,
  shuffleSetAsideIntoEncounterDeck,
  shuffleSelfIntoEncounterDeck,
  afterDiscoveringClues,
  afterAttacking,
  afterEvaded,
  afterEvadingSuccessfully,
  afterSucceedingHere,
  becomeActAndAgenda,
  nextAgendaBecomesActAndAgenda,
  afterEngaging,
  afterEntering,
  afterTest,
  afterTokensPlaced,
  atEndOfPhase,
  atEndOfEachTurn,
  atEndOfRound,
  whenTurnBegins,
  leadDrawsDiscardingUntil,
  drawDiscardingUntil,
  drawFromEncounterDiscard,
  duringPhase,
  discardEncounterTop,
  shuffleEncounterDiscard,
  attachTo,
  attachToLocation,
  atEndOfTurn,
  defeatEachInvestigator,
  eachInvestigatorResigns,
  discardEachEnemy,
  discardEachEnemyAt,
  eachEnemy,
  moveEnemyTowards,
  discard,
  discardSelf,
  duringAct,
  duringAgenda,
  endScenario,
  leadDecides,
  youMustEither,
  moveEachInvestigatorTo,
  move,
  onlyCopy,
  placeDoomOnAgenda,
  addChaosToken,
  removeChaosToken,
  placeDoomOn,
  placeDoomOnSelf,
  placeDoomOnYourAsset,
  moveTokens,
  takeCluesFrom,
  removeDoomFrom,
  removeDoomFromAgenda,
  placeCluesOn,
  placeCluesOnSelf,
  placeCluesOnSelfUpTo,
  nearestEnemy,
  nearestLocation,
  thisLocation,
  healSelf,
  gainSurge,
  ifYouHave,
  ifValue,
  atLeast,
  statOf,
  tokensOn,
  ifThereAre,
  thereAre,
  ifNoCandidate,
  forEachEnemy,
  forEachInvestigator,
  searchAndDraw,
  searchAndDrawCopies,
  reaction,
  shuffleEncounterDeck,
  disengageFromEachEnemy,
  engageReadyEnemies,
  locationWith,
  locationWithMost,
  readySelf,
  dealDamageTo,
  discoverClues,
  loseActions,
  loseResources,
  endYourTurn,
  exhaustEnemy,
  defeatEnemy,
  enemyAttacks,
  engagesYou,
  putIntoThreatArea,
  takeControl,
  putMapIntoPlay,
  putLocationIntoPlay,
  fromSetAside,
  setAsideCopy,
  eachInZone,
  eachInPlay,
  revealLocation,
  skillTest,
  plusDifficultyPer,
  plusDifficultyIf,
  forEachPoint,
  byMargin,
  skillTestOfEither,
  cardsInYourHand,
  spawnEachSetAsideAt,
  spawnEnemyAt,
  placeYourClues,
  takeDamage,
  takeDamageAndHorror,
  takeHorror,
  heal,
  gainResources,
  gainClues,
  checkDoomThreshold,
  discardAsset,
  healAsset,
  codex,
  discardAtRandom,
  discardFromHand,
  advanceBySpendingCluesAtRoundEnd,
  drawCards,
  drawBeneathYourLocation,
  drawFromScenarioDeck,
  searchDeck,
  spendClues,
  moveTo,
  eachInvestigator,
  anInvestigator,
  anEnemy,
  moveToConnectingLocation,
  itsLocation,
  you,
  yourLocation,
  lead,
  self,
  thatCard,
  whenAdvanced,
  whenDefeated,
  whenEnemyDefeated,
  whenAnInvestigatorEnters,
  whenVictoryDisplayHolds,
  whenTokensOnSelf,
  whenRevealed,
} from './abilities';
export type {
  Ability,
  AbilityChoice,
  AbilityCondition,
  DifficultyChange,
  AbilityCommand,
  AbilityEffect,
  AbilityOption,
  ChoiceOption,
  AbilityTest,
  AbilitySkillTest,
  AskedCount,
  TestOutcomes,
  AbilityForEachPoint,
  AbilityByMargin,
  RelativeCard,
  RelativeInvestigator,
  Templated,
  TimingWindow,
  WindowEvent,
  ListenerScope,
  EndingPhase,
  TestedAction,
} from './abilities';
export { MAX_TRIGGERED_COMMANDS } from './triggers';
export {
  advanceBySpendingClues,
  parleyAction,
  resignAction,
  type ActionCost,
  type CardAction,
} from './card_actions';
export * from './store';
export { type AbilityUse, type UsageLimit, type UsagePeriod } from './usage_limits';
export { undoLastGroup } from './undo';
// Campaign functions are reached as `campaign.handleCommand` and so on, so
// their names don't repeat "campaign" (Andy on #64); the types stay flat.
export * as campaign from './campaign';
export type * from './campaign/campaign_commands';
export type * from './campaign/campaign_events';
export type {
  CampaignInvestigator,
  CampaignLog,
  CrossableEntry,
  InvestigatorFate,
  PlayedScenario,
  ScenarioOutcome,
  StoryCondition,
  StoryKind,
  StoryValue,
  TraumaKind,
  XpAccount,
} from './campaign/campaign_log';
export type {
  CampaignDefinition,
  CampaignLogLayout,
  CampaignOptions,
  LogSheet,
} from './campaign/campaign_definition';
export type {
  InterludeDefinition,
  InterludeProposal,
  InterludeQuestion,
  InterludeStep,
  InterludeTarget,
} from './campaign/interlude';
export type { CampaignContext, CampaignExecuteResult } from './campaign/handle_campaign';
export type {
  CampaignChangeCause,
  CampaignNotice,
  CampaignNoticeKind,
  CausedCampaignEvents,
} from './campaign/campaign_notices';
export type {
  ProposedChange,
  ResolutionStep,
  ResolutionTarget,
  ScenarioResolutions,
} from './campaign/resolution';
export {
  CampaignCommandRejected,
  type CampaignRejection,
  type CampaignRejectionCode,
} from './campaign/campaign_rejection';
