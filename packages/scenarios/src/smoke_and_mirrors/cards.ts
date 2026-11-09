import {
  advanceAct,
  attachToLocation,
  atEndOfPhase,
  atEndOfRound,
  cardCode,
  cardDbFrom,
  decisionId,
  discardSelf,
  drawBeneathYourLocation,
  eachInvestigator,
  eachInvestigatorResigns,
  encounterSetCode,
  endScenario,
  fixed,
  fromSetAside,
  itsLocation,
  perInvestigator,
  putIntoThreatArea,
  resignAction,
  resolutionId,
  skillTest,
  skillTestOfEither,
  takeDamage,
  trait,
  whenAdvanced,
  whenRevealed,
  whenVictoryDisplayHolds,
  type CardDb,
  type CardStats,
} from '@arkham/engine';
import { act, agenda, enemy, location, prey, treachery } from '../card_builders';

/**
 * ArkhamDB encounter set codes of Smoke and Mirrors, the second scenario of the Core Set (2026)
 * campaign, Brethren of Ash: the scenario's own set plus the sets its setup gathers.
 */
export const SMOKE_AND_MIRRORS_SETS = {
  smokeAndMirrors: encounterSetCode('smoke_and_mirrors'),
  peopleOfArkham: encounterSetCode('people_of_arkham'),
  arkham: encounterSetCode('arkham_ch2'),
  arcaneLock: encounterSetCode('arcane_lock'),
  badWeather: encounterSetCode('bad_weather'),
  deadEnds: encounterSetCode('dead_ends'),
  flyingTerrors: encounterSetCode('flying_terrors'),
  gangsOfArkham: encounterSetCode('gangs_of_arkham'),
  whippoorwills: encounterSetCode('whippoorwills_ch2'),
} as const;

/** ArkhamDB card codes of the cards the scenario definition refers to by name. */
export const SMOKE_AND_MIRRORS_CODES = {
  arkhamAlive: cardCode('12134'),
  emergentEvils: cardCode('12135'),
  augursOfFlame: cardCode('12136'),
  markOfElokoss: cardCode('12137'),
  servantOfFlame: cardCode('12138'),
  davidRenfield: cardCode('12139'),
  corneliaAkely: cardCode('12140'),
  naomiOBannion: cardCode('12141'),
  sgtEarlMonroe: cardCode('12142'),
  abigailForeman: cardCode('12143'),
  margaretLiu: cardCode('12144'),
  downtownFirstBank: cardCode('12145'),
  downtownSanatorium: cardCode('12146'),
  uptownHospital: cardCode('12147'),
  uptownMagickShoppe: cardCode('12148'),
  northside: cardCode('12149'),
  easttown: cardCode('12150'),
  merchantDistrict: cardCode('12151'),
  waterfrontDistrict: cardCode('12152'),
  southside: cardCode('12153'),
  frenchHill: cardCode('12154'),
  miskatonicUniversityInFlames: cardCode('12155'),
  miskatonicUniversityQuietCampus: cardCode('12156'),
} as const;

/**
 * Smoke and Mirrors' resolutions as the campaign guide numbers them: Augurs of Flame's reverse
 * side leads to Resolution 1; Resolution 2 is the guide's own follow-up (MC2.8d).
 */
export const SMOKE_AND_MIRRORS_RESOLUTIONS = {
  culpritFound: resolutionId('R1'),
  servantEscaped: resolutionId('R2'),
} as const;

/** Id of Arcane Lock's question to the investigator who tests to discard it: willpower or intellect? */
export const ARCANE_LOCK_DECISION = decisionId('smokeAndMirrors.arcaneLock');

const codes = SMOKE_AND_MIRRORS_CODES;
const sets = SMOKE_AND_MIRRORS_SETS;
const own = sets.smokeAndMirrors;
const suspects = sets.peopleOfArkham;
/** ArkhamDB has the Core Set (2026)'s pictures as JPEGs. */
const jpg = 'jpg';

