import { describe, expect, it } from 'vitest';
import { agnes, daisy, makeStartCampaign, roland } from '../../test/utils';
import type { CampaignCommand } from './campaign_commands';
import type { CampaignEvent } from './campaign_events';
import { checkCampaignInvariants } from './campaign_invariants';
import { emptyCampaignLog } from './campaign_log';
import { applyCampaign, replayCampaign } from './campaign_reducer';
import { executeCampaign } from './handle_campaign';

describe('campaign replay', () => {
  const commands: CampaignCommand[] = [
    makeStartCampaign({ investigators: [roland, daisy], chaosBag: ['0', 'skull'] }),
    { type: 'AwardXp', code: '01001', amount: 3 },
    { type: 'SpendXp', code: '01001', amount: 1 },
    { type: 'AddChaosToken', token: 'tablet' },
    { type: 'RecordStory', key: 'doubt', value: { kind: 'count', value: 1 } },
    { type: 'AddTrauma', code: '01002', kind: 'physical', amount: 5 },
    { type: 'ReplaceInvestigator', code: '01002', by: agnes },
    { type: 'AdvanceScenario' },
  ];

  const play = () => {
    let log = emptyCampaignLog();
    const events: CampaignEvent[] = [];
    for (const command of commands) {
      const result = executeCampaign(log, command);
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
      log = executeCampaign(log, command).log;
      expect(checkCampaignInvariants(log)).toEqual([]);
    }
  });

  it('does not mutate the log it is applied to', () => {
    const { log } = play();
    const before = structuredClone(log);
    applyCampaign(log, { type: 'ChaosTokenAdded', token: 'skull' });
    applyCampaign(log, { type: 'StoryRecordRemoved', key: 'doubt' });
    applyCampaign(log, { type: 'InvestigatorFateChanged', code: '01001', fate: 'killed' });
    expect(log).toEqual(before);
  });
});
