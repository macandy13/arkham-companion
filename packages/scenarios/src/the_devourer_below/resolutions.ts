import type { ResolutionStep, ScenarioResolutions, StoryValue } from '@arkham/engine';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import { DEVOURER_BELOW_RESOLUTIONS } from './cards';

const yes: StoryValue = { kind: 'flag', value: true };

/** Translation key prefix for the steps the players do by hand. */
const byHandKeyPrefix = 'scenario.theDevourerBelow.resolution';

const upgradeDecks: ResolutionStep = { kind: 'byHand', textKey: `${byHandKeyPrefix}.upgradeDecks` };

/** "Each investigator suffers 2 physical and 2 mental trauma" (R2 and R3). */
const twoAndTwoTrauma: readonly ResolutionStep[] = [
  { kind: 'addTrauma', to: 'each', trauma: 'physical', amount: 2 },
  { kind: 'addTrauma', to: 'each', trauma: 'mental', amount: 2 },
];

/** Victory points plus `bonus` for each investigator. */
function victoryXp(bonus: number): ResolutionStep {
  return { kind: 'awardXp', to: 'each', bonus, victoryDisplay: true };
}

/**
 * The Devourer Below's resolutions, in the campaign guide's order of steps. As the campaign's
 * last scenario, each one ends the campaign: won (R1, R2), lost (no resolution: Arkham
 * succumbs and each surviving investigator is killed) or survived (R3). R3's Madness
 * weakness and taking Lita Chantler out of the decks are done by hand.
 */
export const theDevourerBelowResolutions: ScenarioResolutions = {
  none: [
    { kind: 'record', key: ZEALOT_STORY.arkhamSuccumbed, value: yes },
    { kind: 'markKilled', to: 'each' },
    { kind: 'endCampaign', result: 'lost' },
  ],
  byId: {
    [DEVOURER_BELOW_RESOLUTIONS.ritualBroken]: [
      { kind: 'record', key: ZEALOT_STORY.ritualBroken, value: yes },
      { kind: 'addTrauma', to: 'each', trauma: 'mental', amount: 2 },
      victoryXp(5),
      upgradeDecks,
      { kind: 'endCampaign', result: 'won' },
    ],
    [DEVOURER_BELOW_RESOLUTIONS.umordhothRepelled]: [
      { kind: 'record', key: ZEALOT_STORY.umordhothRepelled, value: yes },
      ...twoAndTwoTrauma,
      victoryXp(10),
      upgradeDecks,
      { kind: 'endCampaign', result: 'won' },
    ],
    [DEVOURER_BELOW_RESOLUTIONS.litaSacrificed]: [
      { kind: 'record', key: ZEALOT_STORY.litaSacrificed, value: yes },
      { kind: 'byHand', textKey: `${byHandKeyPrefix}.removeLita` },
      ...twoAndTwoTrauma,
      { kind: 'byHand', textKey: `${byHandKeyPrefix}.madnessWeakness` },
      victoryXp(0),
      upgradeDecks,
      { kind: 'endCampaign', result: 'survived' },
    ],
  },
};