/**
 * Hand-entered card data for Smoke and Mirrors, keyed by the real ArkhamDB codes; like Spreading
 * Flames', only names, codes, numbers, traits, keywords and abilities (test skills and
 * difficulties checked against ArkhamDB's Core Set (2026) data), no card text, JSON or images.
 * `arkhamdb_check.test.ts` holds the stats to ArkhamDB's data. The scenario reference card comes
 * with the scenario definition (`smokeAndMirrors`).
 *
 * The Arkham locations print the same symbol on both sides; the connections are read from the
 * revealed sides: ArkhamDB has no pictures of the unrevealed ones yet, so their tiles fall back to
 * the plain back until it does. The two Downtowns, the
 * two Uptowns and the two Miskatonic Universities share their names: setup puts one of each into
 * play and removes the other from the game.
 *
 * Effects the engine has no rule for yet are left out, so the players resolve them from the card
 * and the campaign guide:
 *
 * - the codex entries (each suspect's and the Servant of Flame's), read from the campaign guide,
 *   with the suspects' Parley actions and reactions that trigger them
 * - the Elusive keyword (Servant of Flame, Sgt. Earl Monroe, Bat Horror; MC2.15)
 * - the Mark of Elokoss each investigator draws as Arkham Alive advances goes into their deck
 * - Mark of Elokoss' damage as its holder's turn ends (assigned to an asset if able) and its
 *   two-action discard
 * - the Arkham locations' reactions and actions (resources, healing, two deck searches, a clue
 *   for 5 resources, a free move, cards drawn, a charge or secret, a Tome or Spell played from the
 *   discard pile: MC2.3, MC2.4), Waterfront District's
 *   additional action to investigate (MC2.4), and the damage Miskatonic University (In Flames)
 *   deals to allies
 * - Arcane Lock's additional action to enter or leave its location (MC2.4)
 * - the whole revelations of Downpour (a choice per point failed), Red Herring (+2 difficulty with
 *   2 or more clues, a clue placed on the location) and Eager for Death (difficulty per damage,
 *   MC2.5), and of Raising Suspicions (doom on the nearest enemy without doom, else surge) and
 *   Aerial Pursuit (the nearest non-Elite enemy moves and attacks; its surge keyword is entered)
 * - Rogue Gangster's lost resource (or attack) after it engages
 * - Whippoorwill's -1 to each skill of each investigator at its location
 */
