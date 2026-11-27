import {
  cardCode,
  cardImagePath,
  fixed,
  perInvestigator,
  trait,
  withAdvance,
  type Ability,
  type ActAdvanceRule,
  type CardAction,
  type Modifier,
  type GroupClueCost,
  type CardRestriction,
  type CardStats,
  type EncounterSetCode,
  type Keyword,
  type CopyLimit,
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
  /** The file type of its pictures on ArkhamDB; PNG by default. */
  pictures?: PictureFormat;
  stage: number;
  /** Its doom threshold; a special agenda that is also the act (Brethren of Ash) prints none. */
  doom?: number;
  /** Its reverse side (`whenAdvanced`). */
  abilities?: readonly Ability[];
  /** Its action abilities, such as `resignAction()`. */
  actions?: readonly CardAction[];
  /** Its constant modifiers while it is the current agenda ("Each enemy gets +1 fight"). */
  modifiers?: readonly Modifier[];
  /** Its constant "cannot" abilities while it is the current agenda. */
  restrictions?: readonly CardRestriction[];
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
  modifiers,
  restrictions,
  pictures,
}: AgendaOptions): CardStats {
  return {
    ...scenarioCard(code, name, set, pictures),
    typeCode: 'agenda',
    stage: { number: stage },
    ...(doom === undefined ? {} : { doom: fixed(doom) }),
    ...(abilities ? { abilities } : {}),
    ...(actions ? { actions } : {}),
    ...(modifiers ? { modifiers } : {}),
    ...(restrictions ? { restrictions } : {}),
  };
}

/**
 * Printed values of an act: its clue threshold (`cluesPerInvestigator`, spent as a group), or the
 * objective that replaces it (`advance`); `withAdvance` adds what does it.
 */
export type ActOptions = ActPrintedValues &
  (
    | { cluesPerInvestigator?: number; advance?: never }
    | {
        cluesPerInvestigator?: never;
        /** An objective that advances it instead of a clue threshold (The Barrier, Disrupting the Ritual). */
        advance: Exclude<ActAdvanceRule, { kind: 'spendClues' }>;
      }
  );

/** What every act prints, whichever way it advances (`ActOptions`). */
interface ActPrintedValues {
  code: string;
  name: string;
  set: EncounterSetCode;
  /** The file type of its pictures on ArkhamDB; PNG by default. */
  pictures?: PictureFormat;
  stage: number;
  /** Its reverse side (`whenAdvanced`) and its other objectives. */
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
  advance,
  abilities,
  actions,
  pictures,
}: ActOptions): CardStats {
  const rule: ActAdvanceRule | undefined =
    advance ??
    (cluesPerInvestigator === undefined
      ? undefined
      : { kind: 'spendClues', clues: perInvestigator(cluesPerInvestigator) });
  return withAdvance({
    ...scenarioCard(code, name, set, pictures),
    typeCode: 'act',
    stage: { number: stage },
    ...(abilities ? { abilities } : {}),
    ...(actions ? { actions } : {}),
    ...(rule ? { advance: rule } : {}),
  });
}

/** Printed values of a location whose clues scale per investigator. */
export interface LocationOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  /** The file type of its pictures on ArkhamDB; PNG by default. */
  pictures?: PictureFormat;
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
  /** The symbol its unrevealed side prints, where that differs from `symbol`. */
  unrevealedSymbol?: LocationSymbol;
  /** The connection symbols at the foot of its revealed side, read from the card's picture. */
  connectsTo?: readonly LocationSymbol[];
  /** The connection symbols its unrevealed side prints, where they differ from `connectsTo`. */
  unrevealedConnectsTo?: readonly LocationSymbol[];
  /** Its "cannot" abilities (the Parlor's barrier on its unrevealed side). */
  restrictions?: readonly CardRestriction[];
  /** Its constant modifiers once revealed (Waterfront District's additional action to investigate it). */
  modifiers?: readonly Modifier[];
  /** The clues the investigators spend as a group to enter it while unrevealed (Underground Cistern). */
  enterCost?: GroupClueCost;
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
  unrevealedSymbol,
  connectsTo,
  unrevealedConnectsTo,
  restrictions,
  modifiers,
  enterCost,
  pictures,
}: LocationOptions): CardStats {
  return {
    ...scenarioCard(code, name, set, pictures),
    typeCode: 'location',
    traits: traitsOf(traits),
    shroud,
    clues: perInvestigator(cluesPerInvestigator),
    ...(victory === undefined ? {} : { victory }),
    ...(abilities === undefined ? {} : { abilities }),
    ...(actions === undefined ? {} : { actions }),
    ...(symbol === undefined ? {} : { symbol }),
    ...(unrevealedSymbol === undefined ? {} : { unrevealedSymbol }),
    ...(connectsTo === undefined ? {} : { connectsTo }),
    ...(unrevealedConnectsTo === undefined ? {} : { unrevealedConnectsTo }),
    ...(restrictions === undefined ? {} : { restrictions }),
    ...(modifiers === undefined ? {} : { modifiers }),
    ...(enterCost === undefined ? {} : { enterCost }),
  };
}

