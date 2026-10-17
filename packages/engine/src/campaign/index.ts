/**
 * The campaign aggregate (architecture §5, §8): a `CampaignLog` that outlives
 * each game, driven by its own commands, events and reducer.
 */
export * from './campaign_log';
export * from './campaign_events';
export { applyCampaign, replayCampaign } from './campaign_reducer';
export { checkCampaignInvariants, MAX_TEAM_SIZE } from './campaign_invariants';
