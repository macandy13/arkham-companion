/**
 * The campaign aggregate (architecture §5, §8): a `CampaignLog` that outlives
 * each game, driven by its own commands, events and reducer.
 */
export * from './campaign_log';
export * from './campaign_commands';
export * from './campaign_events';
export * from './campaign_definition';
export {
  CampaignCommandRejected,
  type CampaignRejection,
  type CampaignRejectionCode,
} from './campaign_rejection';
export { applyCampaign, replayCampaign } from './campaign_reducer';
export {
  executeCampaign,
  handleCampaign,
  type CampaignContext,
  type CampaignExecuteResult,
} from './handle_campaign';
export { checkCampaignInvariants, MAX_TEAM_SIZE } from './campaign_invariants';
