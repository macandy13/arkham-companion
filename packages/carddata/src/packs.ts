import { z } from 'zod';

/**
 * Pack codes that belong to Chapter Two (the revised Arkham Horror LCG line, starting with
 * `core_2026`). ArkhamDB has no chapter field, so this list is the single place to extend when
 * further Chapter Two products appear; every other pack counts as Chapter One.
 */
export const CHAPTER_TWO_PACK_CODES: readonly string[] = ['core_2026'];

/** Rules edition a pack belongs to; Chapter One and Chapter Two cards are different for play. */
export type Chapter = 1 | 2;

/** Normalised ArkhamDB pack, used for the cycle/pack filters of the investigator picker. */
export const PackDefSchema = z.object({
  code: z.string(),
  name: z.string(),
  /** Position of the pack within its cycle (ArkhamDB `position`). */
  position: z.number().int(),
  /** Position of the cycle (ArkhamDB `cycle_position`); packs of one cycle share it. */
  cyclePosition: z.number().int(),
  chapter: z.union([z.literal(1), z.literal(2)]),
});
export type PackDef = z.infer<typeof PackDefSchema>;

const RawPackSchema = z.object({
  code: z.string(),
  name: z.string(),
  position: z.number().int(),
  cycle_position: z.number().int(),
});

/** Chapter of a pack, derived from its code (see `CHAPTER_TWO_PACK_CODES`). */
export function chapterOfPack(packCode: string): Chapter {
  return CHAPTER_TWO_PACK_CODES.includes(packCode) ? 2 : 1;
}

/** Convert the raw `/api/public/packs/` response into `PackDef`s. Throws on malformed input. */
export function normalisePacks(raw: unknown): PackDef[] {
  if (!Array.isArray(raw)) throw new Error('Expected an array of packs');
  return raw.map((entry) => {
    const r = RawPackSchema.parse(entry);
    return {
      code: r.code,
      name: r.name,
      position: r.position,
      cyclePosition: r.cycle_position,
      chapter: chapterOfPack(r.code),
    };
  });
}
