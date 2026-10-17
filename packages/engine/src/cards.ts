import { stripTrailingDot } from '@arkham/util';
import type { Brand } from './ids';
import type { Keyword } from './keywords';
import type { ScenarioReference } from './scenario';
import type { SkillModifierRegistry } from './skill_modifiers';
import type { SkillTest, SkillValues } from './state';
import { CommandRejected } from './rejection';
import type { EffectsRegistry, ScenarioHooks } from './triggers';

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
 * setup or, for a mid-game branch, by a decision or hook – this type only
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
  code: string;
  name: string;
  typeCode: CardType;
  traits: readonly Trait[];
  /** Only on agendas and acts. */
  stage?: CardStage;
  shroud?: number;
  /** Clues placed on a revealed location, or the clue threshold of an act. */
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
  /** Doom threshold of an agenda. */
  doom?: ScaledValue;
  /** ArkhamDB encounter set the card belongs to; absent for player cards. */
  encounterCode?: string;
  /** Number of physical copies in the product; treated as 1 when absent. */
  quantity?: number;
  /** Keywords parsed from the card text at load time; none when absent. */
  keywords?: readonly Keyword[];
  /**
   * A treachery with this stays in the drawing investigator's threat area
   * instead of being discarded (derived from the card text by `carddata`).
   */
  entersThreatArea?: boolean;
  /**
   * The skill test a treachery's revelation asks of the drawing investigator
   * ("Revelation – Test [willpower] (3)"), entered with the card data; drawing
   * the card raises it as a `skillTestResult` decision. Only the test itself:
   * what failing costs stays card text the players apply.
   */
  revelationTest?: SkillTest;
}

/**
 * Read-only lookup of card definitions by code. The app backs it with the
 * cached ArkhamDB data, tests with small fakes; either way the engine stays
 * pure because it only ever receives the data, never loads it.
 */
export interface CardDb {
  /** The definition for `code`, or `undefined` if the code is not known. */
  get(code: string): CardStats | undefined;
  /**
   * Every definition whose `encounterCode` is `encounterCode`, one entry per
   * code (not per copy). Empty for an unknown set. Used to build the
   * encounter deck from a scenario's encounter sets.
   */
  encounterSet(encounterCode: string): readonly CardStats[];
}

/**
 * Everything `handle` needs besides the state and the command. Passed in
 * rather than stored in `GameState` so the state stays small and serialisable,
 * and so the reducer cannot depend on card data – events already carry the
 * values a rule computed from it. Hooks and effects are code, which is
 * another reason they live here and not in the serialisable state.
 */
export interface EngineContext {
  cards: CardDb;
  /** The running scenario's forced effects (`ScenarioDefinition.hooks`); none when absent. */
  hooks?: Partial<ScenarioHooks>;
  /** Card scripts by card code; none when absent. */
  effects?: EffectsRegistry;
  /**
   * The running scenario's reference card (`ScenarioDefinition.reference`),
   * for the symbol token modifiers of skill test suggestions; without it
   * those tokens count as unknown.
   */
  reference?: ScenarioReference;
  /** The running scenario's skill test modifiers (`ScenarioDefinition.modifiers`); none when absent. */
  modifiers?: SkillModifierRegistry;
}

/** Builds a `CardDb` from a list of definitions; a later duplicate code replaces an earlier one. */
export function cardDbFrom(defs: Iterable<CardStats>): CardDb {
  const byCode = new Map<string, CardStats>();
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
export function cardStats(cards: CardDb, code: string): CardStats {
  const stats = cards.get(code);
  if (!stats) throw new CommandRejected({ code: 'unknownCardCode', cardCode: code });
  return stats;
}
