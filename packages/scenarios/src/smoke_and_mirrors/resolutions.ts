import {
  beneath,
  eachInZone,
  onlyCopy,
  outOfGame,
  setAside,
  thereAre,
  trait,
  victoryDisplay,
  type ResolutionStep,
  type ScenarioResolutions,
  type StoryValue,
} from '@arkham/engine';
import { ASH_STORY } from '../brethren_of_ash/story';
import { SMOKE_AND_MIRRORS_CODES, SMOKE_AND_MIRRORS_RESOLUTIONS } from './cards';

const codes = SMOKE_AND_MIRRORS_CODES;
const yes: StoryValue = { kind: 'flag', value: true };
const no: StoryValue = { kind: 'flag', value: false };
const elite = trait('Elite');
/**
 * Beneath the scenario's one act, where the questioned suspects lie face up. It has advanced out
 * of the game by the time a resolution reads it, so it is named by its only copy.
 */
const beneathTheAct = beneath(onlyCopy(codes.augursOfFlame));

/** Translation key prefix for the steps the players do by hand. */
const byHandKeyPrefix = 'scenario.smokeAndMirrors.resolution';

/** "Add 2 [cultist] tokens to the chaos bag for the remainder of the campaign" (setup). */
const twoCultistTokens: readonly ResolutionStep[] = [
  { kind: 'addChaosToken', token: 'cultist' },
  { kind: 'addChaosToken', token: 'cultist' },
];

/** "Reveal the enemy … that was set aside": the suspect setup set aside is the harbinger. */
const revealTheHarbinger: ResolutionStep = {
  kind: 'recordNames',
  key: ASH_STORY.harbingerOfElokoss,
  names: [
    codes.davidRenfield,
    codes.corneliaAkely,
    codes.naomiOBannion,
    codes.sgtEarlMonroe,
    codes.abigailForeman,
    codes.margaretLiu,
  ].map((code) => ({ code, when: thereAre(eachInZone(setAside, { code }), { min: 1 }) })),
};

const killedTheServant: ResolutionStep = {
  kind: 'when',
  condition: thereAre(eachInZone(victoryDisplay, { code: codes.servantOfFlame }), { min: 1 }),
  then: [{ kind: 'record', key: ASH_STORY.killedTheServantOfFlame, value: yes }],
};

/** Victory points plus "1 bonus experience for each enemy beneath the act". */
const experience: ResolutionStep = {
  kind: 'awardXp',
  to: 'each',
  bonus: 0,
  victoryDisplay: true,
  perCardIn: eachInZone(beneathTheAct),
};

/**
 * The guide's question whether anyone was told to add Mark of Elokoss: Arkham Alive's reverse
 * side gave each investigator one, so once it advanced (out of the game) they are its bearers.
 * Like the guide, it asks the whole group: someone eliminated before the agenda advanced drew
 * none, and the players drop their entry from the proposal.
 */
const bearMarkOfElokoss: ResolutionStep = {
  kind: 'when',
  condition: thereAre(eachInZone(outOfGame, { code: codes.arkhamAlive }), { min: 1 }),
  then: [{ kind: 'earnCard', to: 'each', card: codes.markOfElokoss }],
};

const upgradeDecks: ResolutionStep = { kind: 'byHand', textKey: `${byHandKeyPrefix}.upgradeDecks` };

/**
 * The end both resolutions share: with the Servant of Flame beneath the act, Resolution 2 follows
 * (it escaped, 1 bonus experience); then the Mark of Elokoss and the deck upgrades.
 */
const servantBeneathTheAct: ResolutionStep = {
  kind: 'when',
  condition: thereAre(eachInZone(beneathTheAct, { code: codes.servantOfFlame }), { min: 1 }),
  then: [
    { kind: 'record', key: ASH_STORY.theServantOfFlameEscaped, value: yes },
    { kind: 'awardXp', to: 'each', bonus: 1, victoryDisplay: false },
    bearMarkOfElokoss,
    upgradeDecks,
  ],
  otherwise: [bearMarkOfElokoss, upgradeDecks],
};

/**
 * Smoke and Mirrors' resolutions, in the campaign guide's order of steps. Without a resolution
 * the players draw one of the Elite enemies in play or beneath a location, with the harbinger,
 * at random, and record whether they found the cult by what they drew. Resolution 2 is no
 * ending of its own: both resolutions lead into it when the Servant of Flame is beneath the act.
 */
export const smokeAndMirrorsResolutions: ScenarioResolutions = {
  none: [
    ...twoCultistTokens,
    revealTheHarbinger,
    { kind: 'byHand', textKey: `${byHandKeyPrefix}.drawForTheHarbinger` },
    { kind: 'recordChoice', key: ASH_STORY.discoveredTheCultsWhereabouts, values: [no, yes] },
    killedTheServant,
    experience,
    servantBeneathTheAct,
  ],
  byId: {
    [SMOKE_AND_MIRRORS_RESOLUTIONS.culpritFound]: [
      ...twoCultistTokens,
      { kind: 'record', key: ASH_STORY.discoveredTheCultsWhereabouts, value: yes },
      revealTheHarbinger,
      killedTheServant,
      {
        kind: 'when',
        condition: thereAre(eachInZone(beneathTheAct, { trait: elite }), { min: 6 }),
        then: [{ kind: 'record', key: ASH_STORY.scouredArkhamForAnswers, value: yes }],
      },
      {
        kind: 'when',
        condition: thereAre(eachInZone(victoryDisplay, { trait: elite }), { min: 6 }),
        then: [{ kind: 'record', key: ASH_STORY.stirredUpTrouble, value: yes }],
      },
      experience,
      servantBeneathTheAct,
    ],
  },
};
