import {
  afterEntering,
  cardCode,
  cardDbFrom,
  encounterSetCode,
  fixed,
  loseActions,
  perInvestigator,
  putIntoThreatArea,
  resignAction,
  skillTest,
  takeHorror,
  trait,
  whenRevealed,
  type CardDb,
  type CardStats,
  type EncounterSetCode,
} from '@arkham/engine';
import {
  act,
  agenda,
  enemy,
  location,
  picturesOf,
  scenarioCard,
  treachery,
} from '../card_builders';
import { SPREADING_FLAMES_SETS, spreadingFlamesCards } from '../spreading_flames/cards';

/**
 * ArkhamDB encounter set codes of Queen of Ash, the third and last scenario of the Core Set
 * (2026) campaign, Brethren of Ash: the scenario's own set plus the sets its setup gathers.
 * Ashen Pilgrims, Cosmic Evils, Hallucinations and Fire! are Spreading Flames' sets too, and their
 * cards come from its card data.
 */
export const QUEEN_OF_ASH_SETS = {
  queenOfAsh: encounterSetCode('queen_of_ash'),
  sewers: encounterSetCode('arkham_sewers'),
  cultists: encounterSetCode('cultists_ch2'),
  reekingDecay: encounterSetCode('reeking_decay'),
  torment: encounterSetCode('torment'),
  ashenPilgrims: SPREADING_FLAMES_SETS.ashenPilgrims,
  cosmicEvils: SPREADING_FLAMES_SETS.cosmicEvils,
  hallucinations: SPREADING_FLAMES_SETS.hallucinations,
  fire: SPREADING_FLAMES_SETS.fire,
} as const;

/** ArkhamDB card codes of the cards the scenario definition refers to by name. */
export const QUEEN_OF_ASH_CODES = {
  aGathering: cardCode('12169'),
  aRitual: cardCode('12170'),
  brethrenOfAsh: cardCode('12171'),
  searchTheSewers: cardCode('12172'),
  stopTheRite: cardCode('12173'),
  undergroundCistern: cardCode('12174'),
  sluiceControl: cardCode('12175'),
  queensKnight: cardCode('12177'),
  heraldOfFlame: cardCode('12178'),
  elokoss: cardCode('12179'),
  servantOfFlame: cardCode('12180'),
  collector: cardCode('12181'),
  sewerCulvert: cardCode('12182'),
  infestedPipes: cardCode('12183'),
  overgrownTunnels: cardCode('12184'),
  floodedCrypt: cardCode('12185'),
  smugglersCache: cardCode('12186'),
  toxicWastePit: cardCode('12187'),
  cantorOfFlame: cardCode('12121'),
  zealot: cardCode('12188'),
  darkMagician: cardCode('12189'),
} as const;

const codes = QUEEN_OF_ASH_CODES;
const sets = QUEEN_OF_ASH_SETS;
const own = sets.queenOfAsh;
/** ArkhamDB has the Core Set (2026)'s pictures as JPEGs. */
const jpg = 'jpg';

/**
 * Each Sewer Tunnels prints the triangle on its unrevealed side, connecting to Sewer Culvert's
 * hourglass and Underground Cistern's circle; revealed, each prints a symbol of its own.
 */
const sewerTunnels = {
  name: 'Sewer Tunnels',
  set: sets.sewers,
  pictures: jpg,
  traits: ['Sewer'],
  unrevealedSymbol: 'triangle',
  unrevealedConnectsTo: ['hourglass', 'circle'],
} as const;

