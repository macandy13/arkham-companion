import type { CampaignInvestigator, CampaignLog } from '../../src/index';

/** A team member as the log holds them at campaign start: no trauma, no XP, alive. */
export function campaignLine(code: string, health: number, sanity: number): CampaignInvestigator {
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

/** Night of the Zealot investigators with their printed health and sanity, as fresh log lines. */
export const rolandLine = campaignLine('01001', 9, 5);
export const daisyLine = campaignLine('01002', 5, 9);
export const agnesLine = campaignLine('01004', 6, 8);

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
    investigators: [rolandLine],
    formerInvestigators: [],
    story: {},
    chaosBag: ['0', '-1', 'skull'],
    scenarioIds: ['first_scenario', 'second_scenario'],
    position: 0,
    ...overrides,
  };
}
