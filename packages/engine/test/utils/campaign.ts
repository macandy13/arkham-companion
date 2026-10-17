import {
  CampaignCommandRejected,
  emptyCampaignLog,
  executeCampaign,
  type CampaignCommand,
  type CampaignInvestigator,
  type CampaignLog,
  type CampaignRejection,
  type JoiningInvestigator,
  type StartCampaign,
} from '../../src/index';

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

/** Night of the Zealot investigators as they join a campaign, with their printed health and sanity. */
export const roland: JoiningInvestigator = {
  code: '01001',
  name: 'Roland Banks',
  health: 9,
  sanity: 5,
};
export const daisy: JoiningInvestigator = {
  code: '01002',
  name: 'Daisy Walker',
  health: 5,
  sanity: 9,
};
export const wendy: JoiningInvestigator = {
  code: '01005',
  name: 'Wendy Adams',
  health: 7,
  sanity: 7,
};
export const agnes: JoiningInvestigator = {
  code: '01004',
  name: 'Agnes Baker',
  health: 6,
  sanity: 8,
};

/**
 * A `StartCampaign` with boring defaults: standard difficulty, a three-token
 * bag and two scenarios. Tests that assert on any of these pass them explicitly.
 */
export function makeStartCampaign(overrides: Partial<StartCampaign> = {}): StartCampaign {
  return {
    type: 'StartCampaign',
    campaignId: 'campaign_a',
    definitionId: 'test_campaign',
    difficulty: 'standard',
    investigators: [roland],
    chaosBag: ['0', '-1', 'skull'],
    scenarioIds: ['first_scenario', 'second_scenario'],
    ...overrides,
  };
}

/** The log after `StartCampaign` (see `makeStartCampaign`), then `commands`. */
export function startedCampaign(
  start: Partial<StartCampaign> = {},
  ...commands: CampaignCommand[]
): CampaignLog {
  return commands.reduce(
    (log, command) => executeCampaign(log, command).log,
    executeCampaign(emptyCampaignLog(), makeStartCampaign(start)).log,
  );
}

/** The structured rejection of a campaign command, failing the test if it is accepted. */
export function campaignRejectionOf(fn: () => unknown): CampaignRejection {
  try {
    fn();
  } catch (e) {
    if (e instanceof CampaignCommandRejected) return e.rejection;
    throw e;
  }
  throw new Error('expected CampaignCommandRejected');
}
