import { splitTrimmed } from '@arkham/util';
import { z } from 'zod';

/** Normalised card definition (subset of the ArkhamDB fields the app needs). */
export const CardDefSchema = z.object({
  code: z.string(),
  name: z.string(),
  subname: z.string().optional(),
  typeCode: z.string(),
  packCode: z.string(),
  position: z.number().int(),
  quantity: z.number().int().nonnegative(),
  encounterCode: z.string().optional(),
  encounterPosition: z.number().int().optional(),
  factionCode: z.string().optional(),
  traits: z.array(z.string()),
  text: z.string().optional(),
  flavor: z.string().optional(),
  backText: z.string().optional(),
  backFlavor: z.string().optional(),
  doubleSided: z.boolean(),
  linkedToCode: z.string().optional(),
  isUnique: z.boolean(),
  stage: z.number().int().optional(),
  // Locations
  shroud: z.number().int().optional(),
  clues: z.number().int().optional(),
  cluesFixed: z.boolean().optional(),
  // Enemies
  fight: z.number().int().optional(),
  evade: z.number().int().optional(),
  health: z.number().int().optional(),
  healthPerInvestigator: z.boolean().optional(),
  damage: z.number().int().optional(),
  horror: z.number().int().optional(),
  victory: z.number().int().optional(),
  doom: z.number().int().optional(),
  imageSrc: z.string().optional(),
  backImageSrc: z.string().optional(),
});
export type CardDef = z.infer<typeof CardDefSchema>;

export const CardPackSchema = z.array(CardDefSchema);

const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? undefined);

/** Raw ArkhamDB card shape (only the fields we read; the rest is ignored). */
const RawCardSchema = z.object({
  code: z.string(),
  name: z.string(),
  subname: opt(z.string()),
  type_code: z.string(),
  pack_code: z.string(),
  position: z.number().int(),
  quantity: z.number().int().default(1),
  encounter_code: opt(z.string()),
  encounter_position: opt(z.number().int()),
  faction_code: opt(z.string()),
  traits: opt(z.string()),
  text: opt(z.string()),
  flavor: opt(z.string()),
  back_text: opt(z.string()),
  back_flavor: opt(z.string()),
  double_sided: opt(z.boolean()),
  linked_to_code: opt(z.string()),
  is_unique: opt(z.boolean()),
  stage: opt(z.number().int()),
  shroud: opt(z.number().int()),
  clues: opt(z.number().int()),
  clues_fixed: opt(z.boolean()),
  enemy_fight: opt(z.number().int()),
  enemy_evade: opt(z.number().int()),
  health: opt(z.number().int()),
  health_per_investigator: opt(z.boolean()),
  enemy_damage: opt(z.number().int()),
  enemy_horror: opt(z.number().int()),
  victory: opt(z.number().int()),
  doom: opt(z.number().int()),
  imagesrc: opt(z.string()),
  backimagesrc: opt(z.string()),
});

/** Convert one raw ArkhamDB card into a `CardDef`. Throws a ZodError on malformed input. */
export function normaliseCard(raw: unknown): CardDef {
  const r = RawCardSchema.parse(raw);
  const traits = splitTrimmed(r.traits ?? '', '.');
  return CardDefSchema.parse({
    code: r.code,
    name: r.name,
    subname: r.subname,
    typeCode: r.type_code,
    packCode: r.pack_code,
    position: r.position,
    quantity: r.quantity,
    encounterCode: r.encounter_code,
    encounterPosition: r.encounter_position,
    factionCode: r.faction_code,
    traits,
    text: r.text,
    flavor: r.flavor,
    backText: r.back_text,
    backFlavor: r.back_flavor,
    doubleSided: r.double_sided ?? false,
    linkedToCode: r.linked_to_code,
    isUnique: r.is_unique ?? false,
    stage: r.stage,
    shroud: r.shroud,
    clues: r.clues,
    cluesFixed: r.clues_fixed,
    fight: r.enemy_fight,
    evade: r.enemy_evade,
    health: r.health,
    healthPerInvestigator: r.health_per_investigator,
    damage: r.enemy_damage,
    horror: r.enemy_horror,
    victory: r.victory,
    doom: r.doom,
    imageSrc: r.imagesrc,
    backImageSrc: r.backimagesrc,
  });
}

export function normalisePack(raw: unknown): CardDef[] {
  if (!Array.isArray(raw)) throw new Error('Expected an array of cards');
  return raw.map(normaliseCard);
}
