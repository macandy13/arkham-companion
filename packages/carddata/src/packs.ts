import { commonWordPrefix } from '@arkham/util';
import { z } from 'zod';

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

/** Raw ArkhamDB pack shape, checked at runtime because the API is external. */
const RawPackSchema = z.object({
  code: z.string(),
  name: z.string(),
  position: z.number().int(),
  cycle_position: z.number().int(),
  // The API sends it for every pack (checked 2026-10-23); a missing or unexpected value still falls
  // back to the code instead of failing the whole catalog.
  chapter: z
    .union([z.literal(1), z.literal(2)])
    .optional()
    .catch(undefined),
});

/** Chapter of a pack known only by its code (see `CHAPTER_TWO_PACK_CODES`). */
export function chapterOfPack(packCode: string): Chapter {
  return CHAPTER_TWO_PACK_CODES.includes(packCode) ? 2 : 1;
}

/**
 * Convert the raw `/api/public/packs/` response into `PackDef`s, with the chapter the data
 * gives or else the one its code implies. Throws on malformed input.
 */
export function normalisePacks(raw: unknown): PackDef[] {
  if (!Array.isArray(raw)) throw new Error('Expected an array of packs');
  return raw.map((entry) => {
    const r = RawPackSchema.parse(entry);
    return {
      code: r.code,
      name: r.name,
      position: r.position,
      cyclePosition: r.cycle_position,
      chapter: r.chapter ?? chapterOfPack(r.code),
    };
  });
}

/**
 * ArkhamDB numbers the campaign cycles from 1 and puts the other product lines at 50 and above
 * (Return to… boxes 50, starter decks 60/61, side stories 70/73, novellas and promos 80, parallel
 * investigators 90; checked against `/api/public/packs/` on 2026-11-09).
 */
export const FIRST_PRODUCT_LINE_CYCLE = 50;

/**
 * The name of the campaign cycle at `cyclePosition`, read from its packs because ArkhamDB's pack
 * data names no cycles: the words its first two packs share (`The Dunwich Legacy` and `The Dunwich
 * Legacy Investigator Expansion`, `Edge of the Earth Investigator Expansion` and `… Campaign
 * Expansion`), else its first pack's name (`Core Set` before `Revised Core Set`). Read from the
 * packs of the card language, so it comes translated. `undefined` for a product line
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
  return (second && commonWordPrefix(first.name, second.name)) || first.name;
}