export const smokeAndMirrorsCardDefs: readonly CardStats[] = [
  agenda({
    code: codes.arkhamAlive,
    name: 'Arkham Alive',
    set: own,
    pictures: jpg,
    stage: 1,
    doom: 10,
    actions: [resignAction()],
    // "Each investigator draws 1 copy of the set-aside Mark of Elokoss": its revelation puts it
    // into their threat area, which makes them its bearer (Grimoire, "Weakness"); adding it to
    // their deck for the rest of the campaign is done by hand.
    abilities: [
      whenAdvanced(
        fromSetAside([codes.markOfElokoss], {
          kind: 'threatArea',
          investigatorId: { ref: 'eachInvestigator' },
        }),
      ),
    ],
  }),
  agenda({
    code: codes.emergentEvils,
    name: 'Emergent Evils',
    set: own,
    pictures: jpg,
    stage: 2,
    doom: 8,
    actions: [resignAction()],
    abilities: [whenAdvanced(eachInvestigatorResigns())],
  }),
  act({
    code: codes.augursOfFlame,
    name: 'Augurs of Flame',
    set: own,
    pictures: jpg,
    stage: 1,
    actions: [
      {
        cost: { spend: 'groupClues', amount: perInvestigator(2) },
        effects: [drawBeneathYourLocation()],
      },
    ],
    abilities: [
      whenVictoryDisplayHolds({ trait: trait('Elite'), beneathAct: true }, 6, advanceAct()),
      whenAdvanced(endScenario(SMOKE_AND_MIRRORS_RESOLUTIONS.culpritFound)),
    ],
  }),
  treachery({
    code: codes.markOfElokoss,
    name: 'Mark of Elokoss',
    set: own,
    pictures: jpg,
    traits: ['Curse'],
    quantity: 4,
    abilities: [whenRevealed(putIntoThreatArea())],
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
    victory: 1,
    unique: true,
    keywords: [{ name: 'hunter' }, { name: 'retaliate' }],
  }),
  enemy({
    code: codes.davidRenfield,
    name: 'David Renfield',
    set: suspects,
    pictures: jpg,
    traits: ['Humanoid', 'Silver Twilight', 'Elite'],
    fight: 1,
    evade: 4,
    health: fixed(5),
    damage: 0,
    horror: 1,
    victory: 1,
    unique: true,
    keywords: [{ name: 'aloof' }],
  }),
  enemy({
    code: codes.corneliaAkely,
    name: 'Cornelia Akely',
    set: suspects,
    pictures: jpg,
    traits: ['Humanoid', 'Worker', 'Elite'],
    fight: 3,
    evade: 3,
    health: fixed(4),
    damage: 1,
    horror: 0,
    victory: 1,
    unique: true,
    keywords: [{ name: 'alert' }],
  }),
  enemy({
    code: codes.naomiOBannion,
    name: "Naomi O'Bannion",
    set: suspects,
    pictures: jpg,
    traits: ['Humanoid', 'Syndicate', 'Elite'],
    fight: 4,
    evade: 2,
    health: fixed(5),
    damage: 1,
    horror: 1,
    victory: 1,
    unique: true,
    keywords: [{ name: 'retaliate' }],
  }),
  enemy({
    code: codes.sgtEarlMonroe,
    name: 'Sgt. Earl Monroe',
    set: suspects,
    pictures: jpg,
    traits: ['Humanoid', 'Police', 'Elite'],
    fight: 3,
    evade: 3,
    health: fixed(4),
    damage: 1,
    horror: 1,
    victory: 1,
    unique: true,
  }),
  enemy({
    code: codes.abigailForeman,
    name: 'Abigail Foreman',
    set: suspects,
    pictures: jpg,
    traits: ['Humanoid', 'Miskatonic', 'Elite'],
    fight: 2,
    evade: 4,
    health: fixed(4),
    damage: 0,
    horror: 1,
    victory: 1,
    unique: true,
    keywords: [{ name: 'aloof' }],
  }),
  enemy({
    code: codes.margaretLiu,
    name: 'Margaret Liu',
    set: suspects,
    pictures: jpg,
    traits: ['Humanoid', 'Socialite', 'Elite'],
    fight: 1,
    evade: 5,
    health: fixed(3),
    damage: 0,
    horror: 1,
    victory: 1,
    unique: true,
    keywords: [{ name: 'aloof' }],
  }),
  location({
    code: codes.downtownFirstBank,
    name: 'Downtown',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'triangle',
    connectsTo: ['moon', 't'],
    traits: ['Arkham'],
    shroud: 4,
    cluesPerInvestigator: 2,
    victory: 1,
  }),
  location({
    code: codes.downtownSanatorium,
    name: 'Downtown',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'triangle',
    connectsTo: ['moon', 't'],
    traits: ['Arkham'],
    shroud: 4,
    cluesPerInvestigator: 2,
    victory: 1,
  }),
  location({
    code: codes.uptownHospital,
    name: 'Uptown',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'plus',
    connectsTo: ['diamond', 'square'],
    traits: ['Arkham'],
    shroud: 2,
    cluesPerInvestigator: 2,
  }),
  location({
    code: codes.uptownMagickShoppe,
    name: 'Uptown',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'plus',
    connectsTo: ['diamond', 'square'],
    traits: ['Arkham'],
    shroud: 3,
    cluesPerInvestigator: 2,
  }),
  location({
    code: codes.northside,
    name: 'Northside',
    set: sets.arkham,
    pictures: jpg,
    symbol: 't',
    connectsTo: ['diamond', 'triangle'],
    traits: ['Arkham'],
    shroud: 3,
    cluesPerInvestigator: 2,
  }),
  location({
    code: codes.easttown,
    name: 'Easttown',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'moon',
    connectsTo: ['circle', 'triangle', 'spade'],
    traits: ['Arkham'],
    shroud: 2,
    cluesPerInvestigator: 1,
  }),
  location({
    code: codes.merchantDistrict,
    name: 'Merchant District',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'circle',
    connectsTo: ['moon', 'diamond', 'square', 'spade'],
    traits: ['Arkham', 'Central'],
    shroud: 3,
    cluesPerInvestigator: 1,
  }),
  location({
    code: codes.waterfrontDistrict,
    name: 'Waterfront District',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'spade',
    connectsTo: ['circle', 'moon'],
    traits: ['Arkham'],
    shroud: 1,
    cluesPerInvestigator: 1,
    victory: 1,
  }),
  location({
    code: codes.southside,
    name: 'Southside',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'square',
    connectsTo: ['plus', 'hourglass', 'circle'],
    traits: ['Arkham'],
    shroud: 2,
    cluesPerInvestigator: 2,
  }),
  location({
    code: codes.frenchHill,
    name: 'French Hill',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'hourglass',
    connectsTo: ['square'],
    traits: ['Arkham'],
    shroud: 4,
    cluesPerInvestigator: 2,
    victory: 1,
  }),
  location({
    code: codes.miskatonicUniversityInFlames,
    name: 'Miskatonic University',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'diamond',
    connectsTo: ['t', 'plus', 'circle'],
    traits: ['Arkham'],
    shroud: 4,
    cluesPerInvestigator: 1,
    victory: 1,
    // Direct damage, which the engine puts on the investigators; the players deal it to allies.
    abilities: [
      atEndOfPhase('investigation', takeDamage(1, eachInvestigator({ at: { ref: 'self' } }))),
    ],
  }),
  location({
    code: codes.miskatonicUniversityQuietCampus,
    name: 'Miskatonic University',
    set: sets.arkham,
    pictures: jpg,
    symbol: 'diamond',
    connectsTo: ['t', 'plus', 'circle'],
    traits: ['Arkham'],
    shroud: 2,
    cluesPerInvestigator: 1,
    victory: 1,
  }),
  treachery({
    code: '12157',
    name: 'Arcane Lock',
    set: sets.arcaneLock,
    pictures: jpg,
    traits: ['Hex', 'Obstacle'],
    quantity: 2,
    locationAttachment: { onePerLocation: true },
    abilities: [whenRevealed(attachToLocation())],
    actions: [
      {
        effects: [
          skillTestOfEither(ARCANE_LOCK_DECISION, ['willpower', 'intellect'], 4, {
            onPass: [discardSelf()],
          }),
        ],
      },
    ],
  }),
  treachery({
    code: '12158',
    name: 'Downpour',
    set: sets.badWeather,
    pictures: jpg,
    traits: ['Hazard'],
    quantity: 2,
  }),
  treachery({
    code: '12159',
    name: 'Flash Flood',
    set: sets.badWeather,
    pictures: jpg,
    traits: ['Hazard'],
    quantity: 2,
    modifiers: [{ value: 'shroud', of: 'host', by: 4 }],
    abilities: [whenRevealed(attachToLocation()), atEndOfRound(discardSelf())],
  }),
  treachery({
    code: '12160',
    name: 'Raising Suspicions',
    set: sets.deadEnds,
    pictures: jpg,
    traits: ['Blunder'],
    quantity: 2,
  }),
  treachery({
    code: '12161',
    name: 'Red Herring',
    set: sets.deadEnds,
    pictures: jpg,
    traits: ['Scheme'],
    quantity: 2,
  }),
  enemy({
    code: '12162',
    name: 'Bat Horror',
    set: sets.flyingTerrors,
    pictures: jpg,
    traits: ['Monster'],
    fight: 3,
    evade: 4,
    health: fixed(4),
    damage: 1,
    horror: 1,
    quantity: 2,
    keywords: [{ name: 'hunter' }],
  }),
  treachery({
    code: '12163',
    name: 'Aerial Pursuit',
    set: sets.flyingTerrors,
    pictures: jpg,
    traits: ['Scheme'],
    quantity: 2,
    keywords: [{ name: 'surge' }],
  }),
  enemy({
    code: '12164',
    name: 'Rogue Gangster',
    set: sets.gangsOfArkham,
    pictures: jpg,
    traits: ['Humanoid', 'Syndicate'],
    fight: 3,
    evade: 3,
    health: fixed(3),
    damage: 1,
    horror: 0,
    quantity: 2,
    keywords: [{ name: 'hunter' }, prey('Most resources'), { name: 'retaliate' }],
  }),
  treachery({
    code: '12165',
    name: 'Crossfire',
    set: sets.gangsOfArkham,
    pictures: jpg,
    traits: ['Hazard'],
    quantity: 2,
    abilities: [
      whenRevealed(
        skillTest('agility', 3, {
          onFail: [takeDamage(1, eachInvestigator({ at: itsLocation() }))],
        }),
      ),
    ],
  }),
  enemy({
    code: '12166',
    name: 'Whippoorwill',
    set: sets.whippoorwills,
    pictures: jpg,
    traits: ['Creature'],
    fight: 2,
    evade: 4,
    health: fixed(1),
    damage: 0,
    horror: 1,
    quantity: 3,
    keywords: [{ name: 'aloof' }, { name: 'hunter' }],
  }),
  treachery({
    code: '12167',
    name: 'Eager for Death',
    set: sets.whippoorwills,
    pictures: jpg,
    traits: ['Omen'],
    quantity: 2,
  }),
];

/** Card data for Smoke and Mirrors; put it in the `EngineContext` to play it. */
export const smokeAndMirrorsCards: CardDb = cardDbFrom(smokeAndMirrorsCardDefs);
