import {
  GRID_CELLS_PER_CARD,
  advanceAct,
  leadDrawsDiscardingUntil,
  shuffleEncounterDiscard,
  atEndOfRound,
  atEndOfTurn,
  attachToLocation,
  cardCode,
  cardImagePath,
  cardDbFrom,
  decisionId,
  defeatEachInvestigator,
  discardEachEnemyAt,
  discardSelf,
  duringAct,
  encounterSetCode,
  endScenario,
  leadDecides,
  mapId,
  moveEachInvestigatorTo,
  onlyCopy,
  putIntoThreatArea,
  putMapIntoPlay,
  putSetAsideIntoPlay,
  removeFromGame,
  revealLocation,
  skillTest,
  spawnEnemyAt,
  trait,
  whenAdvanced,
  whenEnemyDefeated,
  whenRevealed,
  type Ability,
  type AddMapStep,
  type CardDb,
  type CardStats,
  type LocationAttachment,
  type EncounterSetCode,
  type Keyword,
  type ScaledValue,
  type Trait,
} from '@arkham/engine';

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
  litaChantler: cardCode('01117'),
} as const;

/**
 * The Gathering's resolutions, as the campaign guide numbers them: R1 the
 * house is burned down, R2 it is left standing (both from act 3), R3 the
 * investigators are trapped in the house (agenda 3 before act 3).
 */
export const GATHERING_RESOLUTIONS = {
  burnedDown: 'R1',
  leftStanding: 'R2',
  trapped: 'R3',
} as const;

/** Id of act 3's question to the lead investigator: burn the house down or not. */
export const BURN_THE_HOUSE_DECISION = decisionId('theGathering.burnTheHouse');

const codes = GATHERING_CODES;
const sets = GATHERING_SETS;
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
  agenda({ code: codes.whatsGoingOn, name: "What's Going On?!", stage: 1, doom: 3 }),
  agenda({
    code: codes.riseOfTheGhouls,
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
    name: "They're Getting Out!",
    stage: 3,
    doom: 10,
    // Before act 3 the investigators are trapped; at act 3 nobody is left, so the scenario ends
    // without a resolution. The physical trauma the card adds is the campaign's to record (M1C).
    abilities: [
      duringAct(
        [codes.trapped, codes.theBarrier],
        whenAdvanced(endScenario(GATHERING_RESOLUTIONS.trapped)),
      ),
      duringAct([codes.whatHaveYouDone], whenAdvanced(defeatEachInvestigator())),
    ],
  }),
  act({
    code: codes.trapped,
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
  location({ code: codes.study, name: 'Study', shroud: 2, cluesPerInvestigator: 2 }),
  location({ code: codes.hallway, name: 'Hallway', shroud: 1, cluesPerInvestigator: 0 }),
  location({ code: codes.attic, name: 'Attic', shroud: 1, cluesPerInvestigator: 2, victory: 1 }),
  location({ code: codes.cellar, name: 'Cellar', shroud: 4, cluesPerInvestigator: 2, victory: 1 }),
  location({ code: codes.parlor, name: 'Parlor', shroud: 2, cluesPerInvestigator: 0 }),
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
    locationAttachment: { onePerLocation: true, shroud: 2, discardWhenInvestigated: true },
    abilities: [whenRevealed(attachToLocation())],
  }),
];

/** Card data for The Gathering; put it in the `EngineContext` to play it. */
export const theGatheringCards: CardDb = cardDbFrom(theGatheringCardDefs);

/** Printed values of an agenda: its stage and doom threshold. */
interface AgendaOptions {
  code: string;
  name: string;
  stage: number;
  doom: number;
  /** Its reverse side (`whenAdvanced`). */
  abilities?: readonly Ability[];
}

function agenda({ code, name, stage, doom, abilities }: AgendaOptions): CardStats {
  return {
    ...scenarioCard(code, name),
    typeCode: 'agenda',
    stage: { number: stage },
    doom: fixed(doom),
    ...(abilities ? { abilities } : {}),
  };
}

/** Printed values of an act; an act without a clue threshold omits `cluesPerInvestigator`. */
interface ActOptions {
  code: string;
  name: string;
  stage: number;
  cluesPerInvestigator?: number;
  /** Its reverse side (`whenAdvanced`). */
  abilities?: readonly Ability[];
}

