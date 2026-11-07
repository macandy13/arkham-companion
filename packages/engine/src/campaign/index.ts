/**
 * The campaign aggregate (architecture §5, §8): a `CampaignLog` that outlives
 * each game, driven by its own commands, events and reducer.
 */
export * from './campaign_log';
export * from './campaign_commands';
export * from './campaign_events';
export * from './campaign_definition';
export * from './resolution';
export * from './interlude';
export * from './campaign_notices';
export { moveCampaignEvent, moveGameEvent } from './campaign_import';
export {
  CampaignCommandRejected,
  type CampaignRejection,
  type CampaignRejectionCode,
} from './campaign_rejection';
export { applyEvent, replayEvents } from './campaign_reducer';
export {
  executeCommand,
  executeCommands,
  handleCommand,
  type CampaignContext,
  type CampaignExecuteResult,
} from './handle_campaign';
export { checkInvariants, MAX_TEAM_SIZE } from './campaign_invariants';
