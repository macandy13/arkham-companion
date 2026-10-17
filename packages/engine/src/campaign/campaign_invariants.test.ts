import { scenarioId } from '../ids';
import { describe, expect, it } from 'vitest';
import {
  agnesMember,
  daisyMember,
  makeCampaignLog,
  rolandMember,
  skidsMember,
  wendyMember,
} from '../../test/utils';
import { checkCampaignInvariants, storyValueIsValid } from './campaign_invariants';
import { emptyCampaignLog, type CampaignInvestigator, type CampaignLog } from './campaign_log';

describe('checkCampaignInvariants', () => {
  const started = makeCampaignLog({
    investigators: [rolandMember],
    scenarioIds: [scenarioId('the-gathering'), scenarioId('the-midnight-masks')],
  });
  const withRoland = (changes: Partial<CampaignInvestigator>): CampaignLog => ({
    ...started,
    investigators: [{ ...rolandMember, ...changes }],
  });

  it.each<{ name: string; log: CampaignLog }>([
    { name: 'the empty log before the campaign starts', log: emptyCampaignLog() },
    { name: 'a freshly started campaign', log: started },
    { name: 'a completed campaign', log: { ...started, position: 2 } },
    {
      name: 'Roland killed by physical trauma at his health',
      log: withRoland({ physicalTrauma: rolandMember.health, fate: 'killed' }),
    },
    {
      name: 'Roland who spent all his earned XP',
      log: withRoland({ xpEarned: 3, xpSpent: 3 }),
    },
    {
      name: 'Roland replaced by Agnes after being killed',
      log: {
        ...started,
        investigators: [agnesMember],
        formerInvestigators: [{ ...rolandMember, fate: 'killed' }],
      },
    },
    {
      name: 'Agnes, alive, whose player left the campaign',
      log: { ...started, formerInvestigators: [agnesMember] },
    },
  ])('finds no violation in $name', ({ log }) => {
    expect(checkCampaignInvariants(log)).toEqual([]);
  });

  it.each<{ name: string; log: CampaignLog; violation: string }>([
    {
      name: 'a started campaign without investigators',
      log: { ...started, investigators: [] },
      violation: 'team has 0 investigators',
    },
    {
      name: 'a team of five',
      log: {
        ...started,
        investigators: [rolandMember, daisyMember, agnesMember, wendyMember, skidsMember],
      },
      violation: 'team has 5 investigators',
    },
    {
      name: 'the same investigator twice',
      log: { ...started, investigators: [rolandMember, rolandMember] },
      violation: `investigator ${rolandMember.code} appears more than once`,
    },
    {
      name: 'a current investigator who is also a former one',
      log: { ...started, formerInvestigators: [{ ...rolandMember, fate: 'killed' }] },
      violation: `investigator ${rolandMember.code} appears more than once`,
    },
    {
      name: 'negative physical trauma',
      log: withRoland({ physicalTrauma: -1 }),
      violation: `investigator ${rolandMember.code} has -1 physical trauma`,
    },
    {
      name: 'fractional mental trauma',
      log: withRoland({ mentalTrauma: 0.5 }),
      violation: `investigator ${rolandMember.code} has 0.5 mental trauma`,
    },
    {
      name: 'more spent than earned XP',
      log: withRoland({ xpEarned: 1, xpSpent: 2 }),
      violation: `investigator ${rolandMember.code} spent 2 of 1 XP`,
    },
    {
      name: 'zero health',
      log: withRoland({ health: 0 }),
      violation: `investigator ${rolandMember.code} has health 0 and sanity ${rolandMember.sanity}`,
    },
    {
      name: 'a living investigator with mental trauma at his sanity',
      log: withRoland({ mentalTrauma: rolandMember.sanity }),
      violation: `investigator ${rolandMember.code} is alive with trauma at the limit`,
    },
    {
      name: 'a malformed story record',
      log: { ...started, story: { doubt: { kind: 'count', value: -1 } } },
      violation: 'story record doubt is malformed',
    },
    {
      name: 'a position past the scenario list',
      log: { ...started, position: 3 },
      violation: 'scenario position 3 is outside 0..2',
    },
    {
      name: 'a negative position',
      log: { ...started, position: -1 },
      violation: 'scenario position -1 is outside 0..2',
    },
  ])('reports $name', ({ log, violation }) => {
    expect(checkCampaignInvariants(log)).toContain(violation);
  });
});

describe('storyValueIsValid', () => {
  it.each([
    { name: 'a flag', value: { kind: 'flag', value: false }, valid: true },
    { name: 'a zero count', value: { kind: 'count', value: 0 }, valid: true },
    { name: 'a negative count', value: { kind: 'count', value: -1 }, valid: false },
    { name: 'an empty list', value: { kind: 'list', entries: [] }, valid: true },
    { name: 'a list of distinct names', value: { kind: 'list', entries: ['a', 'b'] }, valid: true },
    {
      name: 'a list with a repeated name',
      value: { kind: 'list', entries: ['a', 'a'] },
      valid: false,
    },
    {
      name: 'a crossable list with a blank name',
      value: { kind: 'crossableList', entries: [{ name: '', crossedOut: true }] },
      valid: false,
    },
    {
      name: 'a crossable list of distinct names',
      value: { kind: 'crossableList', entries: [{ name: 'Drew', crossedOut: true }] },
      valid: true,
    },
  ] as const)('judges $name', ({ value, valid }) => {
    expect(storyValueIsValid(value)).toBe(valid);
  });
});
