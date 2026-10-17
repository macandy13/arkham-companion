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
export { applyEvent, replayEvents } from './campaign_reducer';
export {
  executeCommand,
  handleCommand,
  type CampaignContext,
  type CampaignExecuteResult,
} from './handle_campaign';
export { checkInvariants, MAX_TEAM_SIZE } from './campaign_invariants';
