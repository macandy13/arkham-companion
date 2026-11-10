import {
  cardCode,
  cardStats,
  fixed,
  GRID_CELLS_PER_CARD,
  isInPlay,
  mapId,
  perInvestigator,
  scenario,
  scenarioId,
  trait,
  type CardCode,
  type ChaosToken,
  type Difficulty,
  type ScenarioDefinition,
  type TokenValue,
} from '@arkham/engine';
import { ASH_STORY } from '../brethren_of_ash/story';
import { SPREADING_FLAMES_CODES } from '../spreading_flames/cards';
import { spreadingFlames } from '../spreading_flames/scenario';
import { QUEEN_OF_ASH_CODES, QUEEN_OF_ASH_SETS } from './cards';

const codes = QUEEN_OF_ASH_CODES;
const fire = SPREADING_FLAMES_CODES.fire;

/** The map of the Arkham sewers, the only one Queen of Ash plays on. */
export const SEWERS = mapId('sewers');

/** Translation key prefix for Queen of Ash's reference card effects. */
const reference = 'scenario.queenOfAsh.reference';

const oneCard = GRID_CELLS_PER_CARD;

/** The five Sewer Tunnels, which setup shuffles and puts into play unrevealed in a row. */
const SEWER_TUNNELS: readonly CardCode[] = [
  codes.infestedPipes,
  codes.overgrownTunnels,
  codes.floodedCrypt,
  codes.smugglersCache,
  codes.toxicWastePit,
];

/**
 * Each Cultist enemy of the Ashen Pilgrims and Cultists sets, one entry per copy: the Cantors of
 * Flame, the Zealots and the Dark Magician.
 */
const CULTISTS: readonly CardCode[] = [
  ...Array<CardCode>(2).fill(codes.cantorOfFlame),
  ...Array<CardCode>(3).fill(codes.zealot),
  codes.darkMagician,
];

/**
 * The intro's tokens "for the remainder of the campaign", by difficulty; Queen of Ash is the
 * campaign's last scenario, so adding them to this scenario's bag is all that remains of it.
 */
const INTRO_TOKENS: Readonly<Record<Difficulty, readonly ChaosToken[]>> = {
  easy: ['elderThing'],
  standard: ['elderThing', 'tablet'],
  hard: ['elderThing', 'tablet', 'skull'],
  expert: ['elderThing', 'tablet', 'cultist', 'skull'],
};

/** Whether the reference card's Hard/Expert side is in use. */
const hardExpert = (difficulty: Difficulty) =>
  scenario.pickReferenceSide(difficulty) === 'hardExpert';

/**
 * The skull token's "-X": X is the number of Fire! treacheries in play, twice that on
 * Hard/Expert.
 */
const firesInPlay: TokenValue = (_ctx, state) => {
  const fires = Object.values(state.cards).filter(
    (card) => card.code === fire && isInPlay(state, card),
  ).length;
  // Subtracting from 0 rather than negating keeps "none" a plain 0, not -0, in the trace.
  return 0 - fires * (hardExpert(state.meta.difficulty) ? 2 : 1);
};

/**
 * The tablet's -2, or -4 at a Ritual Site location on Easy/Standard; -4 on Hard/Expert, whose
 * automatic failure at a Ritual Site is its effect.
 */
const ritualSite: TokenValue = (ctx, state, test) => {
  if (hardExpert(state.meta.difficulty)) return -4;
  const locationId = state.investigators.find(({ id }) => id === test.investigatorId)?.locationId;
  const location = locationId === undefined ? undefined : state.cards[locationId];
  const atRitualSite =
    location !== undefined &&
    cardStats(ctx.cards, location.code).traits?.includes(trait('Ritual Site')) === true;
  return atRitualSite ? -4 : -2;
};

/**
 * Queen of Ash (Core Set, 2026, scenario III of Brethren of Ash), set up as the campaign guide
 * describes: the intro's chaos tokens for the difficulty and 1 doom unless the investigators
 * discovered the cult's whereabouts (Intro 3); Underground Cistern above the five Sewer Tunnels,
 * shuffled and unrevealed, above Sewer Culvert, where the investigators start, which its text
 * connects to each tunnel; 1 clue each when they scoured Arkham for answers, and 1 Cultist enemy
 * per investigator at different tunnels when they stirred up trouble; the Servant of Flame set
 * aside unless they killed it, 1 more doom with 3 or 4 investigators, and Sluice Control, the
 * Fire! copies, both Collectors, Elokoss, Queen's Knight and Herald of Flame set aside.
 * A standalone game has no log, so it takes Intro 3 and the Servant set aside: our reading, as the
 * guide has no standalone note for this scenario. Its bag is Spreading Flames' with Smoke and
 * Mirrors' 2 cultist tokens, the log's in a campaign. The reference card (12168) is entered by
 * hand from ArkhamDB; the cultist's "reveal another token" against a Cultist enemy, the tablet's
 * automatic failure at a Ritual Site on Hard/Expert and the elder thing's Fire! draw are done by
 * hand.
 */
