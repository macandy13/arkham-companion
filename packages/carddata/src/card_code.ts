import { z } from 'zod';

/**
 * ArkhamDB card code, e.g. '01111' for the Study. carddata doesn't depend on the engine, so it
 * declares the brand itself, in the same shape as the engine's `CardCode`
 * (`Brand<string, 'CardCode'>`): TypeScript compares the two structurally, so a code read here
 * is the engine's card code without a cast (checked in `card_code.test.ts` of the scenarios).
 */
export type CardCode = string & { readonly __brand: 'CardCode' };

/**
 * `code` as a card code, for data that names cards by their ArkhamDB code. Not called `cardCode`
 * like the engine's constructor, so code that imports both packages (the web app) has no clash.
 */
export function toCardCode(code: string): CardCode {
  return code as CardCode;
}

/** A card code in raw ArkhamDB or ArkhamCards data, checked as a string. */
export const CardCodeSchema = z.string().transform(toCardCode);
