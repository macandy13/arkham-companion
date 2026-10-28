import {
  GRID_CELLS_PER_CARD,
  advanceAct,
  afterEntering,
  afterTest,
  atEndOfPhase,
  leadDrawsDiscardingUntil,
  shuffleEncounterDiscard,
  atEndOfRound,
  atEndOfTurn,
  attachToLocation,
  cardCode,
  cardDbFrom,
  decisionId,
  defeatEachInvestigator,
  discardEachEnemyAt,
  discardSelf,
  eachEnemy,
  forEachEnemy,
  duringAct,
  encounterSetCode,
  fixed,
  endScenario,
  leadDecides,
  mapId,
  moveEachInvestigatorTo,
  moveEnemyTowards,
  onlyCopy,
  parleyAction,
  perInvestigator,
  placeDoomOnSelf,
  putIntoThreatArea,
  putMapIntoPlay,
  putSetAsideIntoPlay,
  removeFromGame,
  resolutionId,
  revealLocation,
  skillTest,
  spawnEnemyAt,
  takeControl,
  takeDamage,
  takeHorror,
  trait,
  whenAdvanced,
  whenEnemyDefeated,
  whenRevealed,
  type AddMapStep,
  type CardDb,
  type CardStats,
  resignAction,
} from '@arkham/engine';
import { act, agenda, enemy, location, picturesOf, prey, spawn, treachery } from '../card_builders';

/**
 * ArkhamDB encounter set codes of The Gathering (Core Set, 2016): the
 * scenario's own set plus the generic sets its setup gathers.
 */
export const GATHERING_SETS = {
  theGathering: encounterSetCode('torch'),
  rats: encounterSetCode('rats'),
  ghouls: encounterSetCode('ghouls'),
  strikingFear: encounterSetCode('striking_fear'),
  ancientEvils: encounterSetCode('ancient_evils'),
  chillingCold: encounterSetCode('chilling_cold'),
} as const;

/** ArkhamDB card codes of the cards the scenario definition refers to by name. */
export const GATHERING_CODES = {
  whatsGoingOn: cardCode('01105'),
  riseOfTheGhouls: cardCode('01106'),
  theyreGettingOut: cardCode('01107'),
  trapped: cardCode('01108'),
  theBarrier: cardCode('01109'),
  whatHaveYouDone: cardCode('01110'),
  study: cardCode('01111'),
  hallway: cardCode('01112'),
  attic: cardCode('01113'),
  cellar: cardCode('01114'),
  parlor: cardCode('01115'),
  ghoulPriest: cardCode('01116'),
  ghoulMinion: cardCode('01160'),
  litaChantler: cardCode('01117'),
} as const;

/**
 * The Gathering's resolutions, as the campaign guide numbers them: R1 the
 * house is burned down, R2 it is left standing (both from act 3), R3 the
 * investigators are trapped in the house (agenda 3 before act 3).
 */
export const GATHERING_RESOLUTIONS = {
  burnedDown: resolutionId('R1'),
  leftStanding: resolutionId('R2'),
  trapped: resolutionId('R3'),
} as const;

/** Id of agenda 1's question to the lead investigator: each investigator discards a random card, or the lead takes 2 horror. */
export const WHATS_GOING_ON_DECISION = decisionId('theGathering.whatsGoingOn');

/** Id of act 3's question to the lead investigator: burn the house down or not. */
export const BURN_THE_HOUSE_DECISION = decisionId('theGathering.burnTheHouse');

const codes = GATHERING_CODES;
const sets = GATHERING_SETS;
const whatsGoingOn = 'scenario.theGathering.whatsGoingOn';
const burnTheHouse = 'scenario.theGathering.burnTheHouse';
const ghoulTraits = ['Humanoid', 'Monster', 'Ghoul'];

/** One card step on the layout grid, which is finer than a card. */
const oneCard = GRID_CELLS_PER_CARD;

