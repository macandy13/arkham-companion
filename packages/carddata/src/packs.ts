import { commonWordPrefix, withoutTrailing } from '@arkham/util';

/**
 * Pack codes that belong to Chapter Two (the revised Arkham Horror LCG line, starting with
 * `core_2026`), for pack data without a `chapter` field. ArkhamDB marks every pack with its
 * chapter; this list only covers a response that leaves it out, so every
 * other pack without one counts as Chapter One. It holds the packs ArkhamDB's
 * `/api/public/packs/` marked `chapter: 2` on 2026-11-07.
 */
export const CHAPTER_TWO_PACK_CODES: readonly string[] = [
  'core_2026',
  'tom',
  'car',
  'and',
  'mar',
  'mig',
  'cob',
  'traces_to_nowhere_pack',
];

/** Rules edition a pack belongs to; Chapter One and Chapter Two cards are different for play. */
export type Chapter = 1 | 2;

/** Normalised ArkhamDB pack, used for the cycle/pack filters of the investigator picker. */
export interface PackDef {
  code: string;
  name: string;
  /** Position of the pack within its cycle (ArkhamDB `position`). */
  position: number;
  /** Position of the cycle (ArkhamDB `cycle_position`); packs of one cycle share it. */
  cyclePosition: number;
  chapter: Chapter;
}

/** Chapter of a pack known only by its code (see `CHAPTER_TWO_PACK_CODES`). */
export function chapterOfPack(packCode: string): Chapter {
  return CHAPTER_TWO_PACK_CODES.includes(packCode) ? 2 : 1;
}

/** ArkhamDB numbers the campaign cycles from 1 and the other product lines (`PRODUCT_LINES`) from here. */
export const FIRST_PRODUCT_LINE_CYCLE = 50;

/** The product lines ArkhamDB numbers as cycles from `FIRST_PRODUCT_LINE_CYCLE` on. */
export type ProductLine =
  | 'returnTo'
  | 'starterDecks'
  | 'chapterTwoStarterDecks'
  | 'sideStories'
  | 'chapterTwoSideStories'
  | 'novellasAndPromos'
  | 'parallel';

/**
 * Each product line by its cycle position (checked against `/api/public/packs/` on 2026-11-09).
 * Their packs share no name to read one from, so the UI names them in its own language.
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

/** What may stand between a cycle's name and the part its packs differ in (`Name – Expansion`). */
const NAME_SEPARATORS = ' -–—:,';

/**
 * The name of the campaign cycle at `cyclePosition`, read from its packs because ArkhamDB's pack
 * data names no cycles: the words its first two packs share (`The Dunwich Legacy` and `The Dunwich
 * Legacy Investigator Expansion`, `Edge of the Earth Investigator Expansion` and `… Campaign
 * Expansion`), without a separator it ends in, else its first pack's name (`Core Set` before
 * `Revised Core Set`). Packs at the same position keep their order in the data. Read from the packs
 * of the card language, so it comes translated. `undefined` for a product line
 * (`FIRST_PRODUCT_LINE_CYCLE`), whose packs share no name, and for a cycle without packs.
 */
export function campaignCycleName(
  packs: readonly PackDef[],
  cyclePosition: number,
): string | undefined {
  if (cyclePosition >= FIRST_PRODUCT_LINE_CYCLE) return undefined;
  const [first, second] = packs
    .filter((pack) => pack.cyclePosition === cyclePosition)
    .sort((a, b) => a.position - b.position);
  if (!first) return undefined;
  const shared = second
    ? withoutTrailing(commonWordPrefix(first.name, second.name), NAME_SEPARATORS)
    : '';
  return shared || first.name;
}
