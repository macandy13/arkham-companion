import { isPositiveInteger } from '@arkham/util';
import type { JoiningInvestigator } from './campaign_commands';
import type { CampaignInvestigator } from './campaign_log';
import { CampaignCommandRejected } from './campaign_rejection';

/**
 * The log line of an investigator joining the campaign (at the start or as
 * a replacement): no trauma, no XP, alive. Rejects printed stats that are
 * not positive integers.
 */
export function newCampaignInvestigator(joining: JoiningInvestigator): CampaignInvestigator {
  const { code, health, sanity } = joining;
  if (!isPositiveInteger(health) || !isPositiveInteger(sanity))
    throw new CampaignCommandRejected({
      code: 'invalidInvestigatorStats',
      investigatorCode: code,
      health,
      sanity,
    });
  return {
    code,
    health,
    sanity,
    physicalTrauma: 0,
    mentalTrauma: 0,
    xpEarned: 0,
    xpSpent: 0,
    fate: 'alive',
  };
}
