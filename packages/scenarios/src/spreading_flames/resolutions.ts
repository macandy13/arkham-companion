import type { ResolutionStep, ScenarioResolutions, StoryValue } from '@arkham/engine';
import { ASH_STORY } from '../brethren_of_ash/story';
import { SPREADING_FLAMES_CODES, SPREADING_FLAMES_RESOLUTIONS } from './cards';

const yes: StoryValue = { kind: 'flag', value: true };
const no: StoryValue = { kind: 'flag', value: false };

/** Translation key prefix for the steps the players do by hand. */
const byHandKeyPrefix = 'scenario.spreadingFlames.resolution';

const upgradeDecks: ResolutionStep = { kind: 'byHand', textKey: `${byHandKeyPrefix}.upgradeDecks` };
/** "Each investigator suffers 1 mental trauma, as they are wracked with guilt for letting the university burn." */
const guiltForTheUniversity: ResolutionStep = {
  kind: 'addTrauma',
  to: 'each',
  trauma: 'mental',
  amount: 1,
};
const universityBurned: ResolutionStep = {
  kind: 'record',
  key: ASH_STORY.savedMiskatonicUniversity,
  value: no,
};

/**
 * Resolution 1, which Resolutions 2 and 3 begin with: the investigators defeated the Servant of
 * Flame, one of them (the players choose) earns Dr. Henry Armitage, and everyone earns victory
 * points plus 3. Its last step, "stay or go", is Blaze of Glory's question at the table.
 */
const defeatedTheServant: readonly ResolutionStep[] = [
  { kind: 'record', key: ASH_STORY.defeatedTheirMaskedPursuer, value: yes },
  { kind: 'earnCard', to: 'each', card: SPREADING_FLAMES_CODES.drHenryArmitage, choose: true },
  { kind: 'byHand', textKey: `${byHandKeyPrefix}.earnArmitage` },
  { kind: 'awardXp', to: 'each', bonus: 3, victoryDisplay: true },
];

/** Spreading Flames' resolutions, in the campaign guide's order of steps. */
export const spreadingFlamesResolutions: ScenarioResolutions = {
  none: [
    universityBurned,
    guiltForTheUniversity,
    { kind: 'awardXp', to: 'each', bonus: 2, victoryDisplay: true },
    upgradeDecks,
  ],
  byId: {
    [SPREADING_FLAMES_RESOLUTIONS.stayed]: [
      ...defeatedTheServant,
      { kind: 'record', key: ASH_STORY.savedMiskatonicUniversity, value: yes },
      // "Each investigator earns 1 bonus experience and suffers 1 physical trauma from the burns."
      { kind: 'awardXp', to: 'each', bonus: 1, victoryDisplay: false },
      { kind: 'addTrauma', to: 'each', trauma: 'physical', amount: 1 },
      upgradeDecks,
    ],
    [SPREADING_FLAMES_RESOLUTIONS.went]: [
      ...defeatedTheServant,
      universityBurned,
      guiltForTheUniversity,
      upgradeDecks,
    ],
  },
};