/**
 * The house as act 1 ("Trapped") reveals it: the Hallway connects to the
 * Attic, the Cellar and the Parlor. The campaign guide gives no placement for
 * this scenario, so the cells are our own: a star around the Hallway, with the
 * Attic above it, the Cellar below it and the Parlor to its right, each one card
 * step away. Not part of `theGathering.setup`: these
 * locations start set aside, and act 1's reverse side puts them into play
 * (`putMapIntoPlay`).
 */
export const theGatheringHouse: AddMapStep = {
  kind: 'addMap',
  mapId: mapId('house'),
  name: 'House',
  locations: [
    { code: codes.hallway, at: { column: 0, row: oneCard } },
    { code: codes.attic, at: { column: 0, row: 0 } },
    { code: codes.cellar, at: { column: 0, row: 2 * oneCard } },
    { code: codes.parlor, at: { column: oneCard, row: oneCard } },
  ],
  connections: [
    { from: codes.hallway, to: codes.attic },
    { from: codes.hallway, to: codes.cellar },
    { from: codes.hallway, to: codes.parlor },
  ],
};

/**
 * Hand-entered card data for The Gathering, keyed by the real ArkhamDB codes
 * so it lines up with the cached card data later. Only names, codes, numbers,
 * traits, keywords and abilities (revelation test skills and difficulties
 * checked against ArkhamDB's `core_encounter.json`) and where each side's picture
 * is on ArkhamDB – no card text, no ArkhamDB JSON, no images – so it may be
 * committed (see CLAUDE.md). It is the test scenario for the generic rules
 * until real scenario data arrives (M4).
 */
