import type { CampaignInvestigator, CampaignLog } from '../../src/index';

/** A team member as the log holds them at campaign start: no trauma, no XP, alive. */
export function campaignMember(
  code: string,
  name: string,
  health: number,
  sanity: number,
): CampaignInvestigator {
  return {
    code,
    name,
    health,
    sanity,
    physicalTrauma: 0,
    mentalTrauma: 0,
    xpEarned: 0,
    xpSpent: 0,
    fate: 'alive',
  };
}

/** Night of the Zealot investigators with their printed health and sanity, as fresh team members. */
export const rolandMember = campaignMember('01001', 'Roland Banks', 9, 5);
export const daisyMember = campaignMember('01002', 'Daisy Walker', 5, 9);
export const agnesMember = campaignMember('01004', 'Agnes Baker', 6, 8);
export const wendyMember = campaignMember('01005', 'Wendy Adams', 7, 7);
export const skidsMember = campaignMember('01003', "Skids O'Toole", 8, 6);

/**
 * A started campaign log with boring defaults: standard difficulty, Roland
 * alone, a three-token bag and two scenarios, at the first one. Tests that
 * assert on any of these pass them explicitly.
 */
export function makeCampaignLog(overrides: Partial<CampaignLog> = {}): CampaignLog {
  return {
    campaignId: 'campaign_a',
    definitionId: 'test_campaign',
    difficulty: 'standard',
    investigators: [rolandMember],
    formerInvestigators: [],
    story: {},
    chaosBag: ['0', '-1', 'skull'],
    scenarioIds: ['first_scenario', 'second_scenario'],
    position: 0,
    ...overrides,
  };
}
