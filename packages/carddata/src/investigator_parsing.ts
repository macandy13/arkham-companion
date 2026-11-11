import { z } from 'zod';
import type { InvestigatorDef } from './investigators';
import { chapterOfPack, type Chapter, type PackDef } from './packs';
import { CardCodeSchema, opt } from './raw_schema';

// Apart from investigators.ts, so the app's start-up code, which needs only the investigator types
// and `classOf`, doesn't pull in zod: these parse fetched data only (`fetchCatalog`).

/** Raw ArkhamDB investigator shape, checked at runtime because the API is external. */
const RawInvestigatorSchema = z.object({
  code: CardCodeSchema,
  name: z.string(),
  subname: opt(z.string()),
  faction_code: z.string(),
  health: z.number().int(),
  sanity: z.number().int(),
  skill_willpower: z.number().int(),
  skill_intellect: z.number().int(),
  skill_combat: z.number().int(),
  skill_agility: z.number().int(),
  traits: opt(z.string()),
  text: opt(z.string()),
  flavor: opt(z.string()),
  pack_code: z.string(),
  imagesrc: opt(z.string()),
  backimagesrc: opt(z.string()),
  duplicate_of_code: opt(CardCodeSchema),
  alternate_of_code: opt(CardCodeSchema),
});

/** Keep only investigator entries of a full `/api/public/cards/` response. */
export function filterInvestigators(rawCards: unknown): unknown[] {
  if (!Array.isArray(rawCards)) throw new Error('Expected an array of cards');
  return rawCards.filter(
    (card: unknown) =>
      typeof card === 'object' &&
      card !== null &&
      'type_code' in card &&
      card.type_code === 'investigator',
  );
}

/**
 * Convert one raw investigator card. Chapter and cycle come from the pack list; a pack it
 * leaves out falls back to the chapter its code implies.
 */
export function normaliseInvestigator(
  raw: unknown,
  packs: readonly PackDef[] = [],
): InvestigatorDef {
  const r = RawInvestigatorSchema.parse(raw);
  const pack = packs.find((p) => p.code === r.pack_code);
  return {
    code: r.code,
    name: r.name,
    subname: r.subname,
    factionCode: r.faction_code,
    health: r.health,
    sanity: r.sanity,
    skills: {
      willpower: r.skill_willpower,
      intellect: r.skill_intellect,
      combat: r.skill_combat,
      agility: r.skill_agility,
    },
    traits: r.traits,
    text: r.text,
    flavor: r.flavor,
    packCode: r.pack_code,
    cyclePosition: pack?.cyclePosition ?? 0,
    imageSrc: r.imagesrc,
    backImageSrc: r.backimagesrc,
    duplicateOfCode: r.duplicate_of_code,
    parallel: r.alternate_of_code !== undefined,
    parallelOfCode: r.alternate_of_code,
    chapter: pack?.chapter ?? chapterOfPack(r.pack_code),
  };
}

/** Identity of "the same investigator" across chapters: names are the only link ArkhamDB gives. */
function personKey(inv: InvestigatorDef): string {
  return `${inv.name}|${inv.subname ?? ''}|${inv.parallel}`.toLowerCase();
}

/**
 * A reprint is only redundant if its original is in the same chapter. A Chapter Two card that
 * points at a Chapter One original is the revised version and must stay listed.
 */
function isTrueReprint(
  inv: InvestigatorDef,
  byCode: ReadonlyMap<string, InvestigatorDef>,
): boolean {
  if (inv.duplicateOfCode === undefined) return false;
  return byCode.get(inv.duplicateOfCode)?.chapter === inv.chapter;
}

/** Fill `otherChapterCode` on entries whose investigator exists in both chapters. */
function linkChapters(investigators: readonly InvestigatorDef[]): InvestigatorDef[] {
  const byPerson = new Map<string, Map<Chapter, InvestigatorDef>>();
  for (const inv of investigators) {
    const chapters = byPerson.get(personKey(inv)) ?? new Map<Chapter, InvestigatorDef>();
    if (!chapters.has(inv.chapter)) chapters.set(inv.chapter, inv);
    byPerson.set(personKey(inv), chapters);
  }
  return investigators.map((inv) => {
    const other = byPerson.get(personKey(inv))?.get(inv.chapter === 1 ? 2 : 1);
    return other ? { ...inv, otherChapterCode: other.code } : inv;
  });
}

/**
 * Build the picker catalog from raw ArkhamDB cards: keep investigators, drop true reprints
 * (same card, same chapter), keep Chapter One and Chapter Two versions as separate linked
 * entries, and keep parallel versions as their own entries pointing at the original. Sorted by
 * cycle, chapter, pack, then code so the order is stable.
 */
export function buildInvestigatorCatalog(
  rawCards: unknown,
  packs: readonly PackDef[],
): InvestigatorDef[] {
  const all = filterInvestigators(rawCards).map((raw) => normaliseInvestigator(raw, packs));
  const byCode = new Map(all.map((inv) => [inv.code, inv]));
  const unique = all.filter((inv) => !isTrueReprint(inv, byCode));
  return linkChapters(unique).sort(
    (a, b) =>
      a.cyclePosition - b.cyclePosition ||
      a.chapter - b.chapter ||
      a.packCode.localeCompare(b.packCode) ||
      a.code.localeCompare(b.code),
  );
}
