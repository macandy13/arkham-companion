import type { ResolutionStep, ScenarioResolutions, StoryValue } from '@arkham/engine';
import { ASH_STORY } from '../brethren_of_ash/story';
import { QUEEN_OF_ASH_RESOLUTIONS } from './cards';

const yes: StoryValue = { kind: 'flag', value: true };

/** Translation key prefix for the steps the players do by hand. */
const byHandKeyPrefix = 'scenario.queenOfAsh.resolution';

/**
 * "The investigators have earned the Collector campaign reward card. Add both copies of this
 * card to the player card pool": the pool is the players' own, so it is done by hand.
 */
const collector: ResolutionStep = { kind: 'byHand', textKey: `${byHandKeyPrefix}.collector` };

/** "Each investigator suffers 2 mental trauma and 2 physical trauma" (R1 and R2). */
const twoAndTwoTrauma: readonly ResolutionStep[] = [
  { kind: 'addTrauma', to: 'each', trauma: 'mental', amount: 2 },
  { kind: 'addTrauma', to: 'each', trauma: 'physical', amount: 2 },
];

/**
 * Queen of Ash's resolutions, in the campaign guide's order of steps. As the campaign's last
 * scenario, each one ends the campaign: lost without a resolution (Elokoss reborn, each
 * investigator killed), won otherwise. R3 kills each investigator who did not resign; only those
 * who resigned earn experience and suffer its trauma. Spending experience is left out, as no
 * scenario follows.
 */
export const queenOfAshResolutions: ScenarioResolutions = {
  none: [
    { kind: 'record', key: ASH_STORY.elokossWasReborn, value: yes },
    { kind: 'markKilled', to: 'each' },
    { kind: 'endCampaign', result: 'lost' },
  ],
  byId: {
    [QUEEN_OF_ASH_RESOLUTIONS.elokossDefeated]: [
      { kind: 'record', key: ASH_STORY.defeatedElokossAndTheBrethren, value: yes },
      { kind: 'awardXp', to: 'each', bonus: 5, victoryDisplay: true },
      collector,
      ...twoAndTwoTrauma,
      { kind: 'endCampaign', result: 'won' },
    ],
    [QUEEN_OF_ASH_RESOLUTIONS.rebirthStopped]: [
      { kind: 'record', key: ASH_STORY.stoppedElokosssRebirth, value: yes },
      { kind: 'awardXp', to: 'each', bonus: 5, victoryDisplay: true },
      collector,
      ...twoAndTwoTrauma,
      { kind: 'endCampaign', result: 'won' },
    ],
    [QUEEN_OF_ASH_RESOLUTIONS.ritualFlooded]: [
      { kind: 'record', key: ASH_STORY.floodedTheSummoningRitual, value: yes },
      { kind: 'markKilled', to: 'notResigned' },
      { kind: 'awardXp', to: 'resigned', bonus: 3, victoryDisplay: true },
      collector,
      { kind: 'addTrauma', to: 'resigned', trauma: 'mental', amount: 3 },
      { kind: 'endCampaign', result: 'won' },
    ],
  },
};
