import {
  GRID_CELLS_PER_CARD,
  advanceAct,
  advanceBySpendingCluesAtRoundEnd,
  afterDiscoveringClues,
  cardCode,
  cardDbFrom,
  checkDoomThreshold,
  decisionId,
  defeatEachInvestigator,
  discardEachEnemy,
  discardFromHand,
  discardSelf,
  eachInvestigator,
  encounterSetCode,
  fixed,
  eachSetAsideCopyTo,
  endScenario,
  fromSetAside,
  gainSurge,
  heal,
  ifYouHave,
  itsLocation,
  leadDecides,
  mapId,
  onlyCopy,
  perInvestigator,
  placeCluesOn,
  placeDoomOnAgenda,
  putIntoThreatArea,
  putLocationIntoPlay,
  removeFromGame,
  resignAction,
  resolutionId,
  setAsideCard,
  skillTest,
  skillTestOfEither,
  spawnEnemyAt,
  takeDamageAndHorror,
  takeHorror,
  trait,
  whenAdvanced,
  whenDefeated,
  whenEnemyDefeated,
  whenRevealed,
  youMustEither,
  type CardDb,
  type CardStats,
  type GridCell,
} from '@arkham/engine';
import { act, agenda, enemy, location, picturesOf, prey, treachery } from '../card_builders';

/**
 * ArkhamDB encounter set codes of Spreading Flames, the first scenario of the Core Set (2026)
 * campaign, Brethren of Ash: the scenario's own set plus the sets its setup gathers.
 */
export const SPREADING_FLAMES_SETS = {
  spreadingFlames: encounterSetCode('spreading_flames'),
  miskatonicUniversity: encounterSetCode('miskatonic_university'),
  ashenPilgrims: encounterSetCode('ashen_pilgrims'),
  bystanders: encounterSetCode('bystanders'),
  cosmicEvils: encounterSetCode('cosmic_evils'),
  eldritchLore: encounterSetCode('eldritch_lore'),
  hallucinations: encounterSetCode('hallucinations'),
  fire: encounterSetCode('fire_ch2'),
  madScience: encounterSetCode('mad_science'),
} as const;

/** ArkhamDB card codes of the cards the scenario definition refers to by name. */
export const SPREADING_FLAMES_CODES = {
  pastCurfew: cardCode('12106'),
  litUp: cardCode('12107'),
  wildFlames: cardCode('12108'),
  whereTheresSmoke: cardCode('12109'),
  escapeTheDorms: cardCode('12110'),
  searchingForDrArmitage: cardCode('12111'),
  blazeOfGlory: cardCode('12112'),
  yourFriendsRoom: cardCode('12113'),
  servantOfFlame: cardCode('12114'),
  drHenryArmitage: cardCode('12115'),
  miskatonicQuad: cardCode('12116'),
  dormitories: cardCode('12117'),
  scienceHall: cardCode('12118'),
  warrenObservatory: cardCode('12119'),
  orneLibrary: cardCode('12120'),
  fire: cardCode('12129'),
} as const;

/**
 * Id of Cosmic Evils' question to its drawer: place 1 doom on the agenda, or take 1 damage and
 * 1 horror and draw again (surge).
 */
export const COSMIC_EVILS_DECISION = decisionId('spreadingFlames.cosmicEvils');

/** Id of Noxious Smoke's question to its drawer: test willpower or agility. */
export const NOXIOUS_SMOKE_DECISION = decisionId('spreadingFlames.noxiousSmoke');

/** Id of "Where There's Smoke…"'s question as the round ends: spend the clues to advance? */
export const WHERE_THERES_SMOKE_DECISION = decisionId('spreadingFlames.whereTheresSmoke');

/**
 * Spreading Flames' resolutions as the campaign guide numbers them. Resolution 1 always leads on
 * to 2 or 3 (stay and fight the fire, or go with Dr. Armitage), so the game ends with one of those.
 */
