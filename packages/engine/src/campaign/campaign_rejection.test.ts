import { describe, expect, it } from 'vitest';
import { roland } from '../../test/utils';
import { CampaignCommandRejected, type CampaignRejection } from './campaign_rejection';

describe('CampaignCommandRejected', () => {
  it.each<CampaignRejection>([
    { code: 'campaignNotStarted' },
    { code: 'campaignAlreadyStarted' },
    { code: 'invalidTeamSize', count: 5 },
    { code: 'duplicateInvestigator', investigatorCode: roland.code },
    { code: 'invalidInvestigatorStats', investigatorCode: roland.code, health: 0, sanity: 5 },
    { code: 'noScenarios' },
    { code: 'unknownInvestigator', investigatorCode: roland.code },
    { code: 'investigatorEliminated', investigatorCode: roland.code, fate: 'killed' },
    { code: 'investigatorNotEliminated', investigatorCode: roland.code },
    { code: 'invalidAmount', amount: 0 },
    { code: 'notEnoughXp', investigatorCode: roland.code, available: 1, requested: 2 },
    { code: 'invalidStoryKey', key: ' ' },
    { code: 'invalidStoryValue', key: 'doubt' },
    { code: 'storyKindMismatch', key: 'doubt', recorded: 'count', given: 'flag' },
    { code: 'chaosTokenNotInBag', token: 'tablet' },
    { code: 'campaignComplete' },
    { code: 'invalidDelta', delta: 0 },
    { code: 'fateUnchanged', investigatorCode: roland.code, fate: 'alive' },
    { code: 'unknownStoryRecord', key: 'doubt' },
    { code: 'invalidPosition', position: 4, max: 3 },
    { code: 'inconsistentAdjustment', violations: ['first', 'second'] },
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

  it('names the numbers of a notEnoughXp rejection in its message', () => {
    const error = new CampaignCommandRejected({
      code: 'notEnoughXp',
      investigatorCode: roland.code,
      available: 1,
      requested: 2,
    });
    expect(error.message).toBe('01001 has 1 XP, 2 requested');
  });
});
