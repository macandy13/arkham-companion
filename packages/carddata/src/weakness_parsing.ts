import { z } from 'zod';
import { toCardCode } from './card_code';
import { normaliseCard } from './schema';
import type { WeaknessDef, WeaknessType } from './weaknesses';

// Apart from weaknesses.ts, so the app's start-up code, which needs only the types, doesn't pull
// in zod: this parses fetched data only (`fetchCatalog`).

/** The raw ArkhamDB fields that make a card a weakness, read on top of `normaliseCard`'s. */
const RawWeaknessSchema = z.object({
  subtype_code: z.enum(['weakness', 'basicweakness']),
  type_code: z.enum(['enemy', 'treachery']),
  duplicate_of_code: z.null().optional(),
  restrictions: z.object({ investigator: z.record(z.string(), z.string()).optional() }).nullish(),
});

/**
 * The player weakness enemies and treacheries of `rawCards` (ArkhamDB's cards list), sorted by
 * code. A reprint (`duplicate_of_code`) is left out, as it plays like its original.
 */
export function buildWeaknesses(rawCards: unknown): WeaknessDef[] {
  if (!Array.isArray(rawCards)) throw new Error('Expected an array of cards');
  return rawCards
    .flatMap((raw: unknown) => {
      const weakness = RawWeaknessSchema.safeParse(raw);
      return weakness.success ? [normaliseWeakness(raw, weakness.data)] : [];
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

function normaliseWeakness(raw: unknown, weakness: z.infer<typeof RawWeaknessSchema>): WeaknessDef {
  const card = normaliseCard(raw);
  const signatureOf = Object.keys(weakness.restrictions?.investigator ?? {}).map(toCardCode);
  const typeCode: WeaknessType = weakness.type_code;
  return {
    code: card.code,
    name: card.name,
    typeCode,
    basic: weakness.subtype_code === 'basicweakness',
    ...(signatureOf.length > 0 && { signatureOf }),
    traits: card.traits,
    fight: card.fight,
    evade: card.evade,
    health: card.health,
    healthPerInvestigator: card.healthPerInvestigator,
    damage: card.damage,
    horror: card.horror,
    victory: card.victory,
    keywords: card.keywords,
    entersThreatArea: card.entersThreatArea,
    imageSrc: card.imageSrc,
  };
}
