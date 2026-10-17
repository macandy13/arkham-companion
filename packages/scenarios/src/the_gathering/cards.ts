import {
  cardCode,
  cardDbFrom,
  trait,
  type CardDb,
  type CardStats,
  type Keyword,
  type ScaledValue,
  type SkillTest,
  type Trait,
} from '@arkham/engine';

/**
 * ArkhamDB encounter set codes of The Gathering (Core Set, 2016): the
 * scenario's own set plus the generic sets its setup gathers.
 */
export const GATHERING_SETS = {
  theGathering: 'torch',
  rats: 'rats',
  ghouls: 'ghouls',
  strikingFear: 'striking_fear',
  ancientEvils: 'ancient_evils',
  chillingCold: 'chilling_cold',
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

const codes = GATHERING_CODES;
const sets = GATHERING_SETS;
const ghoulTraits = ['Humanoid', 'Monster', 'Ghoul'];

/**
 * Hand-entered card data for The Gathering, keyed by the real ArkhamDB codes
 * so it lines up with the cached card data later. Only names, codes, numbers,
 * traits, keywords, the threat-area flag and revelation tests (skill and
 * difficulty, checked against ArkhamDB's `core_encounter.json`) – no card text, no ArkhamDB JSON,
 * no images – so it may be committed (see CLAUDE.md). It is the test scenario for the generic rules
 * until real scenario data arrives (M4).
 */
export const theGatheringCardDefs: readonly CardStats[] = [
  agenda({ code: codes.whatsGoingOn, name: "What's Going On?!", stage: 1, doom: 3 }),
  agenda({ code: codes.riseOfTheGhouls, name: 'Rise of the Ghouls', stage: 2, doom: 7 }),
  agenda({ code: codes.theyreGettingOut, name: "They're Getting Out!", stage: 3, doom: 10 }),
  act({ code: codes.trapped, name: 'Trapped', stage: 1, cluesPerInvestigator: 2 }),
  act({ code: codes.theBarrier, name: 'The Barrier', stage: 2, cluesPerInvestigator: 3 }),
  act({ code: codes.whatHaveYouDone, name: 'What Have You Done?', stage: 3 }),
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
    revelationTest: { skill: 'agility', difficulty: 3 },
  }),
  treachery({
    code: '01163',
    name: 'Rotting Remains',
    set: sets.strikingFear,
    traits: ['Terror'],
    quantity: 3,
    revelationTest: { skill: 'willpower', difficulty: 3 },
  }),
  treachery({
    code: '01164',
    name: 'Frozen in Fear',
    set: sets.strikingFear,
    traits: ['Terror'],
    quantity: 2,
    entersThreatArea: true,
  }),
  treachery({
    code: '01165',
    name: 'Dissonant Voices',
    set: sets.strikingFear,
    traits: ['Terror'],
    quantity: 2,
    entersThreatArea: true,
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
    revelationTest: { skill: 'willpower', difficulty: 4 },
  }),
  treachery({
    code: '01168',
    name: 'Obscuring Fog',
    set: sets.chillingCold,
    traits: ['Hazard'],
    quantity: 2,
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
}

function agenda({ code, name, stage, doom }: AgendaOptions): CardStats {
  return {
    ...scenarioCard(code, name),
    typeCode: 'agenda',
    stage: { number: stage },
    doom: fixed(doom),
  };
}

/** Printed values of an act; an act without a clue threshold omits `cluesPerInvestigator`. */
interface ActOptions {
  code: string;
  name: string;
  stage: number;
  cluesPerInvestigator?: number;
}

function act({ code, name, stage, cluesPerInvestigator }: ActOptions): CardStats {
  return {
    ...scenarioCard(code, name),
    typeCode: 'act',
    stage: { number: stage },
    ...(cluesPerInvestigator === undefined ? {} : { clues: perInvestigator(cluesPerInvestigator) }),
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
  set: string;
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
  set: string;
  traits: readonly string[];
  quantity: number;
  /** Set for a treachery that stays in the drawer's threat area. */
  entersThreatArea?: boolean;
  /**
   * The skill test of the card's revelation, if it has one. Frozen in Fear's
   * willpower test is not one: it comes at the end of each turn, not when drawn.
   */
  revelationTest?: SkillTest;
}

function treachery({
  code,
  name,
  set,
  traits,
  quantity,
  entersThreatArea,
  revelationTest,
}: TreacheryOptions): CardStats {
  return {
    code: cardCode(code),
    name,
    typeCode: 'treachery',
    traits: traitsOf(traits),
    encounterCode: set,
    quantity,
    ...(entersThreatArea ? { entersThreatArea } : {}),
    ...(revelationTest ? { revelationTest } : {}),
  };
}

/** A single-copy, trait-less card of The Gathering's own encounter set. */
function scenarioCard(code: string, name: string): Omit<CardStats, 'typeCode'> {
  return { code: cardCode(code), name, traits: [], encounterCode: sets.theGathering, quantity: 1 };
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
