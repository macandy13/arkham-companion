import {
  GRID_CELLS_PER_CARD,
  doomInPlay,
  enemiesOnTable,
  mapId,
  scenario,
  scenarioDeck,
  scenarioId,
  trait,
  type AddMapStep,
  type MapConnection,
  type MapLocation,
  type ScenarioDefinition,
  type TokenValue,
} from '@arkham/engine';
import { GATHERING_CODES, GATHERING_SETS } from '../the_gathering/cards';
import { theGathering } from '../the_gathering/scenario';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import { MIDNIGHT_MASKS_CODES, MIDNIGHT_MASKS_SETS } from './cards';
import { theMidnightMasksResolutions } from './resolutions';

const codes = MIDNIGHT_MASKS_CODES;
const sets = MIDNIGHT_MASKS_SETS;
/** One card step on the layout grid, which is finer than a card. */
const oneCard = GRID_CELLS_PER_CARD;

/** Acolyte's "after it enters play: place 1 doom on it" triggers during setup too (FAQ). */
const acolyteDoom = { doom: 1 };

/** Translation key prefix for The Midnight Masks' reference card effects. */
const reference = 'scenario.theMidnightMasks.reference';

/**
 * The skull token's "-X": on Easy/Standard X is the most doom on one Cultist
 * enemy in play, on Hard/Expert the doom in play all together (agenda
 * included). Both sides print a "-X", so the value checks the difficulty.
 */
const doomOfTheCult: TokenValue = (ctx, state) => {
  if (scenario.pickReferenceSide(state.meta.difficulty) === 'hardExpert')
    return 0 - doomInPlay(state);
  const cultistDoom = enemiesOnTable(ctx, state, trait('Cultist')).map(
    (card) => card.tokens.doom ?? 0,
  );
  // Subtracting from 0 rather than negating keeps "no doom" a plain 0, not -0, in the trace.
  return 0 - Math.max(0, ...cultistDoom);
};

/**
 * Arkham's 3×3 grid as the campaign guide lays it out, Downtown and
 * Southside each one of their two versions. The connections are the symbols
 * printed on the location cards' revealed sides (read from the ArkhamDB
 * pictures; no card data has them); Rivertown is the hub. Without Your House
 * (burned down in The Gathering) the bottom right cell stays empty.
 */
function arkham(withYourHouse: boolean): AddMapStep {
  const locations: MapLocation[] = [
    { code: codes.northside, at: { column: 0, row: 0 } },
    {
      code: codes.downtownFirstBank,
      versions: [codes.downtownArkhamAsylum],
      at: { column: oneCard, row: 0 },
    },
    { code: codes.easttown, at: { column: 2 * oneCard, row: 0 } },
    { code: codes.miskatonicUniversity, at: { column: 0, row: oneCard } },
    { code: codes.rivertown, at: { column: oneCard, row: oneCard } },
    { code: codes.graveyard, at: { column: 2 * oneCard, row: oneCard } },
    { code: codes.stMarysHospital, at: { column: 0, row: 2 * oneCard } },
    {
      code: codes.southsideHistoricalSociety,
      versions: [codes.southsideMasBoardingHouse],
      at: { column: oneCard, row: 2 * oneCard },
    },
  ];
  const connections: MapConnection[] = [
    { from: codes.rivertown, to: codes.easttown },
    { from: codes.rivertown, to: codes.miskatonicUniversity },
    { from: codes.rivertown, to: codes.southsideHistoricalSociety },
    { from: codes.rivertown, to: codes.graveyard },
    { from: codes.southsideHistoricalSociety, to: codes.miskatonicUniversity },
    { from: codes.southsideHistoricalSociety, to: codes.stMarysHospital },
    { from: codes.stMarysHospital, to: codes.miskatonicUniversity },
    { from: codes.miskatonicUniversity, to: codes.northside },
    { from: codes.downtownFirstBank, to: codes.easttown },
    { from: codes.downtownFirstBank, to: codes.northside },
  ];
  return {
    kind: 'addMap',
    mapId: mapId('arkham'),
    name: 'Arkham',
    locations: withYourHouse
      ? [...locations, { code: codes.yourHouse, at: { column: 2 * oneCard, row: 2 * oneCard } }]
      : locations,
    connections: withYourHouse
      ? [...connections, { from: codes.rivertown, to: codes.yourHouse }]
      : connections,
  };
}