/** Printed values of an enemy; `quantity` defaults to 1. */
export interface EnemyOptions {
  code: string;
  name: string;
  set: EncounterSetCode;
  /** The file type of its pictures on ArkhamDB; PNG by default. */
  pictures?: PictureFormat;
  traits: readonly string[];
  fight: number;
  evade: number;
  health: ScaledValue;
  damage: number;
  horror: number;
  victory?: number;
  /** A unique enemy (✷), such as the cultists of The Midnight Masks. */
  unique?: true;
  quantity?: number;
  keywords?: readonly Keyword[];
  /** Its forced abilities ("Wolf-Man" Drew's heal). */
  abilities?: readonly Ability[];
  /** Its action abilities, such as a Parley. */
  actions?: readonly CardAction[];
  /** Its "cannot" abilities (The Masked Hunter: who is engaged with it can't discover or spend clues). */
  restrictions?: readonly CardRestriction[];
  /** Its constant modifiers (Whippoorwill's -1 to each skill of each investigator at its location). */
  modifiers?: readonly Modifier[];
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
  pictures,
  ...stats
}: EnemyOptions): CardStats {
  return {
    ...stats,
    code: cardCode(code),
    typeCode: 'enemy',
    ...picturesOf(code, 'front', pictures),
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
  /** The file type of its pictures on ArkhamDB; PNG by default. */
  pictures?: PictureFormat;
  traits: readonly string[];
  quantity: number;
  /** Keywords such as peril (Hunting Shadow). */
  keywords?: readonly Keyword[];
  /** Its revelation and forced abilities (Frozen in Fear's end-of-turn test). */
  abilities?: readonly Ability[];
  /** "Limit 1 per location / investigator" (Obscuring Fog, attached to the drawer's location). */
  limit?: CopyLimit;
  /** Its constant abilities (Obscuring Fog's +2 shroud on its location, Frozen in Fear's action cost). */
  modifiers?: readonly Modifier[];
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
  limit,
  modifiers,
  actions,
  restrictions,
  pictures,
}: TreacheryOptions): CardStats {
  return {
    code: cardCode(code),
    name,
    typeCode: 'treachery',
    ...picturesOf(code, 'front', pictures),
    traits: traitsOf(traits),
    encounterCode: set,
    quantity,
    ...(keywords ? { keywords } : {}),
    ...(abilities ? { abilities } : {}),
    ...(limit ? { limit } : {}),
    ...(modifiers ? { modifiers } : {}),
    ...(actions ? { actions } : {}),
    ...(restrictions ? { restrictions } : {}),
  };
}

/** A single-copy, trait-less card of a scenario's own encounter set, with both printed sides. */
function scenarioCard(
  code: string,
  name: string,
  set: EncounterSetCode,
  pictures?: PictureFormat,
): Omit<CardStats, 'typeCode'> {
  return {
    code: cardCode(code),
    name,
    traits: [],
    encounterCode: set,
    quantity: 1,
    ...picturesOf(code, 'both', pictures),
  };
}

/**
 * The file type of a pack's pictures on ArkhamDB: the Core Set's are PNGs, the Core Set (2026)'s
 * JPEGs; any other file name answers with an error page.
 */
export type PictureFormat = 'png' | 'jpg';

/**
 * Where the pictures of card `code` are on ArkhamDB: its front, and its back when the card has
 * `both` printed sides of its own (agendas, acts, locations; an encounter card's back is the
 * shared encounter back). The app loads them on the player's device; they are never bundled.
 */
export function picturesOf(
  code: string,
  sides: 'front' | 'both',
  format: PictureFormat = 'png',
): Pick<CardStats, 'imageSrc' | 'backImageSrc'> {
  return {
    imageSrc: cardImagePath(`/bundles/cards/${code}.${format}`),
    ...(sides === 'both'
      ? { backImageSrc: cardImagePath(`/bundles/cards/${code}b.${format}`) }
      : {}),
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
