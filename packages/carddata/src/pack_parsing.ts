import { z } from 'zod';
import { chapterOfPack, type PackDef } from './packs';

// Apart from packs.ts, so the app's start-up code, which reads packs only through their helpers,
// doesn't pull in zod: the schemas parse fetched data only (`fetchCatalog`, loaded on demand).

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