/**
 * Hand-entered card data for Queen of Ash, keyed by the real ArkhamDB codes; like Smoke and
 * Mirrors', only names, codes, numbers, traits, keywords and abilities (test skills and
 * difficulties checked against ArkhamDB's Core Set (2026) data), no card text, JSON or images.
 * `arkhamdb_check.test.ts` holds the stats to ArkhamDB's data. The scenario reference card comes
 * with the scenario definition. The connection symbols are read from the card pictures: revealing
 * a Sewer Tunnels changes its symbol and, for Overgrown Tunnels, drops its way to Underground
 * Cistern, while Underground Cistern reaches only the triangle and three of the revealed tunnels.
 *
 * The agendas' and acts' abilities and reverse sides come with the scenario's setup (MC2.9b).
 * Effects the engine has no rule for yet are left out, so the players resolve them from the card:
 *
 * - the additional clue costs to enter Underground Cistern and Sluice Control (MC2.4)
 * - Underground Cistern's clues placed again once it has none, and its discard of ready
 *   non-Elite Cultists as the investigation phase ends, with 1 doom each
 * - Sluice Control's action (agility or combat (5): each enemy defeated and each investigator who
 *   has not resigned killed, Resolution 3)
 * - Sewer Culvert's connection to each Sewer Tunnels, which setup declares (MC2.9b)
 * - Infested Pipes' discard until an enemy, which the entering investigator draws; Flooded
 *   Crypt's horror, Smuggler's Cache's resource and Toxic Waste Pit's discard as a turn ends there
 * - Elokoss: her extra health is entered, but not that she cannot move or make attacks of
 *   opportunity, her clue spend toward Resolution 2, or her Mother of Flame side
 * - Queen's Knight's damage to Elokoss, Herald of Flame's healing after it attacks, and the
 *   Servant of Flame's codex entry as it is defeated
 * - Zealot's doom as it enters play and Dark Magician's as the round ends
 * - the whole revelations of Ashen Rebirth (2 direct damage or horror, whichever its drawer has
 *   more of), Blasphemous Invocation (doom per point failed, else a Cultist drawn), Unnatural Decay
 *   (doom on an asset or 2 damage), Dissonance and Torment (cards of a named type discarded), and
 *   Putrid Vapors' asset discard
 * - Languor's limit of 1 per investigator, its discard as its holder's turn begins and its
 *   two-action discard
 * - Collector's deckbuilding: the players add it to their decks
 */
