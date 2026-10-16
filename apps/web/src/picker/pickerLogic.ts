import type { Chapter, InvestigatorDef, PackDef } from '@arkham/carddata';

/** Faction codes in the order the class chips are shown. */
export const FACTION_CODES = [
  'guardian',
  'seeker',
  'rogue',
  'mystic',
  'survivor',
  'neutral',
] as const;

/** Filter state of the investigator picker; an empty/absent field means "no restriction". */
export interface PickerFilters {
  readonly search: string;
  readonly factions: readonly string[];
  readonly cyclePosition?: number;
  readonly packCode?: string;
  readonly chapter?: Chapter;
  /** The "my collection" filter; needs the owned packs passed to `applyPickerFilters`. */
  readonly onlyOwned: boolean;
}

/**
 * Applies the picker filters and sorts by name, then chapter, so both chapter versions of an
 * investigator sit next to each other. Without `ownedPacks` (settings arrive in M2.4) the
 * collection filter has nothing to compare against and keeps everything.
 */
export function applyPickerFilters(
  investigators: readonly InvestigatorDef[],
  filters: PickerFilters,
  ownedPacks?: ReadonlySet<string>,
): InvestigatorDef[] {
  const search = filters.search.trim().toLowerCase();
  return investigators
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search) &&
        (filters.factions.length === 0 || filters.factions.includes(i.factionCode)) &&
        (filters.cyclePosition === undefined || i.cyclePosition === filters.cyclePosition) &&
        (filters.packCode === undefined || i.packCode === filters.packCode) &&
        (filters.chapter === undefined || i.chapter === filters.chapter) &&
        (!filters.onlyOwned || ownedPacks === undefined || ownedPacks.has(i.packCode)),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.chapter - b.chapter);
}

/** Distinct cycle positions of the packs, ascending. */
export function cyclePositions(packs: readonly PackDef[]): number[] {
  return [...new Set(packs.map((p) => p.cyclePosition))].sort((a, b) => a - b);
}

/** Packs ordered by cycle, then by position within the cycle. */
export function sortedPacks(packs: readonly PackDef[]): PackDef[] {
  return [...packs].sort((a, b) => a.cyclePosition - b.cyclePosition || a.position - b.position);
}

/** Returns `seats` with the entry at `from` moved to index `to`; out-of-range moves change nothing. */
export function moveSeat<T>(seats: readonly T[], from: number, to: number): T[] {
  const inRange = (i: number) => i >= 0 && i < seats.length;
  if (!inRange(from) || !inRange(to)) return [...seats];
  const result = [...seats];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved as T);
  return result;
}
