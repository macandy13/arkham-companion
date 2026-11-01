import {
  advanceAct,
  afterAttacking,
  afterEntering,
  afterEvaded,
  atEndOfPhase,
  cardCode,
  cardDbWith,
  cardImagePath,
  disengageFromEachEnemy,
  drawCards,
  drawFromScenarioDeck,
  perInvestigator,
  engageReadyEnemies,
  decisionId,
  encounterSetCode,
  endScenario,
  fixed,
  gainClues,
  gainResources,
  gainSurge,
  attachTo,
  discardSelf,
  heal,
  healSelf,
  ifEnemiesInPlay,
  ifNoCandidate,
  ifYouHave,
  locationWith,
  locationWithMost,
  moveTo,
  nearestEnemy,
  onlyCopy,
  placeDoomOn,
  placeDoomOnSelf,
  resolutionId,
  searchAndDraw,
  searchDeck,
  shuffleEncounterDeck,
  skillTest,
  skillTestOfEither,
  spendClues,
  takeDamage,
  takeDamageAndHorror,
  takeHorror,
  trait,
  whenAdvanced,
  whenVictoryDisplayHolds,
  whenRevealed,
  youMustEither,
  type CardDb,
  type CardStats,
  resignAction,
  parleyAction,
  addToVictoryDisplay,
} from '@arkham/engine';
import { act, agenda, enemy, location, prey, spawn, treachery } from '../card_builders';
import { theGatheringCards } from '../the_gathering/cards';

/**
 * ArkhamDB encounter set codes of The Midnight Masks (Core Set, 2016): the
 * scenario's own set, the Cult of Umôrdhoth (the Cultist deck) and the new
 * generic sets its setup gathers. Chilling Cold is The Gathering's
 * (`GATHERING_SETS.chillingCold`).
 */
export const MIDNIGHT_MASKS_SETS = {
  theMidnightMasks: encounterSetCode('arkham'),
  cultOfUmordhoth: encounterSetCode('cultists'),
  darkCult: encounterSetCode('pentagram'),
  nightgaunts: encounterSetCode('nightgaunts'),
  lockedDoors: encounterSetCode('locked_doors'),
} as const;

/** ArkhamDB card codes of the cards the scenario definition refers to by name. */
export const MIDNIGHT_MASKS_CODES = {
  predatorOrPrey: cardCode('01121a'),
  timeIsRunningShort: cardCode('01122'),
  uncoveringTheConspiracy: cardCode('01123'),
  yourHouse: cardCode('01124'),
  rivertown: cardCode('01125'),
  southsideHistoricalSociety: cardCode('01126'),
  southsideMasBoardingHouse: cardCode('01127'),
  stMarysHospital: cardCode('01128'),
  miskatonicUniversity: cardCode('01129'),
  downtownFirstBank: cardCode('01130'),
  downtownArkhamAsylum: cardCode('01131'),
  easttown: cardCode('01132'),
  graveyard: cardCode('01133'),
  northside: cardCode('01134'),
  theMaskedHunter: cardCode('01121b'),
  wolfManDrew: cardCode('01137'),
  hermanCollins: cardCode('01138'),
  peterWarren: cardCode('01139'),
  victoriaDevereux: cardCode('01140'),
  ruthTurner: cardCode('01141'),
  acolyte: cardCode('01169'),
} as const;

/**
 * The Midnight Masks' resolutions as the campaign guide numbers them: R1 the
 * act advances (or no resolution is reached), R2 agenda 2 advances at
 * midnight.
 */
export const MIDNIGHT_MASKS_RESOLUTIONS = {
  conspiracyUncovered: resolutionId('R1'),
  pastMidnight: resolutionId('R2'),
} as const;

/** Id of Hunting Shadow's question to its drawer: spend 1 clue or take 2 damage. */
export const HUNTING_SHADOW_DECISION = decisionId('theMidnightMasks.huntingShadow');

/** Id of the question which skill tests Locked Door's action: combat or agility. */
export const LOCKED_DOOR_DECISION = decisionId('theMidnightMasks.lockedDoor');

/** Id of the Graveyard's question after a failed test: take 2 horror or move to Rivertown. */
export const GRAVEYARD_DECISION = decisionId('theMidnightMasks.graveyard');