function act({ code, name, stage, cluesPerInvestigator, abilities }: ActOptions): CardStats {
  return {
    ...scenarioCard(code, name),
    typeCode: 'act',
    stage: { number: stage },
    ...(cluesPerInvestigator === undefined ? {} : { clues: perInvestigator(cluesPerInvestigator) }),
    ...(abilities ? { abilities } : {}),
  };
}

/** Printed values of a location (all of The Gathering's scale their clues per investigator). */
interface LocationOptions {
  code: string;
  name: string;
  shroud: number;
  cluesPerInvestigator: number;
  victory?: number;
}

function location({
  code,
  name,
  shroud,
  cluesPerInvestigator,
  victory,
}: LocationOptions): CardStats {
  return {
    ...scenarioCard(code, name),
    typeCode: 'location',
    shroud,
    clues: perInvestigator(cluesPerInvestigator),
    ...(victory === undefined ? {} : { victory }),
  };
}

/** Printed values of an enemy; `quantity` defaults to 1. */
interface EnemyOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  traits: readonly string[];
  fight: number;
  evade: number;
  health: ScaledValue;
  damage: number;
  horror: number;
  victory?: number;
  quantity?: number;
  keywords?: readonly Keyword[];
}

function enemy({ code, set, traits, quantity = 1, victory, ...stats }: EnemyOptions): CardStats {
  return {
    ...stats,
    code: cardCode(code),
    typeCode: 'enemy',
    ...picturesOf(code, 'front'),
    traits: traitsOf(traits),
    encounterCode: set,
    quantity,
    ...(victory === undefined ? {} : { victory }),
  };
}

/** Identity of a treachery and its number of copies. */
interface TreacheryOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  traits: readonly string[];
  quantity: number;
  /** Its forced abilities (Frozen in Fear's end-of-turn test, Dissonant Voices' discard). */
  abilities?: readonly Ability[];
  /** What it does attached to the drawer's location (Obscuring Fog). */
  locationAttachment?: LocationAttachment;
}

function treachery({
  code,
  name,
  set,
  traits,
  quantity,
  abilities,
  locationAttachment,
}: TreacheryOptions): CardStats {
  return {
    code: cardCode(code),
    name,
    typeCode: 'treachery',
    ...picturesOf(code, 'front'),
    traits: traitsOf(traits),
    encounterCode: set,
    quantity,
    ...(abilities ? { abilities } : {}),
    ...(locationAttachment ? { locationAttachment } : {}),
  };
}

/** A single-copy, trait-less card of The Gathering's own encounter set. */
function scenarioCard(code: string, name: string): Omit<CardStats, 'typeCode'> {
  return {
    code: cardCode(code),
    name,
    traits: [],
    encounterCode: sets.theGathering,
    quantity: 1,
    ...picturesOf(code, 'both'),
  };
}

/**
 * Where the pictures of card `code` are on ArkhamDB: its front, and its back when the card has
 * `both` printed sides of its own (agendas, acts, locations; an encounter card's back is the
 * shared encounter back). The app loads them on the player's device; they are never bundled.
 */
function picturesOf(
  code: string,
  sides: 'front' | 'both',
): Pick<CardStats, 'imageSrc' | 'backImageSrc'> {
  return {
    imageSrc: cardImagePath(`/bundles/cards/${code}.png`),
    ...(sides === 'both' ? { backImageSrc: cardImagePath(`/bundles/cards/${code}b.png`) } : {}),
  };
}

function traitsOf(names: readonly string[]): Trait[] {
  return names.map(trait);
}

/** The `prey` keyword with its printed instruction. */
function prey(detail: string): Keyword {
  return { name: 'prey', detail };
}

/** The `spawn` keyword with the location it names. */
function spawn(detail: string): Keyword {
  return { name: 'spawn', detail };
}

/** A printed value that does not scale with the player count. */
function fixed(value: number): ScaledValue {
  return { fixed: value, perInvestigator: 0 };
}

/** A printed "n per investigator" value. */
function perInvestigator(value: number): ScaledValue {
  return { fixed: 0, perInvestigator: value };
}
