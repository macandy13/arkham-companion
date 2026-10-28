import { stripTrailingDot } from '@arkham/util';
import type { Ability } from './abilities';
import type { CardAction } from './card_actions';
import type { CardModifier } from './card_values';
import type { CardRestriction } from './restrictions';
import type { Brand, CardCode, CardImagePath, EncounterSetCode } from './ids';
import type { Keyword } from './keywords';
import type { ScenarioDefinition } from './scenario';
import type { SkillValues } from './state';
import { CommandRejected } from './rejection';

/**
 * ArkhamDB `type_code` values, covering encounter and player cards.
 * `enemy_location` is the dual-typed card introduced with The Feast of
 * Hemlock Vale; it is listed so a whole cached pack can be typed even before
 * the engine has rules for it.
 */
export const CARD_TYPES = [
  'investigator',
  'asset',
  'event',
  'skill',
  'treachery',
  'enemy',
  'location',
  'enemy_location',
  'act',
  'agenda',
  'story',
  'scenario',
  'key',
] as const;

/** A card's ArkhamDB type (`CardStats.typeCode`); see `CARD_TYPES`. */
export type CardType = (typeof CARD_TYPES)[number];

/**
 * A trait as printed on a card, e.g. `Monster` or `Elite`. Branded instead of
 * a string-literal union because there are hundreds of traits and every new
 * pack adds some, so a closed union would need constant upkeep; the brand
 * still keeps arbitrary strings (card codes, names) from being compared with
 * traits by accident. Create one with `trait`.
 */
export type Trait = Brand<string, 'Trait'>;

/** Tags a plain string as a `Trait`, without validating it against a list. */
export const trait = (name: string) => name as Trait;

/**
 * A printed number that may scale with the player count, e.g. "2 per
 * investigator" or a plain "3". Its total is `fixed + perInvestigator ×
 * playerCount`; compute it with `resolveValue`.
 *
 * Mapping from ArkhamDB (via carddata's `CardDef`): a value with the
 * per-investigator flag (`health_per_investigator`, or `clues` without
 * `clues_fixed`) becomes `{ fixed: 0, perInvestigator: n }`, any other value
 * `{ fixed: n, perInvestigator: 0 }`. ArkhamDB cannot express a mixed value
 * like "3 + 1 per investigator"; scenario data supplies those.
 *
 * There is deliberately no term for game state such as "+1 per act": such
 * values depend on the current state rather than the printed card, so the
 * rule that reads them computes the extra part itself. If a printed value
 * ever needs another term, it gets an optional field here and a matching
 * argument on `resolveValue`.
 */
export interface ScaledValue {
  readonly fixed: number;
  readonly perInvestigator: number;
}

/** The total of a `ScaledValue` for `playerCount` investigators. */
export function resolveValue(value: ScaledValue, playerCount: number): number {
  return value.fixed + value.perInvestigator * playerCount;
}

/**
 * Position of an agenda or act in its deck, e.g. 2 for "Agenda 2a".
 *
 * Some scenarios print several cards for the same stage (2a/b and 2c/d, or
 * alternative 1a/b acts); `variant` is the letter of the front face that tells
 * them apart (`'c'` for "2c"), and is omitted for the usual `a` side. Decks
 * are ordered by `number` only: cards sharing a number are alternatives, and
 * exactly one of them belongs in the deck. Which one is chosen by scenario
 * setup or, for a mid-game branch, by a decision or card ability – this type only
 * makes the choice expressible.
 */
export interface CardStage {
  readonly number: number;
  readonly variant?: string;
}

/**
 * The static card data the rules read (doom threshold, clues, shroud, enemy
 * stats). The engine declares its own type instead of using carddata's
 * `CardDef`, so it never depends on `carddata` (and its zod schemas) at
 * runtime. Values that scale with the player count are `ScaledValue`s, whose
 * doc comment describes how the ArkhamDB fields map onto them.
 */
