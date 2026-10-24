import type { InvestigatorDef } from '@arkham/carddata';
import {
  cardImagePath,
  investigatorCode,
  investigatorId,
  type InvestigatorCard,
  type InvestigatorSeat,
} from '@arkham/engine';

/**
 * The investigator cards for the chosen codes, in seat order. Codes missing from the catalog
 * (e.g. a saved choice from before a catalog refresh) are skipped rather than failing the
 * whole wizard.
 */
export function chosenInvestigators(
  catalog: readonly InvestigatorDef[],
  codes: readonly string[],
): InvestigatorCard[] {
  const byCode = new Map(catalog.map((def) => [def.code, def]));
  return codes
    .flatMap((code) => byCode.get(code) ?? [])
    .map((def) => ({
      code: investigatorCode(def.code),
      name: def.name,
      health: def.health,
      sanity: def.sanity,
      skills: def.skills,
      ...(def.imageSrc === undefined ? {} : { imageSrc: cardImagePath(def.imageSrc) }),
    }));
}

/**
 * One seat per card, in the same order. A game has one copy of each investigator, so the code
 * is unique enough to be the seat's ID too.
 */
export function seatsFor(cards: readonly InvestigatorCard[]): InvestigatorSeat[] {
  return cards.map(({ code }) => ({ id: investigatorId(code), code }));
}
