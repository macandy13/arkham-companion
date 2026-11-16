import type { CardCode, WeaknessDef } from '@arkham/carddata';

/**
 * The groups the "Draw a weakness" dialog lists, in its order: the investigator's own signature
 * weaknesses, the basic weaknesses any deck may hold, and the signature weaknesses of others,
 * which a card can still put into a deck.
 */
export type WeaknessGroup = 'theirs' | 'basic' | 'others';

/** One group of `weaknessGroups`, its cards by name. */
export interface WeaknessGroupList {
  group: WeaknessGroup;
  cards: readonly WeaknessDef[];
}

/**
 * The catalog's `weaknesses` for `investigator` (an investigator card code) grouped as the dialog
 * lists them (`WeaknessGroup`), each by name, keeping only those whose name contains `search`
 * (ignoring case, as the investigator picker's search does); a group with no card left is left out.
 */
export function weaknessGroups(
  weaknesses: readonly WeaknessDef[],
  investigator: CardCode,
  search: string,
): WeaknessGroupList[] {
  const wanted = search.trim().toLowerCase();
  const groupOf = (card: WeaknessDef): WeaknessGroup =>
    card.signatureOf?.includes(investigator) ? 'theirs' : card.basic ? 'basic' : 'others';
  const found = weaknesses
    .filter((card) => card.name.toLowerCase().includes(wanted))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (['theirs', 'basic', 'others'] as const)
    .map((group) => ({ group, cards: found.filter((card) => groupOf(card) === group) }))
    .filter(({ cards }) => cards.length > 0);
}
