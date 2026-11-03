import type { InvestigatorDef } from '@arkham/carddata';
import type { CampaignInvestigator, CampaignLog, ReplaceInvestigator } from '@arkham/engine';

/** The team members the players must replace before the next scenario: killed or insane ones. */
export function eliminatedMembers(log: CampaignLog): CampaignInvestigator[] {
  return log.investigators.filter(({ fate }) => fate !== 'alive');
}

/**
 * The catalog's investigators who may still replace `code`: nobody who is or was in the campaign,
 * as a killed or insane investigator may not return, and nobody already chosen for another seat.
 */
export function replacementCandidates(
  investigators: readonly InvestigatorDef[],
  log: CampaignLog,
  chosen: readonly ReplaceInvestigator[],
  code: CampaignInvestigator['code'],
): InvestigatorDef[] {
  const taken = new Set<string>([
    ...log.investigators.map((member) => member.code),
    ...log.formerInvestigators.map((member) => member.code),
    ...chosen.filter((replacement) => replacement.code !== code).map(({ by }) => by),
  ]);
  return investigators.filter((investigator) => !taken.has(investigator.code));
}

/** The team's codes in seat order once each replacement takes the seat of the member it replaces. */
export function teamAfter(
  log: CampaignLog,
  chosen: readonly ReplaceInvestigator[],
): CampaignInvestigator['code'][] {
  return log.investigators.map(
    ({ code }) => chosen.find((replacement) => replacement.code === code)?.by ?? code,
  );
}
