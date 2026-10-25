import { campaignDefinitionId, scenarioId, type CampaignDefinition } from '@arkham/engine';
import { theGathering } from '../the_gathering/scenario';
import { theMidnightMasks } from '../the_midnight_masks/scenario';

/**
 * Night of the Zealot, the Core Set campaign (review #44: campaign mode is
 * built on it first). The Devourer Below's id names the scenario the
 * campaign log advances to, so the order is right before its data exists (M5.4).
 */
export const nightOfTheZealot: CampaignDefinition = {
  id: campaignDefinitionId('night-of-the-zealot'),
  scenarios: [theGathering.id, theMidnightMasks.id, scenarioId('the-devourer-below')],
  // The campaign starts with the bag of its first scenario; the Core Set
  // campaign guide prints one bag per difficulty for the whole campaign.
  chaosBag: theGathering.chaosBag,
};
