export const PACKAGE_NAME = '@arkham/engine';

export * from './ids';
export * from './zone';
export * from './rng';
export * from './state';
export * from './map';
export * from './spawn';
export * from './scenario';
export * from './cards';
export * from './investigator_cards';
export * from './keywords';
export * from './commands';
export * from './events';
export { apply, replay } from './reducer';
export { handle } from './handle';
export { locationsNamed, neighbours, sameEdge, shortestPaths } from './board';
export { cardsNamed } from './lookup';
export { CommandRejected, type Rejection, type RejectionCode } from './rejection';
export { execute, type ExecuteResult } from './execute';
export * from './setup';
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
export { enemiesAt } from './handle_enemy';
export { matchesEncounter } from './handle_encounter';
export { doomInPlay, isInPlay } from './doom';
export { checkInvariants } from './invariants';
export { PHASE_STEP_TITLES } from './phases';
export { BASE_ACTIONS_PER_TURN } from './turns';
export { formatBoard } from './format_board';
export {
  MAX_TRIGGERED_COMMANDS,
  type CardEffect,
  type EffectsRegistry,
  type ScenarioHooks,
  type TriggerHook,
} from './triggers';
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
export {
  CampaignCommandRejected,
  type CampaignRejection,
  type CampaignRejectionCode,
} from './campaign/campaign_rejection';
