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
    { code: 'unknownInvestigator', investigatorCode: '01001' },
    { code: 'investigatorEliminated', investigatorCode: '01001', fate: 'killed' },
    { code: 'investigatorNotEliminated', investigatorCode: '01001' },
    { code: 'invalidAmount', amount: 0 },
    { code: 'notEnoughXp', investigatorCode: '01001', available: 1, requested: 2 },
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

  it('names the numbers of a notEnoughXp rejection in its message', () => {
    const error = new CampaignCommandRejected({
      code: 'notEnoughXp',
      investigatorCode: '01001',
      available: 1,
      requested: 2,
    });
    expect(error.message).toBe('01001 has 1 XP, 2 requested');
  });
});