/**
 * The Midnight Masks (Core Set, 2016, scenario II of Night of the Zealot), set
 * up as the campaign guide describes. In a campaign the log decides whether
 * Your House is in play and the investigators start there (else in
 * Rivertown) and whether the Ghoul Priest, still alive, is shuffled into the
 * encounter deck; a standalone game reads as an empty log, so the house has
 * burned and the priest is dead, as the campaign guide's standalone setup
 * says ("your house has burned to the ground", no Ghoul Priest). The Cult of
 * Umôrdhoth's five unique cultists form the Cultist deck, shuffled, drawn
 * with `DrawFromScenarioDeck` (the act's action, by hand until #468). The
 * Masked Hunter is set aside: it stands for agenda 1's reverse side, which
 * the players flip into play by hand. Pass the whole
 * definition as `EngineContext.scenario` with The Gathering's cards joined
 * in (Chilling Cold, the Ghoul Priest). The bags are the campaign guide's,
 * the same as The Gathering's. The reference card's values are entered by
 * hand from the 2016 Core Set card (Easy/Standard: skull -X, cultist -2,
 * tablet -3; Hard/Expert: skull -X, cultist -2, tablet -4).
 */
export const theMidnightMasks: ScenarioDefinition = {
  id: scenarioId('the-midnight-masks'),
  chaosBag: theGathering.chaosBag,
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      cultist: { modifier: -2, effectKey: `${reference}.easyStandard.cultist` },
      tablet: { modifier: -3, effectKey: `${reference}.easyStandard.tablet` },
    },
    hardExpert: {
      skull: { effectKey: `${reference}.hardExpert.skull` },
      cultist: { modifier: -2, effectKey: `${reference}.hardExpert.cultist` },
      tablet: { modifier: -4, effectKey: `${reference}.hardExpert.tablet` },
    },
  },
  agendaDeck: [codes.predatorOrPrey, codes.timeIsRunningShort],
  actDeck: [codes.uncoveringTheConspiracy],
  setup: [
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ZEALOT_STORY.houseStillStanding, value: true },
      then: [arkham(true), { kind: 'moveInvestigators', to: codes.yourHouse }],
      otherwise: [arkham(false), { kind: 'moveInvestigators', to: codes.rivertown }],
    },
    {
      kind: 'scenarioDeck',
      deck: 'cultist',
      codes: [
        codes.wolfManDrew,
        codes.hermanCollins,
        codes.peterWarren,
        codes.victoriaDevereux,
        codes.ruthTurner,
      ],
    },
    { kind: 'shuffle', zone: scenarioDeck('cultist') },
    { kind: 'setAside', codes: [codes.theMaskedHunter] },
    {
      kind: 'whenPlayers',
      atLeast: 2,
      then: [
        {
          kind: 'spawn',
          code: codes.acolyte,
          at: codes.southsideHistoricalSociety,
          tokens: acolyteDoom,
        },
      ],
    },
    {
      kind: 'whenPlayers',
      atLeast: 3,
      then: [
        { kind: 'spawn', code: codes.acolyte, at: codes.downtownFirstBank, tokens: acolyteDoom },
      ],
    },
    {
      kind: 'whenPlayers',
      atLeast: 4,
      then: [{ kind: 'spawn', code: codes.acolyte, at: codes.graveyard, tokens: acolyteDoom }],
    },
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ZEALOT_STORY.ghoulPriestStillAlive, value: true },
      then: [{ kind: 'shuffleIntoEncounterDeck', codes: [GATHERING_CODES.ghoulPriest] }],
    },
    {
      kind: 'buildEncounterDeck',
      sets: [
        sets.theMidnightMasks,
        GATHERING_SETS.chillingCold,
        sets.nightgaunts,
        sets.darkCult,
        sets.lockedDoors,
      ],
    },
  ],
  modifiers: { tokenValues: { skull: doomOfTheCult } },
  resolutions: theMidnightMasksResolutions,
};
