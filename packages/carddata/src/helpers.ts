import type { CardDef } from './schema';

export function cardsByEncounterCode(cards: readonly CardDef[], encounterCode: string): CardDef[] {
  return cards.filter((c) => c.encounterCode === encounterCode);
}

/** Repeat each card `quantity` times (a physical deck list). */
export function expandByQuantity(cards: readonly CardDef[]): CardDef[] {
  return cards.flatMap((c) => Array.from({ length: c.quantity }, () => c));
}