export const SPREADING_FLAMES_RESOLUTIONS = {
  stayed: resolutionId('R2'),
  went: resolutionId('R3'),
} as const;

/** Id of Resolution 1's question to the lead investigator: stay and fight the fire, or go? */
export const STAY_OR_GO_DECISION = decisionId('spreadingFlames.stayOrGo');

/** Id of "Searching for Dr. Armitage"'s question as the round ends: spend the clues to advance? */
export const SEARCHING_FOR_ARMITAGE_DECISION = decisionId('spreadingFlames.searchingForArmitage');

/** The campus, the one map of Spreading Flames: setup starts it with Your Friend's Room. */
export const CAMPUS = mapId('campus');

/** The layout cell `columns` and `rows` card steps from the top left corner. */
function cardStep(columns: number, rows: number): GridCell {
  return { column: columns * GRID_CELLS_PER_CARD, row: rows * GRID_CELLS_PER_CARD };
}

/**
 * Where each campus location goes. The campaign guide gives no layout, so the cells are our own:
 * Miskatonic Quad in the middle with Science Hall above it, Warren Observatory to its right, Orne
 * Library below it and the Dormitories to its left, under Your Friend's Room.
 */
export const CAMPUS_CELLS = {
  yourFriendsRoom: cardStep(0, 0),
  dormitories: cardStep(0, 1),
  miskatonicQuad: cardStep(1, 1),
  scienceHall: cardStep(1, 0),
  warrenObservatory: cardStep(2, 1),
  orneLibrary: cardStep(1, 2),
} as const;

const codes = SPREADING_FLAMES_CODES;
const sets = SPREADING_FLAMES_SETS;
const own = sets.spreadingFlames;
const cosmicEvils = 'scenario.spreadingFlames.cosmicEvils';
const stayOrGo = 'scenario.spreadingFlames.stayOrGo';
/** ArkhamDB has the Core Set (2026)'s pictures as JPEGs. */
const jpg = 'jpg';

/**
 * Hand-entered card data for Spreading Flames, keyed by the real ArkhamDB codes; like The
 * Gathering's, only names, codes, numbers, traits, keywords and abilities (test skills and
 * difficulties checked against ArkhamDB's Core Set (2026) data), no card text, JSON or images.
 * `arkhamdb_check.test.ts` holds the stats to ArkhamDB's data.
 *
 * Effects the engine has no rule for yet are left out, so the players resolve them from the card:
 *
 * - Past Curfew's and Lit Up's reverse sides (each investigator tests, MC2.13; Lit Up's Fire! "if
 *   they are still set aside")
 * - Escape the Dorms' objective (each undefeated investigator at Miskatonic Quad, MC2.14)
 * - Searching for Dr. Armitage's reverse side: Dr. Henry Armitage under any investigator's
 *   control (MC2.14) and the lead's search for Fire!
 * - the agendas' Parley (test intellect (2) to discard a Bystander at your location): it can be
 *   taken only with a Bystander there, a condition actions can't state yet; Wild Flames draws Fire!
 *   after doom is placed on it (MC2.1)
 * - Blaze of Glory's group clue spend to deal damage to an enemy
 * - Your Friend's Room's Engage action, Miskatonic Quad's free move, Warren Observatory's draw
 *   (MC2.3) and Orne Library's two-action draw (MC1.12)
 * - Dr. Henry Armitage's skill bonus and free first action: his controller's to apply, like a
 *   player card's
 * - Hellhound's discard after its enemy phase attacks, and Bystander's Doomed (MC2.6)
 * - Unspeakable Truths' limit of 1 per investigator, its horror after its holder discovers clues
 *   and its two-action discard
 * - Forbidden Secrets' intellect (3) test (when its drawer has clues) and Wild Compulsion's
 *   willpower (3) test, each with a choice per point failed
 * - Extraplanar Visions' test of X difficulty, and Mutated!'s test with its +2 difficulty while an
 *   enemy is at the drawer's location and its choice on a fail (MC2.5)
 * - Fire!'s attachment to the nearest location without one and its damage as the investigation
 *   phase ends
 */
