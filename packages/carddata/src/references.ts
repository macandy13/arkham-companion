import { z } from 'zod';

/** A symbol chaos token a scenario reference card prints a row for, named as the engine names it. */
export type ReferenceToken = 'skull' | 'cultist' | 'tablet' | 'elderThing';

/** One side of a reference card: each token's text, in ArkhamDB markup (`[[Ghoul]]`, `[skull]`). */
export type ReferenceSideTexts = Partial<Record<ReferenceToken, string>>;

/**
 * The printed texts of a scenario reference card (`buildReferences`): its front for Easy and
 * Standard, its back for Hard and Expert. The engine keeps only each row's modifier; the screen
 * shows these texts beside it, in the language of the card data.
 */
export interface ReferenceTexts {
  easyStandard: ReferenceSideTexts;
  hardExpert: ReferenceSideTexts;
}

/** ArkhamDB's names of the symbol tokens in card text, and the engine's for each. */
const TOKEN_NAMES: Readonly<Record<string, ReferenceToken>> = {
  skull: 'skull',
  cultist: 'cultist',
  tablet: 'tablet',
  elder_thing: 'elderThing',
};

const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? undefined);

/** Raw ArkhamDB scenario card shape, checked at runtime because the API is external. */
const RawScenarioSchema = z.object({
  code: z.string(),
  type_code: z.literal('scenario'),
  text: opt(z.string()),
  back_text: opt(z.string()),
});

/**
 * The reference card texts of every scenario card in `rawCards` (ArkhamDB's cards list), by card
 * code (`ScenarioDefinition.referenceCode`). Cards of other types are left out.
 */
export function buildReferences(rawCards: unknown): Record<string, ReferenceTexts> {
  if (!Array.isArray(rawCards)) throw new Error('Expected an array of cards');
  return Object.fromEntries(
    rawCards.flatMap((card: unknown) => {
      const parsed = RawScenarioSchema.safeParse(card);
      if (!parsed.success) return [];
      const { code, text, back_text } = parsed.data;
      const texts: ReferenceTexts = {
        easyStandard: parseReferenceSide(text),
        hardExpert: parseReferenceSide(back_text),
      };
      return [[code, texts]];
    }),
  );
}

/**
 * One side's rows: each line that starts with a symbol token (`[skull]`, with or without a colon
 * after it, as ArkhamDB writes both) gives that token's text; the side's heading line ("Easy /
 * Standard") and anything else is left out.
 */
export function parseReferenceSide(text: string | undefined): ReferenceSideTexts {
  const texts: ReferenceSideTexts = {};
  for (const line of (text ?? '').split('\n').map((each) => each.trim())) {
    if (!line.startsWith('[')) continue;
    const close = line.indexOf(']');
    const token = close > 0 ? TOKEN_NAMES[line.slice(1, close)] : undefined;
    if (!token) continue;
    const rest = line.slice(close + 1);
    texts[token] = (rest.startsWith(':') ? rest.slice(1) : rest).trim();
  }
  return texts;
}
