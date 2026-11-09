import type { CardCode, Chapter, InvestigatorDef, PackDef } from '@arkham/carddata';

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
 * investigator sit next to each other; quotes and other punctuation do not count, so "Ashcan" Pete
 * sorts under A. Without `ownedPacks` (settings arrive in M2.4) the
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
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { ignorePunctuation: true }) ||
        a.chapter - b.chapter,
    );
}

/**
 * The picker's list (MD.3e): the seated investigators first in seat order, the lead first, so a
 * pick stays in sight while the players browse, then the others as `applyPickerFilters` leaves
 * them. The filters never hide a seated one, since the sheet that removes them opens from its
 * portrait.
 */
export function pickerList(
  investigators: readonly InvestigatorDef[],
  filters: PickerFilters,
  seats: readonly CardCode[],
  ownedPacks?: ReadonlySet<string>,
): InvestigatorDef[] {
  const seated = seats.flatMap((code) => investigators.filter((i) => i.code === code));
  const others = investigators.filter((i) => !seats.includes(i.code));
  return [...seated, ...applyPickerFilters(others, filters, ownedPacks)];
}

/** How many of the filters other than the search are set, as the filter button counts them. */
export function activeFilterCount(filters: PickerFilters): number {
  return [
    filters.factions.length > 0,
    filters.cyclePosition !== undefined,
    filters.packCode !== undefined,
    filters.chapter !== undefined,
    filters.onlyOwned,
  ].filter(Boolean).length;
}

/** The product lines ArkhamDB numbers as cycles from 50 on (`FIRST_PRODUCT_LINE_CYCLE`). */
export type ProductLine =
  | 'returnTo'
  | 'starterDecks'
  | 'chapterTwoStarterDecks'
  | 'sideStories'
  | 'chapterTwoSideStories'
  | 'novellasAndPromos'
  | 'parallel';

/**
 * Each product line by its cycle position, so the cycle filter names it in the UI language; its
 * packs share no name to read one from (checked against `/api/public/packs/` on 2026-11-09).
 */
export const PRODUCT_LINES: Readonly<Partial<Record<number, ProductLine>>> = {
  50: 'returnTo',
  60: 'starterDecks',
  61: 'chapterTwoStarterDecks',
  70: 'sideStories',
  73: 'chapterTwoSideStories',
  80: 'novellasAndPromos',
  90: 'parallel',
};

/** Distinct cycle positions of the packs, ascending. */
export function cyclePositions(packs: readonly PackDef[]): number[] {
  return [...new Set(packs.map((p) => p.cyclePosition))].sort((a, b) => a - b);
}

/** Packs ordered by cycle, then by position within the cycle. */
export function sortedPacks(packs: readonly PackDef[]): PackDef[] {
  return [...packs].sort((a, b) => a.cyclePosition - b.cyclePosition || a.position - b.position);
}

/** The seat (1-based) that `code` holds in `seats`, or nothing when it is not seated. */
export function seatNumber(seats: readonly CardCode[], code: CardCode): number | undefined {
  const index = seats.indexOf(code);
  return index < 0 ? undefined : index + 1;
}