export const queenOfAshCardDefs: readonly CardStats[] = [
  agenda({
    code: codes.aGathering,
    name: 'A Gathering',
    set: own,
    pictures: jpg,
    stage: 1,
    doom: 6,
  }),
  agenda({ code: codes.aRitual, name: 'A Ritual', set: own, pictures: jpg, stage: 2, doom: 10 }),
  // Special agenda 3a is both the current act and agenda and prints no doom threshold.
  {
    ...scenarioCard(codes.brethrenOfAsh, 'Brethren of Ash', own, jpg),
    typeCode: 'agenda',
    stage: { number: 3 },
  },
  act({
    code: codes.searchTheSewers,
    name: 'Search the Sewers',
    set: own,
    pictures: jpg,
    stage: 1,
  }),
  act({ code: codes.stopTheRite, name: 'Stop the Rite', set: own, pictures: jpg, stage: 2 }),
  location({
    code: codes.undergroundCistern,
    name: 'Underground Cistern',
    set: own,
    pictures: jpg,
    symbol: 'circle',
    connectsTo: ['triangle', 'plus', 'spade', 'star', 'double_slash'],
    traits: ['Ritual Site'],
    shroud: 4,
    cluesPerInvestigator: 2,
  }),
  location({
    code: codes.sluiceControl,
    name: 'Sluice Control',
    set: own,
    pictures: jpg,
    symbol: 'plus',
    connectsTo: ['circle'],
    traits: ['Sewer'],
    shroud: 4,
    cluesPerInvestigator: 2,
  }),
  treachery({
    code: '12176',
    name: 'Ashen Rebirth',
    set: own,
    pictures: jpg,
    traits: ['Power'],
    quantity: 2,
  }),
  enemy({
    code: codes.queensKnight,
    name: "Queen's Knight",
    set: own,
    pictures: jpg,
    traits: ['Humanoid', 'Cultist'],
    fight: 2,
    evade: 2,
    health: fixed(5),
    damage: 2,
    horror: 0,
    victory: 1,
    unique: true,
    keywords: [{ name: 'hunter' }],
  }),
  enemy({
    code: codes.heraldOfFlame,
    name: 'Herald of Flame',
    set: own,
    pictures: jpg,
    traits: ['Monster'],
    fight: 4,
    evade: 2,
    health: fixed(5),
    damage: 0,
    horror: 2,
    victory: 1,
    unique: true,
    keywords: [{ name: 'hunter' }],
  }),
  enemy({
    code: codes.elokoss,
    name: 'Elokoss',
    set: own,
    pictures: jpg,
    traits: ['Ancient One', 'Flora', 'Elite'],
    fight: 5,
    evade: 5,
    // A printed 5, and "+5 [per_investigator] health" in her text.
    health: { fixed: 5, perInvestigator: 5 },
    damage: 3,
    horror: 3,
    victory: 5,
    unique: true,
    keywords: [{ name: 'massive' }, { name: 'retaliate' }],
  }),
  enemy({
    code: codes.servantOfFlame,
    name: 'Servant of Flame',
    set: own,
    pictures: jpg,
    traits: ['Humanoid', 'Cultist', 'Elite'],
    fight: 4,
    evade: 4,
    health: perInvestigator(5),
    damage: 2,
    horror: 2,
    victory: 2,
    unique: true,
    keywords: [{ name: 'hunter' }, { name: 'retaliate' }],
  }),
  {
    code: codes.collector,
    name: 'Collector',
    typeCode: 'asset',
    traits: [trait('Talent')],
    encounterCode: own,
    quantity: 2,
    ...picturesOf(codes.collector, 'front', jpg),
  },
  location({
    code: codes.sewerCulvert,
    name: 'Sewer Culvert',
    set: sets.sewers,
    pictures: jpg,
    symbol: 'hourglass',
    connectsTo: ['triangle'],
    traits: ['Sewer', 'Central'],
    shroud: 1,
    cluesPerInvestigator: 0,
    actions: [resignAction()],
  }),
  location({
    ...sewerTunnels,
    code: codes.infestedPipes,
    symbol: 'spade',
    connectsTo: ['hourglass', 'circle'],
    shroud: 1,
    cluesPerInvestigator: 1,
  }),
  location({
    ...sewerTunnels,
    code: codes.overgrownTunnels,
    symbol: 'square',
    connectsTo: ['hourglass'],
    shroud: 2,
    cluesPerInvestigator: 1,
    abilities: [afterEntering(loseActions(1))],
  }),
  location({
    ...sewerTunnels,
    code: codes.floodedCrypt,
    symbol: 'star',
    connectsTo: ['hourglass', 'circle'],
    shroud: 4,
    cluesPerInvestigator: 1,
    victory: 1,
  }),
  location({
    ...sewerTunnels,
    code: codes.smugglersCache,
    symbol: 'clover',
    connectsTo: ['hourglass', 'circle'],
    shroud: 3,
    cluesPerInvestigator: 0,
  }),
  location({
    ...sewerTunnels,
    code: codes.toxicWastePit,
    symbol: 'double_slash',
    connectsTo: ['hourglass', 'circle'],
    shroud: 3,
    cluesPerInvestigator: 1,
    victory: 1,
  }),
  enemy({
    code: '12188',
    name: 'Zealot',
    set: sets.cultists,
    pictures: jpg,
    traits: ['Humanoid', 'Cultist'],
    fight: 2,
    evade: 2,
    health: fixed(1),
    damage: 1,
    horror: 0,
    quantity: 3,
    keywords: [{ name: 'aloof' }],
  }),
  enemy({
    code: '12189',
    name: 'Dark Magician',
    set: sets.cultists,
    pictures: jpg,
    traits: ['Humanoid', 'Cultist'],
    fight: 4,
    evade: 2,
    health: fixed(4),
    damage: 1,
    horror: 1,
    victory: 1,
    keywords: [{ name: 'hunter' }, { name: 'retaliate' }],
  }),
  treachery({
    code: '12190',
    name: 'Blasphemous Invocation',
    set: sets.cultists,
    pictures: jpg,
    traits: ['Hex'],
    quantity: 2,
  }),
  treachery({
    code: '12191',
    name: 'Unnatural Decay',
    set: sets.reekingDecay,
    pictures: jpg,
    traits: ['Curse'],
    quantity: 2,
  }),
  treachery({
    code: '12192',
    name: 'Putrid Vapors',
    set: sets.reekingDecay,
    pictures: jpg,
    traits: ['Hazard'],
    quantity: 2,
    abilities: [whenRevealed(skillTest('agility', 3, { onFail: [takeHorror(1)] }))],
  }),
  treachery({
    code: '12193',
    // ArkhamDB spells the card's name "Langour"; the card prints "Languor".
    name: 'Langour',
    set: sets.torment,
    pictures: jpg,
    traits: ['Hex', 'Bane'],
    quantity: 2,
    abilities: [whenRevealed(putIntoThreatArea())],
  }),
  treachery({
    code: '12194',
    name: 'Dissonance',
    set: sets.torment,
    pictures: jpg,
    traits: ['Curse', 'Bane'],
    quantity: 2,
  }),
  treachery({
    code: '12195',
    name: 'Torment',
    set: sets.torment,
    pictures: jpg,
    traits: ['Power', 'Bane'],
    quantity: 2,
    keywords: [{ name: 'peril' }],
  }),
];

/** The sets Queen of Ash shares with Spreading Flames, whose cards its card data reuses. */
const sharedSets: readonly EncounterSetCode[] = [
  sets.ashenPilgrims,
  sets.cosmicEvils,
  sets.hallucinations,
  sets.fire,
];

/**
 * Card data for Queen of Ash, its own cards and the shared sets' from Spreading Flames; put it in
 * the `EngineContext` to play it.
 */
export const queenOfAshCards: CardDb = cardDbFrom([
  ...queenOfAshCardDefs,
  ...sharedSets.flatMap((set) => spreadingFlamesCards.encounterSet(set)),
]);
