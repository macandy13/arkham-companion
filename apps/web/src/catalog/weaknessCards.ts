import type { CardCatalog, WeaknessDef } from '@arkham/carddata';
import {
  cardImagePath,
  fixed,
  perInvestigator,
  putIntoThreatArea,
  trait,
  whenRevealed,
  type CardStats,
  type ScaledValue,
} from '@arkham/engine';

/**
 * The `CardStats` that let the engine run the catalog's weakness `def` once an investigator draws
 * it (`DrawWeakness`): its enemy stats and keywords, and for a treachery whose revelation puts it
 * into the drawer's threat area, that revelation. Every other revelation is left to the players,
 * as for an encounter card the app has no abilities for.
 */
export function weaknessCardStats(def: WeaknessDef): CardStats {
  return {
    code: def.code,
    name: def.name,
    typeCode: def.typeCode,
    traits: def.traits.map(trait),
    fight: def.fight,
    evade: def.evade,
    health: def.health === undefined ? undefined : scaled(def.health, def.healthPerInvestigator),
    damage: def.damage,
    horror: def.horror,
    victory: def.victory,
    ...(def.keywords.length > 0 && { keywords: def.keywords }),
    ...(def.entersThreatArea && { abilities: [whenRevealed(putIntoThreatArea())] }),
    ...(def.imageSrc === undefined ? {} : { imageSrc: cardImagePath(def.imageSrc) }),
  };
}

/** The weaknesses of `catalog` as card data a game adds to its scenario's (`weaknessCardStats`). */
export function catalogWeaknessCards(catalog: CardCatalog): CardStats[] {
  return (catalog.weaknesses ?? []).map(weaknessCardStats);
}

/** ArkhamDB's value and per-investigator flag as a `ScaledValue` (see its doc comment). */
function scaled(value: number, perInvestigatorFlag = false): ScaledValue {
  return perInvestigatorFlag ? perInvestigator(value) : fixed(value);
}