export const theGatheringCardDefs: readonly CardStats[] = [
  agenda({
    code: codes.whatsGoingOn,
    set: sets.theGathering,
    name: "What's Going On?!",
    stage: 1,
    doom: 3,
    abilities: [
      // The random discard from each hand is done at the table: the app does not track hands.
      whenAdvanced(
        leadDecides(WHATS_GOING_ON_DECISION, `${whatsGoingOn}.prompt`, [
          { id: 'discard', label: `${whatsGoingOn}.discard`, effects: [] },
          {
            id: 'horror',
            label: `${whatsGoingOn}.horror`,
            effects: [takeHorror(2, { ref: 'lead' })],
          },
        ]),
      ),
    ],
  }),
  agenda({
    code: codes.riseOfTheGhouls,
    set: sets.theGathering,
    name: 'Rise of the Ghouls',
    stage: 2,
    doom: 7,
    abilities: [
      whenAdvanced(
        shuffleEncounterDiscard(),
        leadDrawsDiscardingUntil({ trait: trait('Ghoul'), typeCode: 'enemy' }),
      ),
    ],
  }),
  agenda({
    code: codes.theyreGettingOut,
    set: sets.theGathering,
    name: "They're Getting Out!",
    stage: 3,
    doom: 10,
    // Before act 3 the investigators are trapped; at act 3 nobody is left, so the scenario ends
    // without a resolution, and the resolution proposal carries the card's physical trauma.
    abilities: [
      atEndOfPhase(
        'enemy',
        moveEnemyTowards(
          eachEnemy({ trait: trait('Ghoul'), unengaged: true }),
          onlyCopy(codes.parlor),
        ),
      ),
      forEachEnemy(
        { trait: trait('Ghoul'), at: [codes.hallway, codes.parlor] },
        atEndOfRound(placeDoomOnSelf(1)),
      ),
      duringAct(
        [codes.trapped, codes.theBarrier],
        whenAdvanced(endScenario(GATHERING_RESOLUTIONS.trapped)),
      ),
      duringAct(
        [codes.whatHaveYouDone],
        whenAdvanced(defeatEachInvestigator({ trauma: 'physical' })),
      ),
    ],
  }),
  act({
    code: codes.trapped,
    set: sets.theGathering,
    name: 'Trapped',
    stage: 1,
    cluesPerInvestigator: 2,
    // The map comes first, so the Hallway is in play when the investigators move there.
    abilities: [
      whenAdvanced(
        ...putMapIntoPlay(theGatheringHouse),
        discardEachEnemyAt(onlyCopy(codes.study)),
        moveEachInvestigatorTo(onlyCopy(codes.hallway)),
        removeFromGame(onlyCopy(codes.study)),
      ),
    ],
  }),
  act({
    code: codes.theBarrier,
    set: sets.theGathering,
    name: 'The Barrier',
    stage: 2,
    cluesPerInvestigator: 3,
    // The Parlor has been in play, unrevealed, since act 1 put the house into play.
    abilities: [
      whenAdvanced(
        revealLocation(onlyCopy(codes.parlor)),
        putSetAsideIntoPlay(codes.litaChantler, onlyCopy(codes.parlor)),
        spawnEnemyAt(onlyCopy(codes.ghoulPriest), onlyCopy(codes.hallway)),
      ),
    ],
  }),
  act({
    code: codes.whatHaveYouDone,
    set: sets.theGathering,
    name: 'What Have You Done?',
    stage: 3,
    // Objective: the act advances by itself once the Ghoul Priest is defeated.
    abilities: [
      whenEnemyDefeated(codes.ghoulPriest, advanceAct()),
      whenAdvanced(
        leadDecides(BURN_THE_HOUSE_DECISION, `${burnTheHouse}.prompt`, [
          {
            id: 'burn',
            label: `${burnTheHouse}.burn`,
            effects: [endScenario(GATHERING_RESOLUTIONS.burnedDown)],
          },
          {
            id: 'spare',
            label: `${burnTheHouse}.spare`,
            effects: [endScenario(GATHERING_RESOLUTIONS.leftStanding)],
          },
        ]),
      ),
    ],
  }),
  location({
    code: codes.study,
    set: sets.theGathering,
    name: 'Study',
    shroud: 2,
    cluesPerInvestigator: 2,
  }),
  location({
    code: codes.hallway,
    set: sets.theGathering,
    name: 'Hallway',
    shroud: 1,
    cluesPerInvestigator: 0,
  }),
  location({
    code: codes.attic,
    set: sets.theGathering,
    name: 'Attic',
    shroud: 1,
    cluesPerInvestigator: 2,
    victory: 1,
    abilities: [afterEntering(takeHorror(1))],
  }),
  location({
    code: codes.cellar,
    set: sets.theGathering,
    name: 'Cellar',
    shroud: 4,
    cluesPerInvestigator: 2,
    victory: 1,
    abilities: [afterEntering(takeDamage(1))],
  }),
  location({
    code: codes.parlor,
    set: sets.theGathering,
    name: 'Parlor',
    shroud: 2,
    cluesPerInvestigator: 0,
    actions: [resignAction()],
    // The barrier on its unrevealed side: act 2 reveals it.
    restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }],
  }),
  enemy({
    code: codes.ghoulPriest,
    name: 'Ghoul Priest',
    set: sets.theGathering,
    traits: [...ghoulTraits, 'Elite'],
    fight: 4,
    evade: 4,
    health: perInvestigator(5),
    damage: 2,
    horror: 2,
    victory: 2,
    keywords: [{ name: 'hunter' }, prey('Highest [combat]'), { name: 'retaliate' }],
  }),
  {
    code: codes.litaChantler,
    name: 'Lita Chantler',
    typeCode: 'asset',
    traits: [trait('Ally')],
    encounterCode: sets.theGathering,
    quantity: 1,
    // The Parlor grants this "while Lita Chantler is not controlled by a player". She comes into
    // play only there (act 2), and a controlled card in a play area offers no actions, so the
    // action can sit on her own card.
    actions: [parleyAction({ effects: [skillTest('intellect', 4, { onPass: [takeControl()] })] })],
    ...picturesOf(codes.litaChantler, 'front'),
  },
  enemy({
    code: '01118',
    name: 'Flesh-Eater',
    set: sets.theGathering,
    traits: ghoulTraits,
    fight: 4,
    evade: 1,
    health: fixed(4),
    damage: 1,
    horror: 2,
    victory: 1,
    keywords: [spawn('Attic')],
  }),
  enemy({
    code: '01119',
    name: 'Icy Ghoul',
    set: sets.theGathering,
    traits: ghoulTraits,
    fight: 3,
    evade: 4,
    health: fixed(4),
    damage: 2,
    horror: 1,
    victory: 1,
    keywords: [spawn('Cellar')],
  }),
  enemy({
    code: '01159',
    name: 'Swarm of Rats',
    set: sets.rats,
    traits: ['Creature'],
    fight: 1,
    evade: 3,
    health: fixed(1),
    damage: 1,
    horror: 0,
    quantity: 3,
    keywords: [{ name: 'hunter' }],
  }),
  enemy({
    code: '01160',
    name: 'Ghoul Minion',
    set: sets.ghouls,
    traits: ghoulTraits,
    fight: 2,
    evade: 2,
    health: fixed(2),
    damage: 1,
    horror: 1,
    quantity: 3,
  }),
  enemy({
    code: '01161',
    name: 'Ravenous Ghoul',
    set: sets.ghouls,
    traits: ghoulTraits,
    fight: 3,
    evade: 3,
    health: fixed(3),
    damage: 1,
    horror: 1,
    keywords: [prey('Lowest remaining health')],
  }),
  treachery({
    code: '01162',
    name: 'Grasping Hands',
    set: sets.ghouls,
    traits: ['Hazard'],
    quantity: 3,
    abilities: [whenRevealed(skillTest('agility', 3, { perPointFailed: 'damage' }))],
  }),
  treachery({
    code: '01163',
    name: 'Rotting Remains',
    set: sets.strikingFear,
    traits: ['Terror'],
    quantity: 3,
    abilities: [whenRevealed(skillTest('willpower', 3, { perPointFailed: 'horror' }))],
  }),
  treachery({
    code: '01164',
    name: 'Frozen in Fear',
    set: sets.strikingFear,
    traits: ['Terror'],
    quantity: 2,
    abilities: [
      whenRevealed(putIntoThreatArea()),
      atEndOfTurn(skillTest('willpower', 3, { onPass: [discardSelf()] })),
    ],
  }),
  treachery({
    code: '01165',
    name: 'Dissonant Voices',
    set: sets.strikingFear,
    traits: ['Terror'],
    quantity: 2,
    abilities: [whenRevealed(putIntoThreatArea()), atEndOfRound(discardSelf())],
    restrictions: [
      { cannot: 'playCards', who: 'threatArea', cards: { types: ['asset', 'event'] } },
    ],
  }),
  treachery({
    code: '01166',
    name: 'Ancient Evils',
    set: sets.ancientEvils,
    traits: ['Omen'],
    quantity: 3,
  }),
  treachery({
    code: '01167',
    name: 'Crypt Chill',
    set: sets.chillingCold,
    traits: ['Hazard'],
    quantity: 2,
    abilities: [whenRevealed(skillTest('willpower', 4))],
  }),
  treachery({
    code: '01168',
    name: 'Obscuring Fog',
    set: sets.chillingCold,
    traits: ['Hazard'],
    quantity: 2,
    locationAttachment: { onePerLocation: true },
    modifiers: [{ stat: 'shroud', of: 'host', by: 2 }],
    abilities: [whenRevealed(attachToLocation()), afterTest('investigate', 'pass', discardSelf())],
  }),
];

/** Card data for The Gathering; put it in the `EngineContext` to play it. */
export const theGatheringCards: CardDb = cardDbFrom(theGatheringCardDefs);
