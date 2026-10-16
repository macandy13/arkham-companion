import type { CampaignDefinition } from '@arkham/engine';
import { theGathering } from '../the_gathering/scenario';

/**
 * Night of the Zealot, the Core Set campaign (review #44: campaign mode is
 * built on it first). Only The Gathering is entered as a scenario so far;
 * the other two ids name the scenarios the campaign log advances to, so the
 * order is right before their data exists (M4/M5).
 */
export const nightOfTheZealot: CampaignDefinition = {
  id: 'night-of-the-zealot',
  scenarios: [theGathering.id, 'the-midnight-masks', 'the-devourer-below'],
  // The campaign starts with the bag of its first scenario; the Core Set
  // campaign guide prints one bag per difficulty for the whole campaign.
  chaosBag: theGathering.chaosBag,
};
