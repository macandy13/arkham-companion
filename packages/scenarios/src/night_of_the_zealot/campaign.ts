import { campaignDefinitionId, type CampaignDefinition } from '@arkham/engine';
import { theGathering } from '../the_gathering/scenario';
import { theMidnightMasks } from '../the_midnight_masks/scenario';
import { theDevourerBelow } from '../the_devourer_below/scenario';
import { ZEALOT_STORY } from './story';

/**
 * Night of the Zealot, the Core Set campaign (review #44: campaign mode is
 * built on it first).
 */
export const nightOfTheZealot: CampaignDefinition = {
  id: campaignDefinitionId('night-of-the-zealot'),
  scenarios: [theGathering.id, theMidnightMasks.id, theDevourerBelow.id],
  // The campaign starts with the bag of its first scenario; the Core Set
  // campaign guide prints one bag per difficulty for the whole campaign.
  chaosBag: theGathering.chaosBag,
  // The paper log has campaign notes and a list each for the cultists caught and escaped.
  log: {
    notes: [
      ZEALOT_STORY.houseStillStanding,
      ZEALOT_STORY.ghoulPriestStillAlive,
      ZEALOT_STORY.litaForcedToFindOthers,
      ZEALOT_STORY.itIsPastMidnight,
      ZEALOT_STORY.arkhamSuccumbed,
      ZEALOT_STORY.ritualBroken,
      ZEALOT_STORY.umordhothRepelled,
      ZEALOT_STORY.litaSacrificed,
    ],
    sheets: [
      { kind: 'nameList', record: ZEALOT_STORY.cultistsWeInterrogated },
      { kind: 'nameList', record: ZEALOT_STORY.cultistsWhoGotAway },
    ],
  },
};
