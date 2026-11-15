import type { CardCode } from './card_code';
import type { Keyword } from './keywords';

/** The card types of the weaknesses the app puts into play (`DrawWeakness`). */
export type WeaknessType = 'enemy' | 'treachery';

/**
 * A player weakness enemy or treachery in the catalog, with what the engine needs to run it once
 * drawn (`weaknessCardStats` in the app) and what the "Draw a weakness" picker sorts by. Asset,
 * event and skill weaknesses stay in the players' hands, which the app doesn't track, so they are
 * left out (`buildWeaknesses`).
 */
export interface WeaknessDef {
  code: CardCode;
  name: string;
  typeCode: WeaknessType;
  /** A basic weakness, which any deck may draw at random, rather than one card's own. */
  basic: boolean;
  /** The investigators whose signature weakness it is (ArkhamDB `restrictions`), if any. */
  signatureOf?: CardCode[];
  traits: string[];
  fight?: number;
  evade?: number;
  health?: number;
  healthPerInvestigator?: boolean;
  damage?: number;
  horror?: number;
  victory?: number;
  /** Parsed from the card text (`parseKeywords`): a weakness enemy's prey, hunter, spawn. */
  keywords: Keyword[];
  /** A treachery whose revelation puts it into its drawer's threat area (`entersThreatArea`). */
  entersThreatArea: boolean;
  imageSrc?: string;
}
