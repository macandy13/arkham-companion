import {
  CampaignCommandRejected,
  executeCampaign,
  emptyCampaignLog,
  type CampaignCommand,
  type CampaignLog,
  type CampaignRejection,
  type JoiningInvestigator,
  type StartCampaign,
} from '../../src/index';

/** Night of the Zealot investigators with their printed health and sanity. */
export const roland: JoiningInvestigator = { code: '01001', health: 9, sanity: 5 };
export const daisy: JoiningInvestigator = { code: '01002', health: 5, sanity: 9 };
export const wendy: JoiningInvestigator = { code: '01005', health: 7, sanity: 7 };
export const agnes: JoiningInvestigator = { code: '01004', health: 6, sanity: 8 };

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
