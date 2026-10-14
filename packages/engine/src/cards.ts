import { CommandRejected } from './rejection';

/**
 * The static card data the rules read (doom threshold, clues, shroud, enemy
 * stats). It mirrors a subset of `CardDef` from `@arkham/carddata` field for
 * field, so a `CardDef` can be passed in as is – but the engine declares its
 * own type so it never depends on `carddata` (and its zod schemas) at runtime.
 */
export interface CardStats {
  /** ArkhamDB card code; `CardInstance.code` refers to it. */
  code: string;
  name: string;
  /** ArkhamDB type, e.g. 'agenda', 'act', 'location', 'enemy', 'treachery'. */
  typeCode: string;
  traits: readonly string[];
  /** Position of an agenda or act in its deck. */
  stage?: number;
  shroud?: number;
  /** Clues on a location, or the clue threshold of an act; per investigator unless `cluesFixed`. */
  clues?: number;
  cluesFixed?: boolean;
  fight?: number;
  evade?: number;
  /** Enemy health; per investigator if `healthPerInvestigator`. */
  health?: number;
  healthPerInvestigator?: boolean;
  /** Damage an enemy deals when it attacks. */
  damage?: number;
  /** Horror an enemy deals when it attacks. */
  horror?: number;
  victory?: number;
  /** Doom threshold of an agenda. */
  doom?: number;
}

/**
 * Read-only lookup of card definitions by code. The app backs it with the
 * cached ArkhamDB data, tests with small fakes; either way the engine stays
 * pure because it only ever receives the data, never loads it.
 */
export interface CardDb {
  /** The definition for `code`, or `undefined` if the code is not known. */
  get(code: string): CardStats | undefined;
}

/**
 * Everything `handle` needs besides the state and the command. Passed in
 * rather than stored in `GameState` so the state stays small and serialisable,
 * and so the reducer cannot depend on card data – events already carry the
 * values a rule computed from it.
 */
export interface EngineContext {
  cards: CardDb;
}

/** Builds a `CardDb` from a list of definitions; a later duplicate code replaces an earlier one. */
export function cardDbFrom(defs: Iterable<CardStats>): CardDb {
  const byCode = new Map<string, CardStats>();
  for (const def of defs) byCode.set(def.code, def);
  return { get: (code) => byCode.get(code) };
}

/** The definition for `code`; throws `CommandRejected` (`unknownCardCode`) if the db lacks it. */
export function cardStats(cards: CardDb, code: string): CardStats {
  const stats = cards.get(code);
  if (!stats) throw new CommandRejected({ code: 'unknownCardCode', cardCode: code });
  return stats;
}

/** A printed "per investigator" value (e.g. "2 per investigator") for the current player count. */
export function perInvestigator(value: number, playerCount: number): number {
  return value * playerCount;
}

/**
 * Clues placed on a revealed location, or the clue threshold of an act.
 * `undefined` when the card has no clue value.
 */
export function clueValue(stats: CardStats, playerCount: number): number | undefined {
  if (stats.clues === undefined) return undefined;
  return stats.cluesFixed ? stats.clues : perInvestigator(stats.clues, playerCount);
}

/** An enemy's health for the current player count; `undefined` when the card has no health. */
export function enemyHealth(stats: CardStats, playerCount: number): number | undefined {
  if (stats.health === undefined) return undefined;
  return stats.healthPerInvestigator ? perInvestigator(stats.health, playerCount) : stats.health;
}
