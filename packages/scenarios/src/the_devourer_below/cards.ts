import {
  afterEngaging,
  afterEntering,
  atEndOfEachTurn,
  atEndOfRound,
  cardCode,
  cardDbFrom,
  decisionId,
  eachInvestigatorAt,
  encounterSetCode,
  endScenario,
  fixed,
  healSelf,
  itsLocation,
  placeDoomOnAgenda,
  putIntoThreatArea,
  readySelf,
  resolutionId,
  skillTest,
  takeDamageAndHorror,
  takeHorror,
  whenAdvanced,
  whenDefeated,
  whenRevealed,
  youMustEither,
  type CardDb,
  type CardStats,
} from '@arkham/engine';
import { act, agenda, enemy, location, prey, treachery } from '../card_builders';

/**
 * ArkhamDB encounter set codes of The Devourer Below (Core Set, 2016): the
 * scenario's own set and the four Agents sets, of which setup picks one at
 * random. Ghouls, Striking Fear and Ancient Evils are The Gathering's
 * (`GATHERING_SETS`), Dark Cult is The Midnight Masks' (`MIDNIGHT_MASKS_SETS`).
 */
export const DEVOURER_BELOW_SETS = {
  theDevourerBelow: encounterSetCode('tentacles'),
  agentsOfYogSothoth: encounterSetCode('agents_of_yog'),
  agentsOfShubNiggurath: encounterSetCode('agents_of_shub'),
  agentsOfCthulhu: encounterSetCode('agents_of_cthulhu'),
  agentsOfHastur: encounterSetCode('agents_of_hastur'),
} as const;

/** ArkhamDB card codes of the cards the scenario definition refers to by name. */
export const DEVOURER_BELOW_CODES = {
  theArkhamWoods: cardCode('01143'),
  theRitualBegins: cardCode('01144'),
  vengeanceAwaits: cardCode('01145'),
  investigatingTheTrail: cardCode('01146'),
  intoTheDarkness: cardCode('01147'),
  disruptingTheRitual: cardCode('01148'),
  mainPath: cardCode('01149'),
  arkhamWoodsUnhallowedGround: cardCode('01150'),
  arkhamWoodsTwistingPaths: cardCode('01151'),
  arkhamWoodsOldHouse: cardCode('01152'),
  arkhamWoodsCliffside: cardCode('01153'),
  arkhamWoodsTangledThicket: cardCode('01154'),
  arkhamWoodsQuietGlade: cardCode('01155'),
  ritualSite: cardCode('01156'),
  umordhoth: cardCode('01157'),
} as const;

/**
 * The Devourer Below's resolutions as the campaign guide numbers them: R1 the
 * ritual is disrupted (act 3 advances), R2 Umôrdhoth is defeated, R3 Lita is
 * sacrificed to it.
 */
export const DEVOURER_BELOW_RESOLUTIONS = {
  ritualBroken: resolutionId('R1'),
  umordhothRepelled: resolutionId('R2'),
  litaSacrificed: resolutionId('R3'),
} as const;

/** Id of Offer of Power's question to its drawer: draw 2 cards and place 2 doom, or take 2 horror. */
export const OFFER_OF_POWER_DECISION = decisionId('theDevourerBelow.offerOfPower');

const sets = DEVOURER_BELOW_SETS;
const own = sets.theDevourerBelow;
const offerOfPower = 'scenario.theDevourerBelow.offerOfPower';
const woods = ['Woods'];

/**
 * Hand-entered card data for The Devourer Below, keyed by the real ArkhamDB
 * codes; like The Midnight Masks', only names, codes, numbers, traits,
 * keywords and abilities (test skills and difficulties checked against
 * ArkhamDB's core set data), no card text, JSON or images. The six Arkham
 * Woods share their name, so their keys in `DEVOURER_BELOW_CODES` add the
 * subtitle printed on each one (Unhallowed Ground, Twisting Paths, …).
 * Effects the engine has no rule for yet are left out, so the players resolve
 * them from the card:
 *
 * - the agendas' reverse sides (agenda 1's Monster spawn, agenda 2's
 *   willpower (6) tests and madness, agenda 3's Umôrdhoth and The Devourer
 *   Below, which becomes act and agenda at once) and agenda 2's +1 fight and
 *   evade for each enemy
 * - acts 1 and 2's reverse sides (the Ritual Site, the cultists who got away,
 *   the enemies at the Ritual Site), act 2's objective, act 3's action and
 *   objective (its R1 is automated once the players advance it)
 * - the Main Path's resign action and its connection to each Woods location,
 *   the Arkham Woods' moving-out test, skill swaps and heal action, and the
 *   Ritual Site's clues at the end of the round
 * - Umôrdhoth's Lita action (R3) and Umôrdhoth's Wrath
 * - the Agents' constant and attack abilities (Screeching Byakhee, Yithian
 *   Observer), the madness weaknesses, Offer of Power's 2 cards, and Dreams of
 *   R'lyeh's -1 willpower and -1 sanity and its action
 */
