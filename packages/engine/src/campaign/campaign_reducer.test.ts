import { describe, expect, it } from 'vitest';
import {
  agnes,
  agnesMember,
  campaignContext,
  daisy,
  daisyMember,
  makeCampaignLog,
  makeStartCampaign,
  roland,
  rolandMember,
} from '../../test/utils';
import type { CampaignCommand } from './campaign_commands';
import type { CampaignEvent } from './campaign_events';
import { checkCampaignInvariants } from './campaign_invariants';
import { emptyCampaignLog } from './campaign_log';
import { applyCampaign, replayCampaign } from './campaign_reducer';
import { executeCampaign } from './handle_campaign';

describe('applyCampaign', () => {
  it('starts a campaign by replacing the whole log', () => {
    const log = applyCampaign(makeCampaignLog({ position: 1 }), {
      type: 'CampaignStarted',
      campaignId: 'campaign_b',
      definitionId: 'night_of_the_zealot',
      difficulty: 'hard',
      investigators: [daisyMember],
      chaosBag: ['skull'],
      scenarioIds: ['the_gathering'],
    });

    expect(log).toEqual({
      ...emptyCampaignLog(),
      campaignId: 'campaign_b',
      definitionId: 'night_of_the_zealot',
      difficulty: 'hard',
      investigators: [daisyMember],
      chaosBag: ['skull'],
      scenarioIds: ['the_gathering'],
    });
  });

  it('writes a story record, then overwrites it, then removes it', () => {
    const doubt = (value: number): CampaignEvent => ({
      type: 'StoryRecorded',
      key: 'doubt',
      value: { kind: 'count', value },
    });

    const recorded = replayCampaign([doubt(1), doubt(2)], makeCampaignLog());
    expect(recorded.story).toEqual({ doubt: { kind: 'count', value: 2 } });

    const removed = applyCampaign(recorded, { type: 'StoryRecordRemoved', key: 'doubt' });
    expect(removed.story).toEqual({});
  });

  it('adds a token to the bag and removes one copy of it', () => {
    const log = makeCampaignLog({ chaosBag: ['-1', 'skull'] });

    const added = applyCampaign(log, { type: 'ChaosTokenAdded', token: '-1' });
    expect(added.chaosBag).toEqual(['-1', 'skull', '-1']);

    const removed = applyCampaign(added, { type: 'ChaosTokenRemoved', token: '-1' });
    expect(removed.chaosBag).toEqual(['skull', '-1']);
  });

  it.each([
    { account: 'earned', delta: 3, changed: { xpEarned: 3, xpSpent: 0 } },
    { account: 'spent', delta: 2, changed: { xpEarned: 0, xpSpent: 2 } },
  ] as const)('changes the $account XP of one investigator', ({ account, delta, changed }) => {
    const log = makeCampaignLog({ investigators: [rolandMember, daisyMember] });

    const after = applyCampaign(log, {
      type: 'XpChanged',
      code: rolandMember.code,
      account,
      delta,
    });

    expect(after.investigators).toEqual([{ ...rolandMember, ...changed }, daisyMember]);
  });

  it('changes the trauma of one kind', () => {
    const log = makeCampaignLog({ investigators: [rolandMember] });

    const after = applyCampaign(log, {
      type: 'TraumaChanged',
      code: rolandMember.code,
      kind: 'mental',
      delta: 2,
    });

    expect(after.investigators).toEqual([{ ...rolandMember, mentalTrauma: 2 }]);
  });

  it('changes the fate of one investigator', () => {
    const log = makeCampaignLog({ investigators: [rolandMember] });

    const after = applyCampaign(log, {
      type: 'InvestigatorFateChanged',
      code: rolandMember.code,
      fate: 'insane',
    });

    expect(after.investigators).toEqual([{ ...rolandMember, fate: 'insane' }]);
  });

  it('puts the newcomer in the seat of the replaced investigator, who becomes a former one', () => {
    const killedRoland = { ...rolandMember, fate: 'killed' } as const;
    const log = makeCampaignLog({ investigators: [killedRoland, daisyMember] });

    const after = applyCampaign(log, {
      type: 'InvestigatorReplaced',
      code: rolandMember.code,
      by: agnesMember,
    });

    expect(after.investigators).toEqual([agnesMember, daisyMember]);
    expect(after.formerInvestigators).toEqual([killedRoland]);
  });

  it('moves the scenario position', () => {
    const after = applyCampaign(makeCampaignLog(), {
      type: 'ScenarioPositionChanged',
      position: 1,
    });

    expect(after.position).toBe(1);
  });

  it('does not mutate the log it is applied to', () => {
    const log = makeCampaignLog({ story: { doubt: { kind: 'count', value: 1 } } });
    const before = structuredClone(log);

    applyCampaign(log, { type: 'ChaosTokenAdded', token: 'skull' });
    applyCampaign(log, { type: 'StoryRecordRemoved', key: 'doubt' });
    applyCampaign(log, {
      type: 'InvestigatorFateChanged',
      code: rolandMember.code,
      fate: 'killed',
    });

    expect(log).toEqual(before);
  });
});

describe('replayCampaign', () => {
  it('applies the events in order, starting from the empty log', () => {
    const events: CampaignEvent[] = [
      {
        type: 'CampaignStarted',
        campaignId: 'campaign_a',
        definitionId: 'test_campaign',
        difficulty: 'standard',
        investigators: [rolandMember],
        chaosBag: ['0'],
        scenarioIds: ['first_scenario', 'second_scenario'],
      },
      { type: 'XpChanged', code: rolandMember.code, account: 'earned', delta: 2 },
      { type: 'ScenarioPositionChanged', position: 1 },
    ];

    expect(replayCampaign(events)).toEqual({
      ...emptyCampaignLog(),
      campaignId: 'campaign_a',
      definitionId: 'test_campaign',
      difficulty: 'standard',
      investigators: [{ ...rolandMember, xpEarned: 2 }],
      chaosBag: ['0'],
      scenarioIds: ['first_scenario', 'second_scenario'],
      position: 1,
    });
  });
});

describe('campaign replay of commands', () => {
  const commands: CampaignCommand[] = [
    makeStartCampaign({ investigators: [roland.code, daisy.code], chaosBag: ['0', 'skull'] }),
    { type: 'AwardXp', code: roland.code, amount: 3 },
    { type: 'SpendXp', code: roland.code, amount: 1 },
    { type: 'AddChaosToken', token: 'tablet' },
    { type: 'RecordStory', key: 'doubt', value: { kind: 'count', value: 1 } },
    { type: 'AddTrauma', code: daisy.code, kind: 'physical', amount: 5 },
    { type: 'ReplaceInvestigator', code: daisy.code, by: agnes.code },
    { type: 'AdvanceScenario' },
  ];

  const play = () => {
    let log = emptyCampaignLog();
    const events: CampaignEvent[] = [];
    for (const command of commands) {
      const result = executeCampaign(campaignContext, log, command);
      log = result.log;
      events.push(...result.events);
    }
    return { log, events };
  };

  it('is deterministic: the same commands yield equal events and logs', () => {
    expect(play()).toEqual(play());
  });

  it('replaying the stored events from the empty log reproduces the log', () => {
    const { log, events } = play();
    expect(replayCampaign(events)).toEqual(log);
  });

  it('keeps the log consistent after every command', () => {
    let log = emptyCampaignLog();
    for (const command of commands) {
      log = executeCampaign(campaignContext, log, command).log;
      expect(checkCampaignInvariants(log)).toEqual([]);
    }
  });
});
