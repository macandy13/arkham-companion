import { z } from 'zod';
import { entersThreatArea, parseKeywords, type Keyword } from './keywords';

/**
 * Normalised card definition (subset of the ArkhamDB fields the app needs), built by
 * `normaliseCard`. A plain interface rather than a zod schema: only our own code constructs it,
 * after the raw ArkhamDB input has been validated by `RawCardSchema`.
 */
export interface CardDef {
  code: string;
  name: string;
  subname?: string;
  typeCode: string;
  packCode: string;
  position: number;
  quantity: number;
  encounterCode?: string;
  encounterPosition?: number;
  factionCode?: string;
  traits: string[];
  text?: string;
  flavor?: string;
  backText?: string;
  backFlavor?: string;
  doubleSided: boolean;
  linkedToCode?: string;
  isUnique: boolean;
  stage?: number;
  // Locations
  shroud?: number;
  clues?: number;
  cluesFixed?: boolean;
  // Enemies
  fight?: number;
  evade?: number;
  health?: number;
  healthPerInvestigator?: boolean;
  damage?: number;
  horror?: number;
  victory?: number;
  doom?: number;
  /** Parsed from `text` and `traits` at load time (`parseKeywords`). */
  keywords: Keyword[];
  /** A drawn treachery with this stays in the drawer's threat area (`entersThreatArea`). */
  entersThreatArea: boolean;
  imageSrc?: string;
  backImageSrc?: string;
}

const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? undefined);

/**
 * Raw ArkhamDB card shape (only the fields we read; the rest is ignored). zod checks it at runtime
 * because ArkhamDB is an external API whose fields can be null, missing or renamed.
 */
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
  const traits = (r.traits ?? '')
    .split('.')
    .map((t) => t.trim())
    .filter(Boolean);
  return {
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
    keywords: parseKeywords(r.text, traits),
    entersThreatArea: entersThreatArea(r.text),
    imageSrc: r.imagesrc,
    backImageSrc: r.backimagesrc,
  };
}

export function normalisePack(raw: unknown): CardDef[] {
  if (!Array.isArray(raw)) throw new Error('Expected an array of cards');
  return raw.map(normaliseCard);
}
