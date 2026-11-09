import { campaignDefinitionId, type CampaignDefinition } from '@arkham/engine';
import { smokeAndMirrors } from '../smoke_and_mirrors/scenario';
import { spreadingFlames } from '../spreading_flames/scenario';
import { ASH_STORY } from './story';

/**
 * Brethren of Ash, the Core Set (2026) campaign, with the scenarios the app plays so far: Queen
 * of Ash (MC2.9) joins it as its third.
 */
export const brethrenOfAsh: CampaignDefinition = {
  id: campaignDefinitionId('brethren-of-ash'),
  scenarios: [spreadingFlames.id, smokeAndMirrors.id],
  // The campaign starts with the bag Spreading Flames, its first scenario, assembles.
  chaosBag: spreadingFlames.chaosBag,
  // The paper log has campaign notes and the harbinger of Elokoss's name.
  log: {
    notes: [
      ASH_STORY.savedMiskatonicUniversity,
      ASH_STORY.defeatedTheirMaskedPursuer,
      ASH_STORY.discoveredTheCultsWhereabouts,
      ASH_STORY.killedTheServantOfFlame,
      ASH_STORY.theServantOfFlameEscaped,
      ASH_STORY.scouredArkhamForAnswers,
      ASH_STORY.stirredUpTrouble,
    ],
    sheets: [{ kind: 'nameList', record: ASH_STORY.harbingerOfElokoss }],
  },
};
