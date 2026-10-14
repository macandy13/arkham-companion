import type { CardStats } from './cards';

/**
 * The keywords the rules react to. Mirrors `KEYWORD_NAMES` in
 * `@arkham/carddata`, which parses them from the card text at load time; the
 * engine declares its own copy so it never depends on `carddata`.
 */
export type KeywordName =
  | 'surge'
  | 'peril'
  | 'hunter'
  | 'aloof'
  | 'elite'
  | 'massive'
  | 'retaliate'
  | 'alert'
  | 'patrol'
  | 'prey'
  | 'spawn';

/** One keyword of a card, as parsed by `carddata`. Victory points are `CardStats.victory`. */
export interface Keyword {
  name: KeywordName;
  /** The text after `patrol`, `prey` and `spawn`, e.g. "Highest [agility]". */
  detail?: string;
}

/** Whether the card has the keyword. */
export function hasKeyword(stats: CardStats, name: KeywordName): boolean {
  return stats.keywords?.some((keyword) => keyword.name === name) ?? false;
}
