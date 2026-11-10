import {
  advanceAct,
  afterEntering,
  atEndOfRound,
  nextAgendaBecomesActAndAgenda,
  cardCode,
  cardDbFrom,
  decisionId,
  duringAct,
  defeatEnemy,
  eachEnemy,
  eachInZone,
  endScenario,
  encounterSetCode,
  fixed,
  forEachInvestigator,
  fromSetAside,
  GRID_CELLS_PER_CARD,
  loseActions,
  mapId,
  moveEnemyTowards,
  onlyCopy,
  perInvestigator,
  putIntoThreatArea,
  putLocationIntoPlay,
  resignAction,
  resolutionId,
  revealLocation,
  shuffleSetAsideIntoEncounterDeck,
  skillTest,
  skillTestOfEither,
  spawnEnemyAt,
  takeHorror,
  trait,
  whenAdvanced,
  whenAnInvestigatorEnters,
  whenEnemyDefeated,
  whenRevealed,
  type CardDb,
  type CardCode,
  type CardStats,
  type EncounterSetCode,
} from '@arkham/engine';
import { act, agenda, enemy, location, picturesOf, treachery } from '../card_builders';
import {
  SPREADING_FLAMES_CODES,
  SPREADING_FLAMES_SETS,
  spreadingFlamesCards,
} from '../spreading_flames/cards';

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

/**
 * Queen of Ash's resolutions, numbered like the campaign guide's: Elokoss defeated (R1, special
 * agenda 3a and act 2b), her rebirth stopped with 5 clues on her (R2), or the sewers flooded from
 * Sluice Control (R3).
 */
export const QUEEN_OF_ASH_RESOLUTIONS = {
  elokossDefeated: resolutionId('R1'),
  rebirthStopped: resolutionId('R2'),
  ritualFlooded: resolutionId('R3'),
} as const;

/** The map of the Arkham sewers, the only one Queen of Ash plays on. */
export const SEWERS = mapId('sewers');

/**
 * The guide's layout cells: Underground Cistern above the row of five Sewer Tunnels, Sewer
 * Culvert below them, and Sluice Control, which act 1b puts into play, beside the cistern.
 */
export const SEWERS_CELLS = {
  undergroundCistern: { column: 2 * GRID_CELLS_PER_CARD, row: 0 },
  sluiceControl: { column: 3 * GRID_CELLS_PER_CARD, row: 0 },
  sewerCulvert: { column: 2 * GRID_CELLS_PER_CARD, row: 2 * GRID_CELLS_PER_CARD },
} as const;

/** Id of Sluice Control's question to the investigator who opens the valve: agility or combat? */
export const SLUICE_CONTROL_DECISION = decisionId('queenOfAsh.sluiceControl');

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

const fire = SPREADING_FLAMES_CODES.fire;

/** "If the Servant of Flame enemy is set aside, spawn it at Underground Cistern" (agenda 1b). */
const spawnServantIfSetAside = spawnEnemyAt(
  eachInZone({ kind: 'setAside' }, { code: codes.servantOfFlame }),
  onlyCopy(codes.undergroundCistern),
);

/** "Each investigator must test [willpower] (4). Each investigator who fails takes 1 direct horror." */
const willpowerOrHorror = skillTest('willpower', 4, { onFail: [takeHorror(1)] });

