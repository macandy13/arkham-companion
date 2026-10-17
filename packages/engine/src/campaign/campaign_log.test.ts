import { describe, expect, it } from 'vitest';
import { daisyMember, makeCampaignLog, rolandMember, wendyMember } from '../../test/utils';
import {
  availableXp,
  campaignInvestigator,
  currentScenarioId,
  emptyCampaignLog,
  isCampaignStarted,
  traumaFate,
  traumaOf,
  withTrauma,
  type CampaignInvestigator,
} from './campaign_log';

describe('campaign log queries', () => {
  const woundedRoland: CampaignInvestigator = {
    code: rolandMember.code,
    name: 'Roland Banks',
    health: 9,
    sanity: 5,
    physicalTrauma: 2,
    mentalTrauma: 1,
    xpEarned: 5,
    xpSpent: 2,
    fate: 'alive',
  };

  it('an empty log has not started, a started one has', () => {
    expect(isCampaignStarted(emptyCampaignLog())).toBe(false);
    expect(isCampaignStarted(makeCampaignLog())).toBe(true);
  });

  it('finds a current team member by code', () => {
    const log = makeCampaignLog({ investigators: [rolandMember, daisyMember] });
    const notOnTeam = wendyMember.code;
    expect(campaignInvestigator(log, daisyMember.code)).toBe(daisyMember);
    expect(campaignInvestigator(log, notOnTeam)).toBeUndefined();
  });

  it('available XP is earned minus spent', () => {
    expect(availableXp(woundedRoland)).toBe(3);
  });

  it('reads and raises trauma of one kind without touching the other', () => {
    expect(traumaOf(woundedRoland, 'physical')).toBe(2);
    expect(traumaOf(woundedRoland, 'mental')).toBe(1);
    expect(withTrauma(woundedRoland, 'physical', 3)).toMatchObject({
      physicalTrauma: 5,
      mentalTrauma: 1,
    });
    expect(withTrauma(woundedRoland, 'mental', 3)).toMatchObject({
      physicalTrauma: 2,
      mentalTrauma: 4,
    });
  });

  it.each([
    {
      name: 'physical trauma 8 of health 9',
      trauma: { physicalTrauma: 8 },
      kind: 'physical',
      fate: undefined,
    },
    {
      name: 'physical trauma 9 of health 9',
      trauma: { physicalTrauma: 9 },
      kind: 'physical',
      fate: 'killed',
    },
    {
      name: 'mental trauma 4 of sanity 5',
      trauma: { mentalTrauma: 4 },
      kind: 'mental',
      fate: undefined,
    },
    {
      name: 'mental trauma 5 of sanity 5',
      trauma: { mentalTrauma: 5 },
      kind: 'mental',
      fate: 'insane',
    },
  ] as const)('$name leads to $fate', ({ trauma, kind, fate }) => {
    expect(traumaFate({ ...woundedRoland, ...trauma }, kind)).toBe(fate);
  });

  it('the current scenario is the one at the position, none once complete', () => {
    const log = makeCampaignLog({ scenarioIds: ['the-gathering', 'the-midnight-masks'] });
    expect(currentScenarioId(log)).toBe('the-gathering');
    expect(currentScenarioId({ ...log, position: 2 })).toBeUndefined();
  });
});
