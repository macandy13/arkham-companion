import type { CardCode } from './card_code';
import type { Chapter } from './packs';

/** The investigator classes (ArkhamDB faction codes), in the order the picker's class chips show them. */
export const FACTION_CODES = [
  'guardian',
  'seeker',
  'rogue',
  'mystic',
  'survivor',
  'neutral',
] as const;

/** An investigator's class, which colours their card's shield and names its icon. */
export type InvestigatorClass = (typeof FACTION_CODES)[number];

/** The class `factionCode` names, or none for a code that names no investigator class. */
export function classOf(factionCode: string | undefined): InvestigatorClass | undefined {
  return FACTION_CODES.find((code) => code === factionCode);
}

/** Investigator entry of the catalog the picker lists; see `buildInvestigatorCatalog`. */
export interface InvestigatorDef {
  code: CardCode;
  name: string;
  subname?: string;
  factionCode: string;
  health: number;
  sanity: number;
  skills: {
    willpower: number;
    intellect: number;
    combat: number;
    agility: number;
  };
  /** The traits the card prints over its text ("Agency. Detective."), absent when it prints none. */
  traits?: string;
  /**
   * The ability text on the card's notebook page, in ArkhamDB markup (`[reaction]`, `<b>…</b>`,
   * newlines between abilities), in the language of the card data.
   */
  text?: string;
  /** The flavour text under the abilities, in ArkhamDB markup. */
  flavor?: string;
  packCode: string;
  /** Cycle of the pack (`PackDef.cyclePosition`); 0 if the pack is unknown. */
  cyclePosition: number;
  imageSrc?: string;
  backImageSrc?: string;
  /** ArkhamDB `duplicate_of_code`; true reprints are removed from the catalog. */
  duplicateOfCode?: CardCode;
  /** True for parallel versions; they stay in the catalog and point to their original. */
  parallel: boolean;
  parallelOfCode?: CardCode;
  chapter: Chapter;
  /** The same investigator in the other chapter, if the catalog has one. */
  otherChapterCode?: CardCode;
}
