import {
  campaignDefinitionId,
  scenarioId,
  CampaignCommandRejected,
  cardDbFrom,
  emptyCampaignLog,
  executeCampaign,
  investigatorCardStats,
  investigatorCode,
  type CampaignCommand,
  type CampaignContext,
  type CampaignInvestigator,
  type CampaignLog,
  type CampaignRejection,
  type InvestigatorCard,
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
    code: investigatorCode(code),
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
    definitionId: campaignDefinitionId('test_campaign'),
    difficulty: 'standard',
    investigators: [rolandMember],
    formerInvestigators: [],
    story: {},
    chaosBag: ['0', '-1', 'skull'],
    scenarioIds: [scenarioId('first_scenario'), scenarioId('second_scenario')],
    position: 0,
    ...overrides,
  };
}

/**
 * Core Set investigator cards with their printed health, sanity and skills
 * (hand-entered, no card data), as the campaign handlers look them up.
 */
export const roland: InvestigatorCard = {
  code: investigatorCode('01001'),
  name: 'Roland Banks',
  health: 9,
  sanity: 5,
  skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
};
export const daisy: InvestigatorCard = {
  code: investigatorCode('01002'),
  name: 'Daisy Walker',
  health: 5,
  sanity: 9,
  skills: { willpower: 3, intellect: 5, combat: 2, agility: 2 },
};
export const wendy: InvestigatorCard = {
  code: investigatorCode('01005'),
  name: 'Wendy Adams',
  health: 7,
  sanity: 7,
  skills: { willpower: 4, intellect: 3, combat: 1, agility: 4 },
};
export const agnes: InvestigatorCard = {
  code: investigatorCode('01004'),
  name: 'Agnes Baker',
  health: 6,
  sanity: 8,
  skills: { willpower: 5, intellect: 2, combat: 2, agility: 3 },
};
export const skids: InvestigatorCard = {
  code: investigatorCode('01003'),
  name: "Skids O'Toole",
  health: 8,
  sanity: 6,
  skills: { willpower: 2, intellect: 3, combat: 3, agility: 4 },
};

/** A campaign context that knows exactly Roland, Daisy, Wendy, Agnes and Skids. */
export const campaignContext: CampaignContext = {
  cards: cardDbFrom([roland, daisy, wendy, agnes, skids].map(investigatorCardStats)),
};

/**
 * A `StartCampaign` with boring defaults: standard difficulty, Roland alone, a three-token
 * bag and two scenarios. Tests that assert on any of these pass them explicitly.
 */
export function makeStartCampaign(overrides: Partial<StartCampaign> = {}): StartCampaign {
  return {
    type: 'StartCampaign',
    campaignId: 'campaign_a',
    definitionId: campaignDefinitionId('test_campaign'),
    difficulty: 'standard',
    investigators: [roland.code],
    chaosBag: ['0', '-1', 'skull'],
    scenarioIds: [scenarioId('first_scenario'), scenarioId('second_scenario')],
    ...overrides,
  };
}

/** The log after `StartCampaign` (see `makeStartCampaign`), then `commands`. */
export function startedCampaign(
  start: Partial<StartCampaign> = {},
  ...commands: CampaignCommand[]
): CampaignLog {
  return commands.reduce(
    (log, command) => executeCampaign(campaignContext, log, command).log,
    executeCampaign(campaignContext, emptyCampaignLog(), makeStartCampaign(start)).log,
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