export interface CardStats {
  /** ArkhamDB card code; `CardInstance.code` refers to it. */
  code: CardCode;
  name: string;
  typeCode: CardType;
  traits: readonly Trait[];
  /** Only on agendas and acts. */
  stage?: CardStage;
  shroud?: number;
  /** Clues placed on a revealed location (an act's clue cost is its `advanceBySpendingClues`). */
  clues?: ScaledValue;
  fight?: number;
  evade?: number;
  /** Enemy health, or an investigator's printed health (always `fixed`). */
  health?: ScaledValue;
  /** Only on investigators. */
  sanity?: number;
  /** Only on investigators: the printed willpower, intellect, combat and agility. */
  skills?: SkillValues;
  /** Damage an enemy deals when it attacks. */
  damage?: number;
  /** Horror an enemy deals when it attacks. */
  horror?: number;
  victory?: number;
  /** A unique card (✷ before its name): only one copy can be in play; counted by objectives such as "6 unique [[Cultist]] enemies". */
  unique?: true;
  /** Doom threshold of an agenda. */
  doom?: ScaledValue;
  /** ArkhamDB encounter set the card belongs to; absent for player cards. */
  encounterCode?: EncounterSetCode;
  /** Number of physical copies in the product; treated as 1 when absent. */
  quantity?: number;
  /** Keywords parsed from the card text at load time; none when absent. */
  keywords?: readonly Keyword[];
  /**
   * Set for a treachery whose revelation attaches it to a location (Obscuring
   * Fog to the drawer's, Locked Door to the one with the most clues), entered
   * with the card data; its fields say what limits it there.
   */
  locationAttachment?: LocationAttachment;
  /**
   * Its constant abilities that change a value of cards while it is in play
   * ("Attached location gets +2 shroud"); `effectiveValue` reads them. None
   * when absent.
   */
  modifiers?: readonly CardModifier[];
  /**
   * Its constant "cannot" abilities ("The attached location cannot be investigated");
   * `isRestricted` reads them. None when absent.
   */
  restrictions?: readonly CardRestriction[];
  /** The card's forced abilities as data (architecture "Triggers and card effects"); none when absent. */
  abilities?: readonly Ability[];
  /** The card's action abilities ("[action]: …"), taken with `UseCardAction`; none when absent. */
  actions?: readonly CardAction[];
  /**
   * The picture of its front on ArkhamDB, only for the views to show; no rule reads it. A
   * location's front is its revealed side.
   */
  imageSrc?: CardImagePath;
  /** The picture of its back on ArkhamDB, for the views only: a location's unrevealed side. */
  backImageSrc?: CardImagePath;
}

/**
 * What a treachery attached to a location by its revelation does
 * (`CardStats.locationAttachment`). Only what the engine applies: anything
 * else the card says stays card text the players apply.
 */
export interface LocationAttachment {
  /**
   * "Limit 1 per location": drawn while a card of the same title is attached
   * there, it is discarded instead, since its revelation cannot attach it.
   */
  onePerLocation?: boolean;
}

/**
 * Read-only lookup of card definitions by code. The app backs it with the
 * cached ArkhamDB data, tests with small fakes; either way the engine stays
 * pure because it only ever receives the data, never loads it.
 */
export interface CardDb {
  /** The definition for `code`, or `undefined` if the code is not known. */
  get(code: CardCode): CardStats | undefined;
  /**
   * Every definition whose `encounterCode` is `encounterCode`, one entry per
   * code (not per copy). Empty for an unknown set. Used to build the
   * encounter deck from a scenario's encounter sets.
   */
  encounterSet(encounterCode: EncounterSetCode): readonly CardStats[];
}

/**
 * Everything `handle` needs besides the state and the command. Passed in
 * rather than stored in `GameState` so the state stays small and serialisable,
 * and so the reducer cannot depend on card data – events already carry the
 * values a rule computed from it. A scenario's skill modifiers are code,
 * which is another reason they live here and not in the serialisable state.
 */
export interface EngineContext {
  cards: CardDb;
  /**
   * The running scenario. The engine reads its reference card and its skill
   * test modifiers from here, so a caller passes the definition once and
   * cannot leave one of them out. Absent for tests
   * that start from a bare board: then nothing scenario-specific happens and
   * symbol tokens count as unknown in skill test suggestions.
   */
  scenario?: ScenarioDefinition;
}

/**
 * The context of a game of one scenario: `EngineContext` with its `scenario`
 * required. `compileSetup` takes one, so the definition a game is set up from
 * is the one its later commands run with.
 */
export type ScenarioContext = EngineContext & { readonly scenario: ScenarioDefinition };

/** Builds a `CardDb` from a list of definitions; a later duplicate code replaces an earlier one. */
export function cardDbFrom(defs: Iterable<CardStats>): CardDb {
  const byCode = new Map<CardCode, CardStats>();
  for (const def of defs) byCode.set(def.code, def);
  return {
    get: (code) => byCode.get(code),
    encounterSet: (encounterCode) =>
      [...byCode.values()].filter((def) => def.encounterCode === encounterCode),
  };
}

/**
 * `base` plus `extra`, e.g. a scenario's cards plus the chosen investigators;
 * a card in `extra` replaces one with the same code in `base`.
 */
export function cardDbWith(base: CardDb, extra: Iterable<CardStats>): CardDb {
  const added = cardDbFrom(extra);
  return {
    get: (code) => added.get(code) ?? base.get(code),
    encounterSet: (encounterCode) => [
      ...base.encounterSet(encounterCode).filter((def) => added.get(def.code) === undefined),
      ...added.encounterSet(encounterCode),
    ],
  };
}

/**
 * The form in which card names and keyword details (a `spawn` location, a
 * `prey` criterion) are compared: case-insensitive, ignoring surrounding
 * whitespace and the full stop that ends a printed instruction ("Spawn -
 * Attic."). One function so that every lookup by printed text agrees.
 */
export function comparableName(text: string): string {
  return stripTrailingDot(text.trim()).toLowerCase();
}

/** The definition for `code`; throws `CommandRejected` (`unknownCardCode`) if the db lacks it. */
export function cardStats(cards: CardDb, code: CardCode): CardStats {
  const stats = cards.get(code);
  if (!stats) throw new CommandRejected({ code: 'unknownCardCode', cardCode: code });
  return stats;
}
