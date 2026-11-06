import type { InvestigatorDef } from '@arkham/carddata';
import type {
  CampaignInvestigator,
  CampaignLog,
  InvestigatorCode,
  ReplaceInvestigator,
} from '@arkham/engine';

/** The team members the players must replace before the next scenario: killed, insane or devoured ones. */
export function eliminatedMembers(log: CampaignLog): CampaignInvestigator[] {
  return log.investigators.filter(({ fate }) => fate !== 'alive');
}

/**
 * The catalog's investigators who may still replace `code`: nobody who is or was in the campaign,
 * as an eliminated investigator may not return, and nobody already chosen for another seat.
 * A parallel version is the same investigator (`parallelOfCode`), so it is out with its original.
 */
export function replacementCandidates(
  investigators: readonly InvestigatorDef[],
  log: CampaignLog,
  chosen: readonly ReplaceInvestigator[],
  code: InvestigatorCode,
): InvestigatorDef[] {
  const byCode = new Map(investigators.map((investigator) => [investigator.code, investigator]));
  const original = (taken: string) => {
    const investigator = byCode.get(taken);
    return investigator ? originalOf(investigator) : taken;
  };
  const taken = new Set(
    [
      ...log.investigators.map((member) => member.code),
      ...log.formerInvestigators.map((member) => member.code),
      ...chosen.filter((replacement) => replacement.code !== code).map(({ by }) => by),
    ].map(original),
  );
  return investigators.filter((investigator) => !taken.has(originalOf(investigator)));
}

function originalOf(investigator: InvestigatorDef): string {
  return investigator.parallelOfCode ?? investigator.code;
}

/** The team's codes in seat order once each replacement takes the seat of the member it replaces. */
export function teamAfter(
  log: CampaignLog,
  chosen: readonly ReplaceInvestigator[],
): InvestigatorCode[] {
  return log.investigators.map(
    ({ code }) => chosen.find((replacement) => replacement.code === code)?.by ?? code,
  );
}