export const queenOfAsh: ScenarioDefinition = {
  id: scenarioId('queen-of-ash'),
  chaosBag: {
    easy: [...spreadingFlames.chaosBag.easy, 'cultist', 'cultist'],
    standard: [...spreadingFlames.chaosBag.standard, 'cultist', 'cultist'],
    hard: [...spreadingFlames.chaosBag.hard, 'cultist', 'cultist'],
    expert: [...spreadingFlames.chaosBag.expert, 'cultist', 'cultist'],
  },
  referenceCode: cardCode('12168'),
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      cultist: { modifier: -2, effectKey: `${reference}.easyStandard.cultist` },
      tablet: { effectKey: `${reference}.easyStandard.tablet` },
      elderThing: { modifier: -3, effectKey: `${reference}.easyStandard.elderThing` },
    },
    hardExpert: {
      skull: { effectKey: `${reference}.hardExpert.skull` },
      cultist: { modifier: -3, effectKey: `${reference}.hardExpert.cultist` },
      tablet: { effectKey: `${reference}.hardExpert.tablet` },
      elderThing: { modifier: -5, effectKey: `${reference}.hardExpert.elderThing` },
    },
  },
  agendaDeck: [codes.aGathering, codes.aRitual, codes.brethrenOfAsh],
  actDeck: [codes.searchTheSewers, codes.stopTheRite],
  setup: [
    { kind: 'addChaosTokens', tokens: INTRO_TOKENS },
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ASH_STORY.discoveredTheCultsWhereabouts, value: true },
      then: [],
      otherwise: [
        { kind: 'placeTokens', target: codes.aGathering, token: 'doom', amount: fixed(1) },
      ],
    },
    {
      kind: 'addMap',
      mapId: SEWERS,
      name: 'Sewers',
      locations: [
        { code: codes.undergroundCistern, at: { column: 2 * oneCard, row: 0 } },
        { code: codes.sewerCulvert, at: { column: 2 * oneCard, row: 2 * oneCard } },
      ],
      atRandom: {
        codes: SEWER_TUNNELS,
        cells: SEWER_TUNNELS.map((_, index) => ({ column: index * oneCard, row: oneCard })),
      },
      connections: SEWER_TUNNELS.map((tunnel) => ({ from: codes.sewerCulvert, to: tunnel })),
    },
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ASH_STORY.scouredArkhamForAnswers, value: true },
      then: [{ kind: 'investigatorsStartWith', clues: 1 }],
    },
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ASH_STORY.stirredUpTrouble, value: true },
      then: [
        {
          kind: 'spawnAtRandom',
          codes: CULTISTS,
          count: perInvestigator(1),
          at: SEWER_TUNNELS,
          // A Zealot places 1 doom on itself as it enters play.
          tokens: { [codes.zealot]: { doom: 1 } },
        },
      ],
    },
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ASH_STORY.killedTheServantOfFlame, value: true },
      then: [],
      otherwise: [{ kind: 'setAside', codes: [codes.servantOfFlame] }],
    },
    {
      kind: 'whenPlayers',
      atLeast: 3,
      then: [{ kind: 'placeTokens', target: codes.aGathering, token: 'doom', amount: fixed(1) }],
    },
    {
      kind: 'setAside',
      codes: [
        codes.sluiceControl,
        ...Array<CardCode>(5).fill(fire),
        codes.collector,
        codes.collector,
        codes.elokoss,
        codes.queensKnight,
        codes.heraldOfFlame,
      ],
    },
    { kind: 'moveInvestigators', to: codes.sewerCulvert },
    {
      kind: 'buildEncounterDeck',
      sets: Object.values(QUEEN_OF_ASH_SETS),
      // A killed Servant of Flame is removed from the game rather than set aside.
      exclude: [codes.servantOfFlame],
    },
  ],
  modifiers: { tokenValues: { skull: firesInPlay, tablet: ritualSite } },
};