const codes = MIDNIGHT_MASKS_CODES;
const sets = MIDNIGHT_MASKS_SETS;
const own = sets.theMidnightMasks;
const huntingShadow = 'scenario.theMidnightMasks.huntingShadow';
const graveyard = 'scenario.theMidnightMasks.graveyard';
const arkham = ['Arkham'];
const cultist = ['Humanoid', 'Cultist'];

/**
 * Hand-entered card data for The Midnight Masks, keyed by the real ArkhamDB
 * codes; like The Gathering's, only names, codes, numbers, traits, keywords
 * and abilities (test skills and difficulties checked against ArkhamDB's
 * core set data), no card text, JSON or images. Effects the engine has no
 * rule for yet are left out, so the players resolve them from the card:
 *
 * - agenda 1 turning into The Masked Hunter
 * - Your House's hold on the Ghoul Priest and Easttown's cost reduction
 * - Acolyte's doom as it enters play during the game (setup places it)
 * - Hunting Nightgaunt's constant ability
 * - the players' pick among several Cultist enemies for Mysterious Chanting's
 *   search: the engine draws the first match (#346)
 *
 * The Masked Hunter is entered as an enemy of the scenario's own set, so the
 * setup must leave it out of the encounter deck: it enters play only as
 * agenda 1's reverse side.
 */
