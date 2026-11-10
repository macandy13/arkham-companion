import { campaignDefinitionId, type CampaignDefinition } from '@arkham/engine';
import { queenOfAsh } from '../queen_of_ash/scenario';
import { smokeAndMirrors } from '../smoke_and_mirrors/scenario';
import { spreadingFlames } from '../spreading_flames/scenario';
import { ASH_STORY } from './story';

/** Brethren of Ash, the Core Set (2026) campaign of three scenarios. */
export const brethrenOfAsh: CampaignDefinition = {
  id: campaignDefinitionId('brethren-of-ash'),
  scenarios: [spreadingFlames.id, smokeAndMirrors.id, queenOfAsh.id],
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
      ASH_STORY.elokossWasReborn,
      ASH_STORY.defeatedElokossAndTheBrethren,
      ASH_STORY.stoppedElokosssRebirth,
      ASH_STORY.floodedTheSummoningRitual,
    ],
    sheets: [{ kind: 'nameList', record: ASH_STORY.harbingerOfElokoss }],
  },
};
