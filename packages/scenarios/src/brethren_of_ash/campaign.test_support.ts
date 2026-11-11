import { campaign, campaignId, type CampaignContext, type CampaignLog } from '@arkham/engine';
import { daisyWalker, rolandBanks } from '../investigators';
import { brethrenOfAsh } from './campaign';

/**
 * A new Brethren of Ash campaign on Standard with Roland Banks (the lead) and Daisy Walker: the
 * start of the end-to-end games, which each play on from the log the one before wrote.
 */
export function newAshCampaign(ctx: CampaignContext): CampaignLog {
  return campaign.executeCommand(
    ctx,
    campaign.createEmptyLog(),
    campaign.compileStart(brethrenOfAsh, {
      campaignId: campaignId('ash_campaign'),
      difficulty: 'standard',
      investigators: [rolandBanks.code, daisyWalker.code],
    }),
  ).log;
}
