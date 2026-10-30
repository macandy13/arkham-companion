import {
  cardStats,
  enemiesOnTable,
  cardCode,
  scenarioId,
  trait,
  type AddMapStep,
  type CardCode,
  type MapConnection,
  type ScenarioDefinition,
  type SetupStep,
  type TokenValue,
} from '@arkham/engine';
import { GATHERING_CODES, GATHERING_SETS } from '../the_gathering/cards';
import { theGathering } from '../the_gathering/scenario';
import {
  MIDNIGHT_MASKS_CODES,
  MIDNIGHT_MASKS_SETS,
  theMidnightMasksCards,
} from '../the_midnight_masks/cards';
import { ZEALOT_STORY } from '../night_of_the_zealot/story';
import {
  DEVOURER_BELOW_CODES,
  DEVOURER_BELOW_SETS,
  MAIN_PATH_CELL,
  WOODS_CORNER_CELLS,
  WOODS_MAP,
} from './cards';
import { theDevourerBelowResolutions } from './resolutions';

const codes = DEVOURER_BELOW_CODES;
const sets = DEVOURER_BELOW_SETS;

/** Translation key prefix for The Devourer Below's reference card effects. */
const reference = 'scenario.theDevourerBelow.reference';

/** The skull token's "-X" on Easy/Standard: X is the number of Monster enemies in play. */
const monstersInPlay: TokenValue = (ctx, state) =>
  // Subtracting from 0 rather than negating keeps "no Monster" a plain 0, not -0, in the trace.
  0 - enemiesOnTable(ctx, state, trait('Monster')).length;

/**
 * The six Arkham Woods around the ring their revealed sides print, each next to the two before
 * and after it (Unhallowed Ground's triangle to Old House's diamond, and so on); read from the
 * ArkhamDB pictures, as no card data has the symbols.
 */
const woodsRing: readonly CardCode[] = [
  codes.arkhamWoodsUnhallowedGround,
  codes.arkhamWoodsOldHouse,
  codes.arkhamWoodsTwistingPaths,
  codes.arkhamWoodsTangledThicket,
  codes.arkhamWoodsQuietGlade,
  codes.arkhamWoodsCliffside,
];

/**
 * The Main Path with 4 of the 6 Arkham Woods at random in the corners around it. The Main Path
 * "is connected to each other Woods location"; the Woods connect to each other along
 * `woodsRing`, but only on their revealed sides, so those connections count once both
 * neighbours are revealed. Setup drops the connections to the 2 Woods left out of the game.
 */
const theWoods: AddMapStep = {
  kind: 'addMap',
  mapId: WOODS_MAP,
  name: 'Arkham Woods',
  locations: [{ code: codes.mainPath, at: MAIN_PATH_CELL }],
  atRandom: {
    codes: woodsRing,
    cells: WOODS_CORNER_CELLS,
  },
  connections: [
    ...woodsRing.map((woods): MapConnection => ({ from: codes.mainPath, to: woods })),
    ...woodsRing.map((woods, i): MapConnection => ({
      from: woods,
      to: woodsRing[(i + 1) % woodsRing.length] ?? woods,
      revealedOnly: true,
    })),
  ],
};

/** "Place 1 doom on agenda 1a" for each step of 2 Cultists who got away (1–2: 1, 3–4: 2, 5–6: 3). */
const doomForCultistsWhoGotAway: readonly SetupStep[] = [1, 3, 5].map((count) => ({
  kind: 'whenStory',
  condition: { kind: 'atLeastNames', key: ZEALOT_STORY.cultistsWhoGotAway, count },
  then: [{ kind: 'placeTokens', target: codes.theArkhamWoods, token: 'doom', amount: 1 }],
}));

/**
 * The unique enemies The Midnight Masks records under "Cultists Who Got Away": its five
 * cultists and The Masked Hunter. Setup sets aside each one recorded, by its name on the
 * list, so that act 1's reverse side ("search the collection for each enemy recorded …")
 * spawns them at the Main Path.
 */