export const spreadingFlamesCardDefs: readonly CardStats[] = [
  agenda({
    code: codes.pastCurfew,
    name: 'Past Curfew',
    set: own,
    pictures: jpg,
    stage: 1,
    doom: 3,
  }),
  agenda({
    code: codes.litUp,
    name: 'Lit Up',
    set: own,
    pictures: jpg,
    stage: 2,
    doom: 5,
  }),
  agenda({
    code: codes.wildFlames,
    name: 'Wild Flames',
    set: own,
    pictures: jpg,
    stage: 3,
    doom: 10,
    abilities: [whenAdvanced(defeatEachInvestigator({ trauma: 'physical' }))],
  }),
  act({
    code: codes.whereTheresSmoke,
    name: "Where There's Smoke...",
    set: own,
    pictures: jpg,
    stage: 1,
    // The Dormitories come into play before the Servant of Flame spawns there.
    abilities: [
      advanceBySpendingCluesAtRoundEnd(WHERE_THERES_SMOKE_DECISION, perInvestigator(2)),
      whenAdvanced(
        discardEachEnemy(),
        ...putLocationIntoPlay(codes.dormitories, CAMPUS, { at: CAMPUS_CELLS.dormitories }),
        ...putLocationIntoPlay(codes.miskatonicQuad, CAMPUS, { at: CAMPUS_CELLS.miskatonicQuad }),
        spawnEnemyAt(onlyCopy(codes.servantOfFlame), onlyCopy(codes.dormitories)),
        fromSetAside([codes.fire], { kind: 'attachedTo', hostId: onlyCopy(codes.yourFriendsRoom) }),
        // However many are left: Lit Up's reverse side may have placed four of them already.
        eachSetAsideCopyTo(codes.fire, { kind: 'encounterDiscard' }),
      ),
    ],
  }),
  act({
    code: codes.escapeTheDorms,
    name: 'Escape the Dorms',
    set: own,
    pictures: jpg,
    stage: 2,
    // Setting it aside heals the Servant of Flame, wherever it is, even from the victory display.
    abilities: [
      whenAdvanced(
        setAsideCard(onlyCopy(codes.servantOfFlame)),
        discardEachEnemy(),
        removeFromGame(onlyCopy(codes.yourFriendsRoom)),
        ...putLocationIntoPlay(codes.orneLibrary, CAMPUS, { at: CAMPUS_CELLS.orneLibrary }),
        ...putLocationIntoPlay(codes.scienceHall, CAMPUS, { at: CAMPUS_CELLS.scienceHall }),
        ...putLocationIntoPlay(codes.warrenObservatory, CAMPUS, {
          at: CAMPUS_CELLS.warrenObservatory,
        }),
      ),
    ],
  }),
  act({
    code: codes.searchingForDrArmitage,
    name: 'Searching for Dr. Armitage',
    set: own,
    pictures: jpg,
    stage: 3,
    abilities: [
      advanceBySpendingCluesAtRoundEnd(
        SEARCHING_FOR_ARMITAGE_DECISION,
        perInvestigator(3),
        codes.orneLibrary,
      ),
      // "Put into play" engages like a spawn: a ready enemy engages an investigator at its location.
      whenAdvanced(
        spawnEnemyAt(onlyCopy(codes.servantOfFlame), onlyCopy(codes.miskatonicQuad)),
        placeCluesOn(onlyCopy(codes.miskatonicQuad), perInvestigator(3)),
      ),
    ],
  }),
  act({
    code: codes.blazeOfGlory,
    name: 'Blaze of Glory',
    set: own,
    pictures: jpg,
    stage: 4,
    actions: [resignAction()],
    // Objective: the act advances by itself once the Servant of Flame is defeated; its reverse
    // side is Resolution 1, whose last step chooses between Resolutions 2 and 3.
    abilities: [
      whenEnemyDefeated(codes.servantOfFlame, advanceAct()),
      whenAdvanced(
        leadDecides(STAY_OR_GO_DECISION, `${stayOrGo}.prompt`, [
          {
            id: 'stay',
            label: `${stayOrGo}.stay`,
            effects: [endScenario(SPREADING_FLAMES_RESOLUTIONS.stayed)],
          },
          {
            id: 'go',
            label: `${stayOrGo}.go`,
            effects: [endScenario(SPREADING_FLAMES_RESOLUTIONS.went)],
          },
        ]),
      ),
    ],
  }),
  location({
    code: codes.yourFriendsRoom,
    name: "Your Friend's Room",
    set: own,
    pictures: jpg,
    symbol: 'spade',
    connectsTo: ['triangle'],
    traits: ['Miskatonic'],
    shroud: 2,
    cluesPerInvestigator: 2,
  }),
  enemy({
    code: codes.servantOfFlame,
    name: 'Servant of Flame',
    set: own,
    pictures: jpg,
    traits: ['Humanoid', 'Elite'],
    fight: 4,
    evade: 4,
    health: perInvestigator(5),
    damage: 2,
    horror: 2,
    victory: 2,
    unique: true,
    keywords: [{ name: 'hunter' }, prey('Lowest [agility]'), { name: 'retaliate' }],
  }),
  {
    code: codes.drHenryArmitage,
    name: 'Dr. Henry Armitage',
    typeCode: 'asset',
    unique: true,
    traits: [trait('Ally'), trait('Miskatonic')],
    // His printed sanity (3) isn't entered: no rule reads an ally's sanity yet.
    health: fixed(3),
    encounterCode: own,
    quantity: 1,
    ...picturesOf(codes.drHenryArmitage, 'front', jpg),
  },
  location({
    code: codes.miskatonicQuad,
    name: 'Miskatonic Quad',
    set: sets.miskatonicUniversity,
    pictures: jpg,
    symbol: 'plus',
    // The circle and the heart name locations Spreading Flames never puts into play.
    connectsTo: ['triangle', 'hourglass', 'circle', 'heart', 'square', 'diamond'],
    traits: ['Miskatonic', 'Central'],
    shroud: 1,
    cluesPerInvestigator: 0,
  }),
  location({
    code: codes.dormitories,
    name: 'Dormitories',
    set: sets.miskatonicUniversity,
    pictures: jpg,
    symbol: 'triangle',
    connectsTo: ['spade', 'plus'],
    traits: ['Miskatonic'],
    shroud: 3,
    cluesPerInvestigator: 1,
    actions: [{ effects: [heal('damage', 1), heal('horror', 1)], limit: { per: 'game' } }],
  }),
  location({
    code: codes.scienceHall,
    name: 'Science Hall',
    set: sets.miskatonicUniversity,
    pictures: jpg,
    symbol: 'hourglass',
    connectsTo: ['plus'],
    traits: ['Miskatonic'],
    shroud: 2,
    cluesPerInvestigator: 1,
    victory: 1,
    abilities: [afterDiscoveringClues(discardFromHand(1))],
  }),
  location({
    code: codes.warrenObservatory,
    name: 'Warren Observatory',
    set: sets.miskatonicUniversity,
    pictures: jpg,
    symbol: 'square',
    connectsTo: ['plus'],
    traits: ['Miskatonic'],
    shroud: 3,
    cluesPerInvestigator: 1,
  }),
  location({
    code: codes.orneLibrary,
    name: 'Orne Library',
    set: sets.miskatonicUniversity,
    pictures: jpg,
    symbol: 'diamond',
    connectsTo: ['plus'],
    traits: ['Miskatonic'],
    shroud: 4,
    cluesPerInvestigator: 1,
    victory: 1,
  }),
  enemy({
    code: '12121',
    name: 'Cantor of Flame',
    set: sets.ashenPilgrims,
    pictures: jpg,
    traits: ['Humanoid', 'Cultist'],
    fight: 2,
    evade: 2,
    health: fixed(2),
    damage: 1,
    horror: 0,
    quantity: 2,
    keywords: [{ name: 'retaliate' }],
  }),
  enemy({
    code: '12122',
    name: 'Hellhound',
    set: sets.ashenPilgrims,
    pictures: jpg,
    traits: ['Creature', 'Monster'],
    fight: 2,
    evade: 4,
    health: fixed(3),
    damage: 1,
    horror: 1,
    quantity: 2,
    keywords: [{ name: 'hunter' }],
  }),
  enemy({
    code: '12123',
    name: 'Bystander',
    set: sets.bystanders,
    pictures: jpg,
    traits: ['Humanoid', 'Civilian'],
    fight: 1,
    evade: 1,
    health: fixed(1),
    damage: 1,
    horror: 0,
    quantity: 3,
  }),
  treachery({
    code: '12124',
    name: 'Cosmic Evils',
    set: sets.cosmicEvils,
    pictures: jpg,
    traits: ['Omen'],
    quantity: 3,
    keywords: [{ name: 'peril' }],
    abilities: [
      whenRevealed(
        youMustEither(COSMIC_EVILS_DECISION, `${cosmicEvils}.prompt`, [
          {
            id: 'doom',
            label: `${cosmicEvils}.doom`,
            effects: [placeDoomOnAgenda(1), checkDoomThreshold()],
          },
          {
            id: 'wounds',
            label: `${cosmicEvils}.wounds`,
            // Direct: the engine puts damage and horror on the investigator, never on assets.
            effects: [takeDamageAndHorror({ damage: 1, horror: 1 }), gainSurge()],
          },
        ]),
      ),
    ],
  }),
  treachery({
    code: '12125',
    name: 'Unspeakable Truths',
    set: sets.eldritchLore,
    pictures: jpg,
    traits: ['Terror'],
    quantity: 2,
    abilities: [whenRevealed(putIntoThreatArea())],
  }),
  treachery({
    code: '12126',
    name: 'Forbidden Secrets',
    set: sets.eldritchLore,
    pictures: jpg,
    traits: ['Pact'],
    quantity: 2,
    abilities: [ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge()))],
  }),
  treachery({
    code: '12127',
    name: 'Extraplanar Visions',
    set: sets.hallucinations,
    pictures: jpg,
    traits: ['Power'],
    quantity: 2,
  }),
  treachery({
    code: '12128',
    name: 'Wild Compulsion',
    set: sets.hallucinations,
    pictures: jpg,
    traits: ['Madness', 'Bane'],
    quantity: 2,
  }),
  treachery({
    code: codes.fire,
    name: 'Fire!',
    set: sets.fire,
    pictures: jpg,
    traits: ['Hazard'],
    quantity: 5,
    actions: [{ effects: [skillTest('agility', 3, { onPass: [discardSelf()] })] }],
  }),
  treachery({
    code: '12130',
    name: 'Noxious Smoke',
    set: sets.fire,
    pictures: jpg,
    traits: ['Hazard'],
    quantity: 2,
    abilities: [
      whenRevealed(
        skillTestOfEither(NOXIOUS_SMOKE_DECISION, ['willpower', 'agility'], 3, {
          perPointFailed: 'damage',
        }),
      ),
    ],
  }),
  treachery({
    code: '12131',
    name: 'Mutated!',
    set: sets.madScience,
    pictures: jpg,
    traits: ['Mutation'],
    quantity: 2,
  }),
  enemy({
    code: '12132',
    name: 'Mutated Experiment',
    set: sets.madScience,
    pictures: jpg,
    traits: ['Creature', 'Mutated'],
    fight: 3,
    evade: 3,
    health: fixed(3),
    damage: 1,
    horror: 1,
    quantity: 2,
    abilities: [whenDefeated(takeHorror(1, eachInvestigator({ at: itsLocation() })))],
  }),
];

/** Card data for Spreading Flames; put it in the `EngineContext` to play it. */
export const spreadingFlamesCards: CardDb = cardDbFrom(spreadingFlamesCardDefs);