/**
 * Hand-entered card data for Queen of Ash, keyed by the real ArkhamDB codes; like Smoke and
 * Mirrors', only names, codes, numbers, traits, keywords and abilities (test skills and
 * difficulties checked against ArkhamDB's Core Set (2026) data), no card text, JSON or images.
 * `arkhamdb_check.test.ts` holds the stats to ArkhamDB's data. The scenario reference card comes
 * with the scenario definition. The connection symbols are read from the card pictures: revealing
 * a Sewer Tunnels changes its symbol and, for Overgrown Tunnels, drops its way to Underground
 * Cistern, while Underground Cistern reaches only the triangle and three of the revealed tunnels.
 *
 * Effects the engine has no rule for yet are left out, so the players resolve them from the card:
 *
 * - the agendas' rule that enemies at a location with Fire! attached cannot be damaged, Elokoss's
 *   Mother of Flame side (agenda 2b), agenda 3a's damage instead of doom, and act 2a's clue spend
 *   to discard a Fire!
 * - the additional clue costs to enter Underground Cistern and Sluice Control (MC2.4)
 * - Underground Cistern's clues placed again once it has none, and its discard of ready
 *   non-Elite Cultists as the investigation phase ends, with 1 doom each
 * - Infested Pipes' discard until an enemy, which the entering investigator draws; Flooded
 *   Crypt's horror, Smuggler's Cache's resource and Toxic Waste Pit's discard as a turn ends there
 * - Elokoss: her extra health is entered, but not that she cannot move or make attacks of
 *   opportunity, her clue spend toward Resolution 2, or her Mother of Flame side
 * - Queen's Knight's damage to Elokoss, Herald of Flame's healing after it attacks, and the
 *   Servant of Flame's codex entry as it is defeated
 * - Zealot's doom as it enters play (setup places it on the Zealots it spawns) and Dark
 *   Magician's as the round ends
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
    abilities: [
      whenAdvanced(spawnServantIfSetAside),
      forEachInvestigator(whenAdvanced(willpowerOrHorror)),
    ],
  }),
  agenda({
    code: codes.aRitual,
    name: 'A Ritual',
    set: own,
    pictures: jpg,
    stage: 2,
    doom: 10,
    // "If it is act 1": Elokoss is set aside until act 1b spawns her, so she spawns here instead.
    // Her Mother of Flame side is flipped by hand.
    abilities: [
      duringAct(
        [codes.searchTheSewers],
        whenAdvanced(
          revealLocation(onlyCopy(codes.undergroundCistern)),
          spawnEnemyAt(onlyCopy(codes.elokoss), onlyCopy(codes.undergroundCistern)),
        ),
      ),
      whenAdvanced(nextAgendaBecomesActAndAgenda()),
    ],
  }),
  // Special agenda 3a is both the current act and agenda and prints no doom threshold. Its
  // reverse side kills each investigator, as the end without a resolution does too.
  agenda({
    code: codes.brethrenOfAsh,
    name: 'Brethren of Ash',
    set: own,
    pictures: jpg,
    stage: 3,
    abilities: [
      whenEnemyDefeated(codes.elokoss, endScenario(QUEEN_OF_ASH_RESOLUTIONS.elokossDefeated)),
    ],
  }),
  act({
    code: codes.searchTheSewers,
    name: 'Search the Sewers',
    set: own,
    pictures: jpg,
    stage: 1,
    // The investigator at the cistern draws a Fire!, whose revelation attaches it to the nearest
    // location without one: the cistern itself, as no Fire! is in play before.
    abilities: [
      whenAnInvestigatorEnters(codes.undergroundCistern, advanceAct()),
      whenAdvanced(
        spawnEnemyAt(onlyCopy(codes.elokoss), onlyCopy(codes.undergroundCistern)),
        fromSetAside([fire], { kind: 'attachedTo', hostId: onlyCopy(codes.undergroundCistern) }),
        shuffleSetAsideIntoEncounterDeck([
          ...Array<CardCode>(4).fill(fire),
          codes.queensKnight,
          codes.heraldOfFlame,
        ]),
        ...putLocationIntoPlay(codes.sluiceControl, SEWERS, { at: SEWERS_CELLS.sluiceControl }),
      ),
    ],
  }),
  act({
    code: codes.stopTheRite,
    name: 'Stop the Rite',
    set: own,
    pictures: jpg,
    stage: 2,
    abilities: [
      atEndOfRound(
        // The card names no unengaged enemies, so an engaged Cultist disengages and moves too.
        moveEnemyTowards(
          eachEnemy({ trait: trait('Cultist') }),
          onlyCopy(codes.undergroundCistern),
          { forced: true },
        ),
      ),
      whenEnemyDefeated(codes.elokoss, advanceAct()),
      whenAdvanced(endScenario(QUEEN_OF_ASH_RESOLUTIONS.elokossDefeated)),
    ],
  }),
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
    // Each enemy defeated and each investigator who stayed killed: the scenario ends, and
    // Resolution 3 kills them.
    actions: [
      {
        effects: [
          skillTestOfEither(SLUICE_CONTROL_DECISION, ['agility', 'combat'], 5, {
            onPass: [
              defeatEnemy(eachEnemy({})),
              endScenario(QUEEN_OF_ASH_RESOLUTIONS.ritualFlooded),
            ],
          }),
        ],
      },
    ],
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