const setAsideCultistsWhoGotAway: readonly SetupStep[] = [
  MIDNIGHT_MASKS_CODES.wolfManDrew,
  MIDNIGHT_MASKS_CODES.hermanCollins,
  MIDNIGHT_MASKS_CODES.peterWarren,
  MIDNIGHT_MASKS_CODES.victoriaDevereux,
  MIDNIGHT_MASKS_CODES.ruthTurner,
  MIDNIGHT_MASKS_CODES.theMaskedHunter,
].map((code) => ({
  kind: 'whenStory',
  condition: {
    kind: 'listsName',
    key: ZEALOT_STORY.cultistsWhoGotAway,
    name: cardStats(theMidnightMasksCards, code).name,
  },
  then: [{ kind: 'setAside', codes: [code] }],
}));

/**
 * The Devourer Below (Core Set, 2016, scenario III of Night of the Zealot), set up as the
 * campaign guide describes: the Main Path and 4 random Arkham Woods, the investigators on the
 * Main Path, the Ritual Site, Umôrdhoth and the cultists who got away set aside, one Agents set at random in the
 * encounter deck, doom on agenda 1 for the Cultists who got away in The Midnight Masks, an
 * elder thing token in the bag, and the Ghoul Priest shuffled in while he is still alive. A
 * standalone game reads as an empty log: no doom and no Ghoul Priest. "It is past midnight"
 * makes each player discard 2 random cards from their opening hand, which the players do by
 * hand. The elder thing token joins this scenario's bag only; as the campaign's last scenario,
 * that is all of "the remainder of the campaign". Pass the whole definition as
 * `EngineContext.scenario` with The Gathering's (Ghouls, Striking Fear, Ancient Evils, the
 * Ghoul Priest) and The Midnight Masks' (Dark Cult, the cultists who got away) cards joined in. The reference card's
 * values are entered by hand from the 2016 Core Set card (Easy/Standard: skull -X, cultist
 * -2, tablet -3, elder thing -5; Hard/Expert: skull -3, cultist -4, tablet -5, elder thing -7).
 */
export const theDevourerBelow: ScenarioDefinition = {
  id: scenarioId('the-devourer-below'),
  chaosBag: theGathering.chaosBag,
  referenceCode: cardCode('01142'),
  reference: {
    easyStandard: {
      skull: { effectKey: `${reference}.easyStandard.skull` },
      cultist: { modifier: -2, effectKey: `${reference}.easyStandard.cultist` },
      tablet: { modifier: -3, effectKey: `${reference}.easyStandard.tablet` },
      elderThing: { modifier: -5, effectKey: `${reference}.easyStandard.elderThing` },
    },
    hardExpert: {
      skull: { modifier: -3, effectKey: `${reference}.hardExpert.skull` },
      cultist: { modifier: -4, effectKey: `${reference}.hardExpert.cultist` },
      tablet: { modifier: -5, effectKey: `${reference}.hardExpert.tablet` },
      elderThing: { modifier: -7, effectKey: `${reference}.hardExpert.elderThing` },
    },
  },
  agendaDeck: [codes.theArkhamWoods, codes.theRitualBegins, codes.vengeanceAwaits],
  actDeck: [codes.investigatingTheTrail, codes.intoTheDarkness, codes.disruptingTheRitual],
  setup: [
    theWoods,
    { kind: 'moveInvestigators', to: codes.mainPath },
    { kind: 'setAside', codes: [codes.ritualSite, codes.umordhoth] },
    ...setAsideCultistsWhoGotAway,
    {
      kind: 'buildEncounterDeck',
      sets: [
        sets.theDevourerBelow,
        GATHERING_SETS.ancientEvils,
        GATHERING_SETS.strikingFear,
        GATHERING_SETS.ghouls,
        MIDNIGHT_MASKS_SETS.darkCult,
      ],
    },
    {
      kind: 'oneAtRandom',
      options: [
        sets.agentsOfYogSothoth,
        sets.agentsOfShubNiggurath,
        sets.agentsOfCthulhu,
        sets.agentsOfHastur,
      ].map((agents) => [{ kind: 'buildEncounterDeck', sets: [agents] }]),
    },
    ...doomForCultistsWhoGotAway,
    { kind: 'addChaosTokens', tokens: ['elderThing'] },
    {
      kind: 'whenStory',
      condition: { kind: 'flag', key: ZEALOT_STORY.ghoulPriestStillAlive, value: true },
      then: [{ kind: 'shuffleIntoEncounterDeck', codes: [GATHERING_CODES.ghoulPriest] }],
    },
  ],
  modifiers: { tokenValues: { skull: monstersInPlay } },
  resolutions: theDevourerBelowResolutions,
};
