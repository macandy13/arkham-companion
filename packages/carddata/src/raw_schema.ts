import { z } from 'zod';

/**
 * An optional field of external JSON (ArkhamDB, ArkhamCards): missing and `null` both read as
 * `undefined`, since those sources write either for "no value".
 */
export const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? undefined);
