import {
  advanceBySpendingClues,
  cardCode,
  cardImagePath,
  fixed,
  perInvestigator,
  trait,
  type Ability,
  type CardAction,
  type CardModifier,
  type CardRestriction,
  type CardStats,
  type EncounterSetCode,
  type Keyword,
  type LocationAttachment,
  type LocationSymbol,
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
  /** Its reverse side (`whenAdvanced`). */
  abilities?: readonly Ability[];
  /** Its action abilities, such as `resignAction()`. */
  actions?: readonly CardAction[];
}

/** Card stats for a hand-entered agenda of `set`, with both printed sides. */
export function agenda({
  code,
  name,
  set,
  stage,
  doom,
  abilities,
  actions,
}: AgendaOptions): CardStats {
  return {
    ...scenarioCard(code, name, set),
    typeCode: 'agenda',
    stage: { number: stage },
    doom: fixed(doom),
    ...(abilities ? { abilities } : {}),
    ...(actions ? { actions } : {}),
  };
}

/**
 * Printed values of an act; an act without a clue threshold (one whose objective replaces it)
 * omits `cluesPerInvestigator`, else it gets `advanceBySpendingClues`.
 */
export interface ActOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  stage: number;
  cluesPerInvestigator?: number;
  /** Its reverse side (`whenAdvanced`) and its objective. */
  abilities?: readonly Ability[];
  /** Its action abilities, such as Uncovering the Conspiracy's draw from the Cultist deck. */
  actions?: readonly CardAction[];
}

/** Card stats for a hand-entered act of `set`, with both printed sides. */
export function act({
  code,
  name,
  set,
  stage,
  cluesPerInvestigator,
  abilities,
  actions,
}: ActOptions): CardStats {
  return {
    ...scenarioCard(code, name, set),
    typeCode: 'act',
    stage: { number: stage },
    ...(abilities ? { abilities } : {}),
    ...actActions(actions, cluesPerInvestigator),
  };
}

/**
 * The act's printed actions, then its spend-clues ability for a clue threshold, so the printed
 * ones keep their indices (`UseCardAction.action`).
 */
function actActions(
  printed: readonly CardAction[] | undefined,
  cluesPerInvestigator: number | undefined,
): Pick<CardStats, 'actions'> {
  const actions = [
    ...(printed ?? []),
    ...(cluesPerInvestigator === undefined
      ? []
      : [advanceBySpendingClues(perInvestigator(cluesPerInvestigator))]),
  ];
  return actions.length === 0 ? {} : { actions };
}

/** Printed values of a location whose clues scale per investigator. */
export interface LocationOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  shroud: number;
  cluesPerInvestigator: number;
  /** Printed traits such as Arkham or Central; none by default. */
  traits?: readonly string[];
  victory?: number;
  abilities?: Ability[];
  /** Its action abilities, such as `resignAction()`. */
  actions?: readonly CardAction[];
  /** The connection symbol in its upper left corner; left out where nobody has entered it yet. */
  symbol?: LocationSymbol;
  /** Its "cannot" abilities (the Parlor's barrier on its unrevealed side). */
  restrictions?: readonly CardRestriction[];
}

/** Card stats for a hand-entered location of `set`, with both printed sides. */
export function location({
  code,
  name,
  set,
  shroud,
  cluesPerInvestigator,
  traits = [],
  victory,
  abilities,
  actions,
  symbol,
  restrictions,
}: LocationOptions): CardStats {
  return {
    ...scenarioCard(code, name, set),
    typeCode: 'location',
    traits: traitsOf(traits),
    shroud,
    clues: perInvestigator(cluesPerInvestigator),
    ...(victory === undefined ? {} : { victory }),
    ...(abilities === undefined ? {} : { abilities }),
    ...(actions === undefined ? {} : { actions }),
    ...(symbol === undefined ? {} : { symbol }),
    ...(restrictions === undefined ? {} : { restrictions }),
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
  /** Its forced abilities ("Wolf-Man" Drew's heal). */
  abilities?: readonly Ability[];
  /** Its action abilities, such as a Parley. */
  actions?: readonly CardAction[];
  /** Its "cannot" abilities (The Masked Hunter: who is engaged with it can't discover or spend clues). */
  restrictions?: readonly CardRestriction[];
}

/** Card stats for a hand-entered enemy, with its front picture (its back is the encounter back). */
export function enemy({
  code,
  set,
  traits,
  quantity = 1,
  victory,
  abilities,
  actions,
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
    ...(abilities ? { abilities } : {}),
    ...(actions ? { actions } : {}),
  };
}

/** Identity of a treachery and its number of copies. */
export interface TreacheryOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  traits: readonly string[];
  quantity: number;
  /** Keywords such as peril (Hunting Shadow). */
  keywords?: readonly Keyword[];
  /** Its revelation and forced abilities (Frozen in Fear's end-of-turn test). */
  abilities?: readonly Ability[];
  /** What it does attached to the drawer's location (Obscuring Fog). */
  locationAttachment?: LocationAttachment;
  /** Its constant abilities (Obscuring Fog's +2 shroud on its location). */
  modifiers?: readonly CardModifier[];
  /** Its action abilities, offered while it is in a threat area (Dreams of R'lyeh). */
  actions?: readonly CardAction[];
  /** Its "cannot" abilities (Locked Door: its location cannot be investigated). */
  restrictions?: readonly CardRestriction[];
}

/** Card stats for a hand-entered treachery, with its front picture. */
export function treachery({
  code,
  name,
  set,
  traits,
  quantity,
  keywords,
  abilities,
  locationAttachment,
  modifiers,
  actions,
  restrictions,
}: TreacheryOptions): CardStats {
  return {
    code: cardCode(code),
    name,
    typeCode: 'treachery',
    ...picturesOf(code, 'front'),
    traits: traitsOf(traits),
    encounterCode: set,
    quantity,
    ...(keywords ? { keywords } : {}),
    ...(abilities ? { abilities } : {}),
    ...(locationAttachment ? { locationAttachment } : {}),
    ...(modifiers ? { modifiers } : {}),
    ...(actions ? { actions } : {}),
    ...(restrictions ? { restrictions } : {}),
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
