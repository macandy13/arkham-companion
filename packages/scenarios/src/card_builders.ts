import {
  cardCode,
  cardImagePath,
  fixed,
  perInvestigator,
  trait,
  type Ability,
  type CardModifier,
  type CardStats,
  type EncounterSetCode,
  type Keyword,
  type LocationAttachment,
  type ScaledValue,
  type Trait,
} from '@arkham/engine';

/**
 * Builders for hand-entered scenario card data: each takes the printed
 * values of one card type, so a scenario's card list reads like the cards
 * and only names what is printed on them. Shared by every hand-entered
 * scenario, so the shape of `CardStats` they produce stays the same.
 */

/** Printed values of an agenda: its stage and doom threshold. */
export interface AgendaOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  stage: number;
  doom: number;
  /** Its reverse side (`whenAdvanced`) and its actions. */
  abilities?: readonly Ability[];
}

/** Card stats for a hand-entered agenda of `set`, with both printed sides. */
export function agenda({ code, name, set, stage, doom, abilities }: AgendaOptions): CardStats {
  return {
    ...scenarioCard(code, name, set),
    typeCode: 'agenda',
    stage: { number: stage },
    doom: fixed(doom),
    ...(abilities ? { abilities } : {}),
  };
}

/** Printed values of an act; an act without a clue threshold omits `cluesPerInvestigator`. */
export interface ActOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  stage: number;
  cluesPerInvestigator?: number;
  /** Its reverse side (`whenAdvanced`) and its objective. */
  abilities?: readonly Ability[];
}

/** Card stats for a hand-entered act of `set`, with both printed sides. */
export function act({
  code,
  name,
  set,
  stage,
  cluesPerInvestigator,
  abilities,
}: ActOptions): CardStats {
  return {
    ...scenarioCard(code, name, set),
    typeCode: 'act',
    stage: { number: stage },
    ...(cluesPerInvestigator === undefined ? {} : { clues: perInvestigator(cluesPerInvestigator) }),
    ...(abilities ? { abilities } : {}),
  };
}

/** Printed values of a location whose clues scale per investigator. */
export interface LocationOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  shroud: number;
  cluesPerInvestigator: number;
  victory?: number;
  abilities?: Ability[];
}

/** Card stats for a hand-entered location of `set`, with both printed sides. */
export function location({
  code,
  name,
  set,
  shroud,
  cluesPerInvestigator,
  victory,
  abilities,
}: LocationOptions): CardStats {
  return {
    ...scenarioCard(code, name, set),
    typeCode: 'location',
    shroud,
    clues: perInvestigator(cluesPerInvestigator),
    ...(victory === undefined ? {} : { victory }),
    ...(abilities === undefined ? {} : { abilities }),
  };
}

/** Printed values of an enemy; `quantity` defaults to 1. */
export interface EnemyOptions {
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

/** Card stats for a hand-entered enemy, with its front picture (its back is the encounter back). */
export function enemy({
  code,
  set,
  traits,
  quantity = 1,
  victory,
  ...stats
}: EnemyOptions): CardStats {
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
export interface TreacheryOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  traits: readonly string[];
  quantity: number;
  /** Its revelation and forced abilities (Frozen in Fear's end-of-turn test). */
  abilities?: readonly Ability[];
  /** What it does attached to the drawer's location (Obscuring Fog). */
  locationAttachment?: LocationAttachment;
  /** Its constant abilities (Obscuring Fog's +2 shroud on its location). */
  modifiers?: readonly CardModifier[];
}

/** Card stats for a hand-entered treachery, with its front picture. */
export function treachery({
  code,
  name,
  set,
  traits,
  quantity,
  abilities,
  locationAttachment,
  modifiers,
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
    ...(modifiers ? { modifiers } : {}),
  };
}

/** A single-copy, trait-less card of a scenario's own encounter set, with both printed sides. */
export function scenarioCard(
  code: string,
  name: string,
  set: EncounterSetCode,
): Omit<CardStats, 'typeCode'> {
  return {
    code: cardCode(code),
    name,
    traits: [],
    encounterCode: set,
    quantity: 1,
    ...picturesOf(code, 'both'),
  };
}

/**
 * Where the pictures of card `code` are on ArkhamDB: its front, and its back when the card has
 * `both` printed sides of its own (agendas, acts, locations; an encounter card's back is the
 * shared encounter back). The app loads them on the player's device; they are never bundled.
 */
export function picturesOf(
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
export function prey(detail: string): Keyword {
  return { name: 'prey', detail };
}

/** The `spawn` keyword with the location it names. */
export function spawn(detail: string): Keyword {
  return { name: 'spawn', detail };
}
