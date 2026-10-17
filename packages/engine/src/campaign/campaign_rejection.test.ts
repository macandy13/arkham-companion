import { describe, expect, it } from 'vitest';
import { CampaignCommandRejected, type CampaignRejection } from './campaign_rejection';

describe('CampaignCommandRejected', () => {
  it.each<CampaignRejection>([
    { code: 'campaignNotStarted' },
    { code: 'campaignAlreadyStarted' },
    { code: 'invalidTeamSize', count: 5 },
    { code: 'duplicateInvestigator', investigatorCode: '01001' },
    { code: 'invalidInvestigatorStats', investigatorCode: '01001', health: 0, sanity: 5 },
    { code: 'noScenarios' },
    { code: 'invalidStoryKey', key: ' ' },
    { code: 'invalidStoryValue', key: 'doubt' },
    { code: 'storyKindMismatch', key: 'doubt', recorded: 'count', given: 'flag' },
    { code: 'chaosTokenNotInBag', token: 'tablet' },
    { code: 'campaignComplete' },
  ])('carries the structured rejection and a message for $code', (rejection) => {
    const error = new CampaignCommandRejected(rejection);
    expect(error.rejection).toEqual(rejection);
    expect(error.name).toBe('CampaignCommandRejected');
    expect(error.message).not.toBe('');
  });

  it('names the team size of an invalidTeamSize rejection in its message', () => {
    const error = new CampaignCommandRejected({ code: 'invalidTeamSize', count: 5 });
    expect(error.message).toBe('a campaign needs 1 to 4 investigators, got 5');
  });
});
