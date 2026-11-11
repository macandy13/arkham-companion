import { z } from 'zod';
import { toCardCode } from './card_code';

/**
 * An optional field of external JSON (ArkhamDB, ArkhamCards): missing and `null` both read as
 * `undefined`, since those sources write either for "no value".
 */
export const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? undefined);

/** A card code in raw ArkhamDB or ArkhamCards data, checked as a string. */
export const CardCodeSchema = z.string().transform(toCardCode);
