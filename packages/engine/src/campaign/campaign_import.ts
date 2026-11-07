import type { Event } from '../events';
import type { CampaignId } from '../ids';
import type { CampaignEvent } from './campaign_events';

/**
 * `event` of a campaign log, moved to the campaign `id`. A campaign log names its own id once,
 * in `CampaignStarted`; an imported campaign gets a new id on this device, so its log has to name
 * that one, or the games would write their resolutions to a campaign that isn't there.
 */
export function moveCampaignEvent(event: CampaignEvent, id: CampaignId): CampaignEvent {
  return event.type === 'CampaignStarted' ? { ...event, campaignId: id } : event;
}

/**
 * `event` of a campaign's game, moved to the campaign `id` like `moveCampaignEvent`: a game of a
 * campaign starts with a copy of the campaign log (`ScenarioStarted.campaign`), which names it.
 */
export function moveGameEvent(event: Event, id: CampaignId): Event {
  return event.type === 'ScenarioStarted' && event.campaign
    ? { ...event, campaign: { ...event.campaign, campaignId: id } }
    : event;
}
