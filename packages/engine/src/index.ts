export const PACKAGE_NAME = '@arkham/engine';

export * from './ids';
export * from './zone';
export * from './rng';
export * from './state';
export * from './map';
export * from './spawn';
export type * from './scenario';
export * from './cards';
export * from './card_values';
export * from './blank_cards';
export * from './game_builder';
export * from './investigator_cards';
export * from './keywords';
export * from './commands';
export * from './events';
export { apply, replay } from './reducer';
export { handle } from './handle';
export { locationsNamed, neighbours, sameEdge, shortestPaths } from './board';
export { cardsNamed, zoneOf } from './lookup';
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
  type ActView,
  type AgendaView,
  type DecisionView,
  type DueAttackView,
  type EnemyView,
  type InvestigatorView,
  type LocationView,
  type MapEnemyView,
  type MapView,
} from './board_view';
export {
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
export { confirmOptions, skillTestDecision, type SkillTestOutcomes } from './decisions';
export {
  skillTestContext,
  skillTestSuggestion,
  suggestSkillTest,
  type SkillModifierRegistry,
  type SkillTestContext,
  type SkillTestInput,
  type TokenValue,
} from './skill_modifiers';
export { enemiesAt } from './enemies';
export { matchesEncounter } from './handle_encounter';
export { doomInPlay, isInPlay } from './doom';
export { checkInvariants } from './invariants';
export { PHASE_STEP_TITLES } from './phases';
export { BASE_ACTIONS_PER_TURN } from './turns';
export { formatBoard } from './format_board';
export { victoryPoints } from './victory';
export {
  advanceAct,
  afterDiscoveringClues,
  afterAttacking,
  afterEngaging,
  afterEntering,
  afterTest,
  atEndOfPhase,
  atEndOfEachTurn,
  atEndOfRound,
  whenTurnBegins,
  leadDrawsDiscardingUntil,
  shuffleEncounterDiscard,
  attachToLocation,
  atEndOfTurn,
  defeatEachInvestigator,
  discardEachEnemyAt,
  discardSelf,
  duringAct,
  endScenario,
  leadDecides,
  youMustEither,
  moveEachInvestigatorTo,
  moveSelf,
  onlyCopy,
  placeDoomOnAgenda,
  placeDoomOn,
  placeDoomOnSelf,
  nearestEnemy,
  healSelf,
  gainSurge,
  ifYouHave,
  readySelf,
  putIntoThreatArea,
  putMapIntoPlay,
  putSetAsideIntoPlay,
  removeFromGame,
  revealLocation,
  skillTest,
  spawnEnemyAt,
  takeDamage,
  takeHorror,
  spendClues,
  moveTo,
  eachInvestigatorAt,
  itsLocation,
  whenAdvanced,
  whenDefeated,
  whenEnemyDefeated,
  whenRevealed,
} from './abilities';
export type {
  Ability,
  AbilityChoice,
  AbilityCondition,
  AbilityCommand,
  AbilityEffect,
  AbilityOption,
  ChoiceOption,
  AbilityTest,
  RelativeCard,
  RelativeInvestigator,
  Templated,
  TimingWindow,
  EndingPhase,
  TestedAction,
} from './abilities';
export { MAX_TRIGGERED_COMMANDS } from './triggers';
export * from './store';
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
  CampaignOptions,
  InterludeDefinition,
} from './campaign/campaign_definition';
export type { CampaignContext, CampaignExecuteResult } from './campaign/handle_campaign';
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