export const theDevourerBelowCardDefs: readonly CardStats[] = [
  agenda({ code: '01143', name: 'The Arkham Woods', set: own, stage: 1, doom: 4 }),
  agenda({ code: '01144', name: 'The Ritual Begins', set: own, stage: 2, doom: 5 }),
  agenda({ code: '01145', name: 'Vengeance Awaits', set: own, stage: 3, doom: 5 }),
  act({
    code: '01146',
    name: 'Investigating the Trail',
    set: own,
    stage: 1,
    cluesPerInvestigator: 3,
  }),
  act({ code: '01147', name: 'Into the Darkness', set: own, stage: 2 }),
  act({
    code: '01148',
    name: 'Disrupting the Ritual',
    set: own,
    stage: 3,
    abilities: [whenAdvanced(endScenario(DEVOURER_BELOW_RESOLUTIONS.ritualBroken))],
  }),
  location({
    code: '01149',
    name: 'Main Path',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 0,
    traits: woods,
  }),
  location({
    code: '01150',
    name: 'Arkham Woods',
    set: own,
    shroud: 4,
    cluesPerInvestigator: 1,
    traits: woods,
    abilities: [
      afterEntering(
        skillTest('willpower', 4, { onFail: [takeDamageAndHorror({ damage: 1, horror: 1 })] }),
      ),
    ],
  }),
  location({
    code: '01151',
    name: 'Arkham Woods',
    set: own,
    shroud: 3,
    cluesPerInvestigator: 1,
    traits: woods,
  }),
  location({
    code: '01152',
    name: 'Arkham Woods',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: woods,
  }),
  location({
    code: '01153',
    name: 'Arkham Woods',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: woods,
  }),
  location({
    code: '01154',
    name: 'Arkham Woods',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: woods,
  }),
  location({
    code: '01155',
    name: 'Arkham Woods',
    set: own,
    shroud: 1,
    cluesPerInvestigator: 0,
    traits: woods,
  }),
  location({
    code: '01156',
    name: 'Ritual Site',
    set: own,
    shroud: 3,
    cluesPerInvestigator: 2,
    traits: ['Cave'],
  }),
  enemy({
    code: '01157',
    name: 'Umôrdhoth',
    set: own,
    traits: ['Ancient One', 'Elite'],
    fight: 5,
    evade: 6,
    // "+4 health per investigator" on a printed 6.
    health: { fixed: 6, perInvestigator: 4 },
    damage: 3,
    horror: 3,
    keywords: [{ name: 'hunter' }, { name: 'massive' }],
    abilities: [atEndOfEachTurn(readySelf())],
  }),
  treachery({
    code: '01158',
    name: "Umôrdhoth's Wrath",
    set: own,
    traits: ['Curse'],
    quantity: 2,
  }),
  enemy({
    code: '01175',
    name: 'Screeching Byakhee',
    set: sets.agentsOfHastur,
    traits: ['Monster', 'Byakhee'],
    fight: 3,
    evade: 3,
    health: fixed(4),
    damage: 1,
    horror: 2,
    victory: 1,
    quantity: 2,
    keywords: [prey('Lowest remaining sanity'), { name: 'hunter' }],
  }),
  treachery({
    code: '01176',
    name: 'The Yellow Sign',
    set: sets.agentsOfHastur,
    traits: ['Omen'],
    quantity: 2,
    abilities: [whenRevealed(skillTest('willpower', 4, { onFail: [takeHorror(2)] }))],
  }),
  enemy({
    code: '01177',
    name: 'Yithian Observer',
    set: sets.agentsOfYogSothoth,
    traits: ['Monster', 'Yithian'],
    fight: 4,
    evade: 3,
    health: fixed(4),
    damage: 1,
    horror: 1,
    victory: 1,
    quantity: 2,
    keywords: [prey('Fewest cards in hand')],
  }),
  treachery({
    code: '01178',
    name: 'Offer of Power',
    set: sets.agentsOfYogSothoth,
    traits: ['Pact'],
    quantity: 2,
    keywords: [{ name: 'peril' }],
    abilities: [
      whenRevealed(
        youMustEither(OFFER_OF_POWER_DECISION, `${offerOfPower}.prompt`, [
          // Drawing the 2 player cards is the players' part; the doom can advance the agenda.
          { id: 'doom', label: `${offerOfPower}.doom`, effects: [placeDoomOnAgenda(2)] },
          { id: 'horror', label: `${offerOfPower}.horror`, effects: [takeHorror(2)] },
        ]),
      ),
    ],
  }),
  enemy({
    code: '01179',
    name: 'Relentless Dark Young',
    set: sets.agentsOfShubNiggurath,
    traits: ['Monster', 'Dark Young'],
    fight: 4,
    evade: 2,
    health: fixed(5),
    damage: 2,
    horror: 1,
    victory: 1,
    keywords: [prey('Lowest [agility]')],
    abilities: [atEndOfRound(healSelf(2))],
  }),
  enemy({
    code: '01180',
    name: 'Goat Spawn',
    set: sets.agentsOfShubNiggurath,
    traits: ['Humanoid', 'Monster'],
    fight: 3,
    evade: 2,
    health: fixed(3),
    damage: 1,
    horror: 0,
    quantity: 3,
    keywords: [{ name: 'hunter' }, { name: 'retaliate' }],
    abilities: [whenDefeated(takeHorror(1, eachInvestigatorAt(itsLocation())))],
  }),
  enemy({
    code: '01181',
    name: 'Young Deep One',
    set: sets.agentsOfCthulhu,
    traits: ['Humanoid', 'Monster', 'Deep One'],
    fight: 3,
    evade: 3,
    health: fixed(3),
    damage: 1,
    horror: 1,
    quantity: 2,
    keywords: [prey('Lowest [combat]'), { name: 'hunter' }],
    abilities: [afterEngaging(takeHorror(1))],
  }),
  treachery({
    code: '01182',
    name: "Dreams of R'lyeh",
    set: sets.agentsOfCthulhu,
    traits: ['Omen'],
    quantity: 2,
    abilities: [whenRevealed(putIntoThreatArea())],
  }),
];

/**
 * Card data for The Devourer Below's own cards and the Agents sets; join it
 * with The Gathering's (Ghouls, Striking Fear, Ancient Evils, the Ghoul
 * Priest) and The Midnight Masks' (Dark Cult).
 */
export const theDevourerBelowCards: CardDb = cardDbFrom(theDevourerBelowCardDefs);
