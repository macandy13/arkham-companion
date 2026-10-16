import type { InvestigatorDef } from '@arkham/carddata';
import { investigatorId, type StartingInvestigator } from '@arkham/engine';

/** Resources every investigator starts a scenario with (rules reference, "Setup"). */
const STARTING_RESOURCES = 5;

/**
 * The engine investigators for the chosen codes, seated in the given order. Codes missing from
 * the catalog (e.g. a saved choice from before a catalog refresh) are skipped rather than
 * failing the whole wizard.
 */
export function seatInvestigators(
  catalog: readonly InvestigatorDef[],
  codes: readonly string[],
): StartingInvestigator[] {
  const byCode = new Map(catalog.map((def) => [def.code, def]));
  return codes
    .flatMap((code) => byCode.get(code) ?? [])
    .map((def, seat) => ({
      id: investigatorId(def.code),
      code: def.code,
      name: def.name,
      seat,
      health: { max: def.health, damage: 0 },
      sanity: { max: def.sanity, horror: 0 },
      clues: 0,
      resources: STARTING_RESOURCES,
      doomOnPlayerCards: 0,
      skills: def.skills,
      status: 'active',
    }));
}
