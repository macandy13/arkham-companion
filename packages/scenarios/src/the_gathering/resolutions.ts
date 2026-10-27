import type { ResolutionStep, ScenarioResolutions, StoryValue } from '@arkham/engine';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import { GATHERING_CODES, GATHERING_RESOLUTIONS } from './cards';

const yes: StoryValue = { kind: 'flag', value: true };
const no: StoryValue = { kind: 'flag', value: false };

/** Translation key prefix for the steps the players do by hand. */
const byHandKeyPrefix = 'scenario.theGathering.resolution';

/** "The lead investigator earns the Lita Chantler card", so The Devourer Below trusts them to hold her. */
const leadEarnsLita: ResolutionStep = {
  kind: 'earnCard',
  to: 'lead',
  card: GATHERING_CODES.litaChantler,
};
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
 * to someone still in the house, so the lead is among those R3 kills. The
 * players choose among those who resigned; with nobody left, a replacement
 * investigator earns her by hand. Putting Lita into a deck stays a by-hand
 * step, since the app doesn't hold decks. Only R2 leaves her unearned.
 */
export const theGatheringResolutions: ScenarioResolutions = {
  none: [
    { kind: 'record', key: ZEALOT_STORY.houseStillStanding, value: yes },
    { kind: 'record', key: ZEALOT_STORY.ghoulPriestStillAlive, value: yes },
    leadEarnsLita,
    litaJoinsTheLead,
    victoryPlusInsight,
    upgradeDecks,
  ],
  byId: {
    [GATHERING_RESOLUTIONS.burnedDown]: [
      { kind: 'record', key: ZEALOT_STORY.houseStillStanding, value: no },
      leadEarnsLita,
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
      { kind: 'earnCard', to: 'resigned', card: GATHERING_CODES.litaChantler, choose: true },
      { kind: 'byHand', textKey: `${byHandKeyPrefix}.earnLitaIfLeadKilled` },
    ],
  },
};
