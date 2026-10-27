import type { ResolutionStep, ScenarioResolutions, StoryValue } from '@arkham/engine';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import { GATHERING_RESOLUTIONS } from './cards';

const yes: StoryValue = { kind: 'flag', value: true };
const no: StoryValue = { kind: 'flag', value: false };

/** Translation key prefix for the steps the players do by hand. */
const byHandKeyPrefix = 'scenario.theGathering.resolution';

const litaEarned: ResolutionStep = { kind: 'record', key: ZEALOT_STORY.litaEarned, value: yes };
const litaJoinsTheLead: ResolutionStep = { kind: 'byHand', textKey: `${byHandKeyPrefix}.earnLita` };
const upgradeDecks: ResolutionStep = { kind: 'byHand', textKey: `${byHandKeyPrefix}.upgradeDecks` };
/** Victory points plus 2 "as they gain insight into the hidden world of the Mythos". */
const victoryPlusInsight: ResolutionStep = {
  kind: 'awardXp',
  to: 'each',
  bonus: 2,
  victoryDisplay: true,
};

/**
 * The Gathering's resolutions, in the campaign guide's order of steps.
 * R3 gives no experience because everyone left in the house is killed. Its
 * last step, "if the lead investigator was killed, choose an investigator to
 * earn Lita", always applies: a lead who resigns or is defeated hands the role
 * to someone still in the house, so the lead is among those R3 kills. Earning
 * Lita is about the players' decks, so it is a by-hand step, plus a record
 * that someone earned her (`litaEarned`) for The Devourer Below. Only R2
 * leaves her unearned.
 */
export const theGatheringResolutions: ScenarioResolutions = {
  none: [
    { kind: 'record', key: ZEALOT_STORY.houseStillStanding, value: yes },
    { kind: 'record', key: ZEALOT_STORY.ghoulPriestStillAlive, value: yes },
    litaEarned,
    litaJoinsTheLead,
    victoryPlusInsight,
    upgradeDecks,
  ],
  byId: {
    [GATHERING_RESOLUTIONS.burnedDown]: [
      { kind: 'record', key: ZEALOT_STORY.houseStillStanding, value: no },
      litaEarned,
      litaJoinsTheLead,
      { kind: 'addTrauma', to: 'lead', trauma: 'mental', amount: 1 },
      victoryPlusInsight,
      upgradeDecks,
    ],
    [GATHERING_RESOLUTIONS.leftStanding]: [
      { kind: 'record', key: ZEALOT_STORY.houseStillStanding, value: yes },
      { kind: 'awardXp', to: 'lead', bonus: 1, victoryDisplay: false },
      victoryPlusInsight,
      upgradeDecks,
    ],
    [GATHERING_RESOLUTIONS.trapped]: [
      { kind: 'record', key: ZEALOT_STORY.litaForcedToFindOthers, value: yes },
      { kind: 'record', key: ZEALOT_STORY.houseStillStanding, value: yes },
      { kind: 'record', key: ZEALOT_STORY.ghoulPriestStillAlive, value: yes },
      { kind: 'markKilled', to: 'notResigned' },
      { kind: 'byHand', textKey: `${byHandKeyPrefix}.replaceKilled` },
      litaEarned,
      { kind: 'byHand', textKey: `${byHandKeyPrefix}.earnLitaIfLeadKilled` },
    ],
  },
};
