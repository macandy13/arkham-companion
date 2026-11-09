import {
  cardCode,
  GRID_CELLS_PER_CARD,
  inVictoryDisplay,
  mapId,
  perInvestigator,
  scenario,
  scenarioId,
  trait,
  type AddMapStep,
  type CardCode,
  type ScenarioDefinition,
  type SetupStep,
  type TokenValue,
} from '@arkham/engine';
import { ASH_STORY } from '../brethren_of_ash/story';
import { spreadingFlames } from '../spreading_flames/scenario';
import { SMOKE_AND_MIRRORS_CODES, SMOKE_AND_MIRRORS_SETS } from './cards';

const codes = SMOKE_AND_MIRRORS_CODES;

/** The map of Arkham's neighbourhoods, the only one Smoke and Mirrors plays on. */
export const ARKHAM = mapId('arkham');

/** Translation key prefix for Smoke and Mirrors' reference card effects. */
const reference = 'scenario.smokeAndMirrors.reference';

const oneCard = GRID_CELLS_PER_CARD;

/** The suspects of the People of Arkham set; setup sets one aside and deals the rest. */
const SUSPECTS: readonly CardCode[] = [
  codes.davidRenfield,
  codes.corneliaAkely,
  codes.naomiOBannion,
  codes.sgtEarlMonroe,
  codes.abigailForeman,
  codes.margaretLiu,
];

/** The six locations a card is dealt face down beneath, in the campaign guide's order. */
const DEALT_BENEATH: readonly CardCode[] = [
  codes.northside,
  codes.downtownFirstBank,
  codes.southside,
  codes.frenchHill,
  codes.uptownHospital,
  codes.waterfrontDistrict,
];

/**
 * The skull token's "-X": X is the number of Elite enemies in the victory display and beneath
 * the act, and 2 more on Hard/Expert. Both sides print a "-X", so the value checks the difficulty.
 */
const eliteCount: TokenValue = (ctx, state) => {
  const elite = inVictoryDisplay(ctx, state, { trait: trait('Elite'), beneathAct: true }).length;
  const more = scenario.pickReferenceSide(state.meta.difficulty) === 'hardExpert' ? 2 : 0;
  // Subtracting from 0 rather than negating keeps "none" a plain 0, not -0, in the trace.
  return 0 - (elite + more);
};

/** The elder thing's "-1 for each clue you control", -2 each on Hard/Expert. */
const cluesYouControl: TokenValue = (_ctx, state, test) => {
  const clues = state.investigators.find(({ id }) => id === test.investigatorId)?.clues ?? 0;
  const each = scenario.pickReferenceSide(state.meta.difficulty) === 'hardExpert' ? 2 : 1;
  return 0 - clues * each;
};

/**
 * Arkham as the campaign guide lays it out, three rows of three, with one of the two Downtowns,
 * one of the two Uptowns (picked at random) and the given Miskatonic University.
 */
function arkham(miskatonicUniversity: CardCode): AddMapStep {
  return {
    kind: 'addMap',
    mapId: ARKHAM,
    name: 'Arkham',
    locations: [
      { code: codes.northside, at: { column: 0, row: 0 } },
      {
        code: codes.downtownFirstBank,
        versions: [codes.downtownSanatorium],
        at: { column: oneCard, row: 0 },
      },
      { code: codes.easttown, at: { column: 2 * oneCard, row: 0 } },
      { code: miskatonicUniversity, at: { column: 0, row: oneCard } },
      { code: codes.merchantDistrict, at: { column: oneCard, row: oneCard } },
      { code: codes.waterfrontDistrict, at: { column: 2 * oneCard, row: oneCard } },
      {
        code: codes.uptownHospital,
        versions: [codes.uptownMagickShoppe],
        at: { column: 0, row: 2 * oneCard },
      },
      { code: codes.southside, at: { column: oneCard, row: 2 * oneCard } },
      { code: codes.frenchHill, at: { column: 2 * oneCard, row: 2 * oneCard } },
    ],
  };
}