export const theMidnightMasksCardDefs: readonly CardStats[] = [
  {
    ...agenda({
      code: '01121a',
      name: 'Predator or Prey?',
      set: own,
      stage: 1,
      doom: 6,
      actions: [resignAction()],
    }),
    // Agenda 1's reverse side is The Masked Hunter (01121b), not an agenda back of its own.
    backImageSrc: cardImagePath('/bundles/cards/01121b.png'),
  },
  agenda({
    code: '01122',
    name: 'Time Is Running Short',
    set: own,
    stage: 2,
    doom: 8,
    abilities: [whenAdvanced(endScenario(MIDNIGHT_MASKS_RESOLUTIONS.pastMidnight))],
    actions: [resignAction()],
  }),
  act({
    code: '01123',
    name: 'Uncovering the Conspiracy',
    set: own,
    stage: 1,
    abilities: [
      whenVictoryDisplayHolds({ trait: trait('Cultist'), unique: true }, 6, advanceAct()),
      whenAdvanced(endScenario(MIDNIGHT_MASKS_RESOLUTIONS.conspiracyUncovered)),
    ],
    actions: [
      {
        cost: { spend: 'groupClues', amount: perInvestigator(2) },
        effects: [drawFromScenarioDeck('cultist')],
      },
    ],
  }),
  location({
    code: '01124',
    name: 'Your House',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: arkham,
    actions: [{ effects: [drawCards(1), gainResources(1)], limit: { per: 'turn' } }],
  }),
  location({
    code: '01125',
    name: 'Rivertown',
    set: own,
    shroud: 1,
    cluesPerInvestigator: 1,
    traits: [...arkham, 'Central'],
  }),
  location({
    code: '01126',
    name: 'Southside',
    set: own,
    shroud: 3,
    cluesPerInvestigator: 1,
    traits: arkham,
    // Historical Society.
    actions: [{ effects: [drawCards(3)], limit: { per: 'game' } }],
  }),
  location({
    code: '01127',
    name: 'Southside',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: arkham,
    // Ma's Boarding House.
    actions: [{ effects: [searchDeck([trait('Ally')])], limit: { per: 'game' } }],
  }),
  location({
    code: '01128',
    name: "St. Mary's Hospital",
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: arkham,
    actions: [{ effects: [heal('damage', 3)], limit: { per: 'game' } }],
  }),
  location({
    code: '01129',
    name: 'Miskatonic University',
    set: own,
    shroud: 4,
    cluesPerInvestigator: 2,
    traits: arkham,
    victory: 1,
    actions: [{ effects: [searchDeck([trait('Tome'), trait('Spell')], { top: 6 })] }],
  }),
  location({
    code: '01130',
    name: 'Downtown',
    set: own,
    shroud: 3,
    cluesPerInvestigator: 1,
    traits: arkham,
    // First Bank of Arkham.
    actions: [{ effects: [gainResources(3)], limit: { per: 'game' } }],
  }),
  location({
    code: '01131',
    name: 'Downtown',
    set: own,
    shroud: 4,
    cluesPerInvestigator: 2,
    traits: arkham,
    victory: 1,
    // Arkham Asylum.
    actions: [{ effects: [heal('horror', 3)], limit: { per: 'game' } }],
  }),
  location({
    code: '01132',
    name: 'Easttown',
    set: own,
    shroud: 2,
    cluesPerInvestigator: 1,
    traits: arkham,
  }),
  location({
    code: '01133',
    name: 'Graveyard',
    set: own,
    shroud: 1,
    cluesPerInvestigator: 2,
    traits: arkham,
    victory: 1,
    abilities: [
      afterEntering(
        skillTest('willpower', 3, {
          onFail: [
            youMustEither(GRAVEYARD_DECISION, `${graveyard}.prompt`, [
              { id: 'horror', label: `${graveyard}.horror`, effects: [takeHorror(2)] },
              {
                id: 'rivertown',
                label: `${graveyard}.rivertown`,
                effects: [moveTo(onlyCopy(codes.rivertown))],
              },
            ]),
          ],
        }),
      ),
    ],
  }),
  location({
    code: '01134',
    name: 'Northside',
    set: own,
    shroud: 3,
    cluesPerInvestigator: 2,
    traits: arkham,
    victory: 1,
    actions: [
      {
        cost: { spend: 'resources', amount: 5 },
        effects: [gainClues(2)],
        limit: { per: 'game', group: true },
      },
    ],
  }),
  treachery({
    code: '01135',
    name: 'Hunting Shadow',
    set: own,
    traits: ['Curse'],
    quantity: 3,
    keywords: [{ name: 'peril' }],
    abilities: [
      whenRevealed(
        youMustEither(HUNTING_SHADOW_DECISION, `${huntingShadow}.prompt`, [
          { id: 'clue', label: `${huntingShadow}.clue`, effects: [spendClues(1)] },
          { id: 'damage', label: `${huntingShadow}.damage`, effects: [takeDamage(2)] },
        ]),
      ),
    ],
  }),
  treachery({
    code: '01136',
    name: 'False Lead',
    set: own,
    traits: [],
    quantity: 2,
    abilities: [
      ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge())),
      ifYouHave(
        'clues',
        { min: 1 },
        whenRevealed(skillTest('intellect', 4, { perPointFailed: 'clues' })),
      ),
    ],
  }),
  enemy({
    code: '01121b',
    name: 'The Masked Hunter',
    set: own,
    traits: [...cultist, 'Elite'],
    fight: 4,
    evade: 2,
    // "+2 health per investigator" on a printed 4.
    health: { fixed: 4, perInvestigator: 2 },
    damage: 2,
    horror: 1,
    victory: 2,
    unique: true,
    keywords: [spawn('Engaged with prey'), prey('Most clues'), { name: 'hunter' }],
    restrictions: [{ cannot: ['discover', 'spend'], what: 'clues', who: 'threatArea' }],
  }),
  enemy({
    code: '01137',
    name: '"Wolf-Man" Drew',
    set: sets.cultOfUmordhoth,
    traits: cultist,
    fight: 4,
    evade: 2,
    health: fixed(4),
    damage: 2,
    horror: 0,
    victory: 1,
    unique: true,
    keywords: [spawn('Downtown')],
    // The card heals "when" Drew attacks; after the attack is the nearest window, and the heal
    // lands the same unless a player card (Guard Dog) damages him during his attack.
    abilities: [afterAttacking(healSelf(1))],
  }),
  enemy({
    code: '01138',
    name: 'Herman Collins',
    set: sets.cultOfUmordhoth,
    traits: cultist,
    fight: 3,
    evade: 4,
    health: fixed(4),
    damage: 1,
    horror: 1,
    victory: 1,
    unique: true,
    keywords: [spawn('Graveyard')],
    actions: [
      parleyAction({
        cost: { spend: 'handCards', amount: 4 },
        effects: [addToVictoryDisplay({ ref: 'self' })],
      }),
    ],
  }),
  enemy({
    code: '01139',
    name: 'Peter Warren',
    set: sets.cultOfUmordhoth,
    traits: cultist,
    fight: 2,
    evade: 3,
    health: fixed(3),
    damage: 1,
    horror: 0,
    victory: 1,
    unique: true,
    keywords: [spawn('Miskatonic University')],
    actions: [
      parleyAction({
        cost: { spend: 'clues', amount: 2 },
        effects: [addToVictoryDisplay({ ref: 'self' })],
      }),
    ],
  }),
  enemy({
    code: '01140',
    name: 'Victoria Devereux',
    set: sets.cultOfUmordhoth,
    traits: cultist,
    fight: 3,
    evade: 2,
    health: fixed(3),
    damage: 1,
    horror: 0,
    victory: 1,
    unique: true,
    keywords: [spawn('Northside')],
    actions: [
      parleyAction({
        cost: { spend: 'resources', amount: 5 },
        effects: [addToVictoryDisplay({ ref: 'self' })],
      }),
    ],
  }),
  enemy({
    code: '01141',
    name: 'Ruth Turner',
    set: sets.cultOfUmordhoth,
    traits: cultist,
    fight: 2,
    evade: 5,
    health: fixed(4),
    damage: 1,
    horror: 0,
    victory: 1,
    unique: true,
    keywords: [spawn("St. Mary's Hospital")],
    abilities: [afterEvaded(addToVictoryDisplay({ ref: 'self' }))],
  }),
  enemy({
    code: '01169',
    name: 'Acolyte',
    set: sets.darkCult,
    traits: cultist,
    fight: 3,
    evade: 2,
    health: fixed(1),
    damage: 1,
    horror: 0,
    quantity: 3,
    keywords: [spawn('Any empty location')],
  }),
  enemy({
    code: '01170',
    name: 'Wizard of the Order',
    set: sets.darkCult,
    traits: cultist,
    fight: 4,
    evade: 2,
    health: fixed(2),
    damage: 1,
    horror: 0,
    keywords: [spawn('Any empty location'), { name: 'retaliate' }],
    abilities: [atEndOfPhase('mythos', placeDoomOnSelf(1))],
  }),
  treachery({
    code: '01171',
    name: 'Mysterious Chanting',
    set: sets.darkCult,
    traits: ['Hex'],
    quantity: 2,
    abilities: [
      whenRevealed(placeDoomOn(nearestEnemy(trait('Cultist')), 2)),
      ifEnemiesInPlay(
        trait('Cultist'),
        { max: 0 },
        whenRevealed(searchAndDraw({ trait: trait('Cultist'), typeCode: 'enemy' })),
      ),
      whenRevealed(shuffleEncounterDeck()),
    ],
  }),
  enemy({
    code: '01172',
    name: 'Hunting Nightgaunt',
    set: sets.nightgaunts,
    traits: ['Monster', 'Nightgaunt'],
    fight: 3,
    evade: 1,
    health: fixed(4),
    damage: 1,
    horror: 1,
    quantity: 2,
    keywords: [{ name: 'hunter' }],
  }),
  treachery({
    code: '01173',
    name: 'On Wings of Darkness',
    set: sets.nightgaunts,
    traits: [],
    quantity: 2,
    abilities: [
      whenRevealed(
        skillTest('agility', 4, { onFail: [takeDamageAndHorror({ damage: 1, horror: 1 })] }),
        disengageFromEachEnemy({ withoutTrait: trait('Nightgaunt') }),
        moveTo(locationWith(trait('Central'))),
        engageReadyEnemies(),
      ),
    ],
  }),
  treachery({
    code: '01174',
    name: 'Locked Door',
    set: sets.lockedDoors,
    traits: ['Obstacle'],
    quantity: 2,
    // "without a copy of Locked Door attached" is the limit of one per location.
    locationAttachment: { onePerLocation: true },
    abilities: [
      whenRevealed(attachTo(locationWithMost('clue'))),
      ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge())),
    ],
    actions: [
      {
        effects: [
          skillTestOfEither(LOCKED_DOOR_DECISION, ['combat', 'agility'], 4, {
            onPass: [discardSelf()],
          }),
        ],
      },
    ],
    restrictions: [{ cannot: 'investigate', of: 'host' }],
  }),
];

/**
 * Card data for everything The Midnight Masks' setup uses: its own cards plus The Gathering's,
 * whose Chilling Cold set and Ghoul Priest it shuffles in, so a standalone game starts with it alone.
 */
export const theMidnightMasksCards: CardDb = cardDbWith(
  theGatheringCards,
  theMidnightMasksCardDefs,
);