/**
 * "Choose one of them at random and set it aside … Shuffle each remaining card along with the
 * Servant of Flame and deal 1 card facedown beneath" the six locations: one option per suspect
 * that could be the one set aside.
 */
const peopleOfArkham: SetupStep = {
  kind: 'oneAtRandom',
  options: SUSPECTS.map((setAside) => [
    { kind: 'setAside', codes: [setAside] },
    {
      kind: 'dealBeneath',
      codes: [...SUSPECTS.filter((code) => code !== setAside), codes.servantOfFlame],
      beneath: DEALT_BENEATH,
    },
  ]),
};

/**
 * Smoke and Mirrors (Core Set, 2026, scenario II of Brethren of Ash), set up as the campaign
 * guide describes: Arkham's nine neighbourhoods with Miskatonic University In Flames, or its
 * Quiet Campus and 1 more doom once the investigators saved it; the suspects and the Servant of
 * Flame face down beneath six of them; 1 doom per investigator on the agenda; every Mark of
 * Elokoss set aside; and 2 cultist tokens more in the bag. The investigators start at the
 * university. The chaos bag is Spreading Flames' for a standalone game, the log's in a campaign.
 * A standalone game has no log, so it takes the university In Flames: our reading, as the
 * ArkhamCards guide has no standalone note for this scenario. The 2 cultist tokens stay in the
 * campaign bag through the resolutions (MC2.8d).
 * The reference card (12133) is entered by hand from ArkhamDB; the cultist's "reveal another
 * token" against an Elite enemy, the tablet's clue placed on a failure and putting Dr. Henry
 * Armitage into play under his bearer's control are done by hand.
 */
export const smokeAndMirrors: ScenarioDefinition = {
  id: scenarioId('smoke-and-mirrors'),
  chaosBag: spreadingFlames.chaosBag,
  referenceCode: cardCode('12133'),
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      cultist: { modifier: -1, effectKey: `${reference}.easyStandard.cultist` },
      tablet: { modifier: -3, effectKey: `${reference}.easyStandard.tablet` },
      elderThing: { effectKey: `${reference}.easyStandard.elderThing` },
    },
    hardExpert: {
      skull: { effectKey: `${reference}.hardExpert.skull` },
      cultist: { modifier: -3, effectKey: `${reference}.hardExpert.cultist` },
      tablet: { modifier: -4, effectKey: `${reference}.hardExpert.tablet` },
      elderThing: { effectKey: `${reference}.hardExpert.elderThing` },
    },
  },
  agendaDeck: [codes.arkhamAlive, codes.emergentEvils],
  actDeck: [codes.augursOfFlame],
  setup: [
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ASH_STORY.savedMiskatonicUniversity, value: true },
      then: [
        arkham(codes.miskatonicUniversityQuietCampus),
        { kind: 'placeTokens', target: codes.arkhamAlive, token: 'doom', amount: 1 },
        { kind: 'moveInvestigators', to: codes.miskatonicUniversityQuietCampus },
      ],
      otherwise: [
        arkham(codes.miskatonicUniversityInFlames),
        { kind: 'moveInvestigators', to: codes.miskatonicUniversityInFlames },
      ],
    },
    peopleOfArkham,
    { kind: 'placeTokens', target: codes.arkhamAlive, token: 'doom', amount: perInvestigator(1) },
    {
      kind: 'setAside',
      codes: Array<CardCode>(4).fill(codes.markOfElokoss),
    },
    { kind: 'buildEncounterDeck', sets: Object.values(SMOKE_AND_MIRRORS_SETS) },
    { kind: 'addChaosTokens', tokens: ['cultist', 'cultist'] },
  ],
  modifiers: { tokenValues: { skull: eliteCount, elderThing: cluesYouControl } },
};
