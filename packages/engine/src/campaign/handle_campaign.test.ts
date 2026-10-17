import { describe, expect, it } from 'vitest';
import {
  agnes,
  campaignRejectionOf,
  daisy,
  makeStartCampaign,
  roland,
  skids,
  startedCampaign,
  wendy,
} from '../../test/utils';
import type { CampaignCommand } from './campaign_commands';
import type { CampaignRejection } from './campaign_rejection';
import { emptyCampaignLog } from './campaign_log';
import { executeCampaign, handleCampaign } from './handle_campaign';

describe('StartCampaign', () => {
  it('writes the campaign log with fresh investigators, the bag and the scenario order', () => {
    const { log, events } = executeCampaign(
      emptyCampaignLog(),
      makeStartCampaign({
        campaignId: 'campaign_a',
        definitionId: 'night-of-the-zealot',
        difficulty: 'hard',
        investigators: [roland, daisy],
        chaosBag: ['0', 'skull'],
        scenarioIds: ['the-gathering', 'the-midnight-masks'],
      }),
    );

    expect(events.map((e) => e.type)).toEqual(['CampaignStarted']);
    expect(log).toEqual({
      campaignId: 'campaign_a',
      definitionId: 'night-of-the-zealot',
      difficulty: 'hard',
      investigators: [
        {
          code: roland.code,
          name: 'Roland Banks',
          health: 9,
          sanity: 5,
          physicalTrauma: 0,
          mentalTrauma: 0,
          xpEarned: 0,
          xpSpent: 0,
          fate: 'alive',
        },
        {
          code: daisy.code,
          name: 'Daisy Walker',
          health: 5,
          sanity: 9,
          physicalTrauma: 0,
          mentalTrauma: 0,
          xpEarned: 0,
          xpSpent: 0,
          fate: 'alive',
        },
      ],
      formerInvestigators: [],
      story: {},
      chaosBag: ['0', 'skull'],
      scenarioIds: ['the-gathering', 'the-midnight-masks'],
      position: 0,
    });
  });

  it('accepts a team of four', () => {
    const log = startedCampaign({ investigators: [roland, daisy, wendy, agnes] });
    expect(log.investigators.map((member) => member.code)).toEqual(
      [roland, daisy, wendy, agnes].map((joining) => joining.code),
    );
  });

  it.each<{
    name: string;
    setup: Parameters<typeof makeStartCampaign>[0];
    expected: CampaignRejection;
  }>([
    {
      name: 'no investigators',
      setup: { investigators: [] },
      expected: { code: 'invalidTeamSize', count: 0 },
    },
    {
      name: 'five investigators',
      setup: {
        investigators: [roland, daisy, wendy, agnes, skids],
      },
      expected: { code: 'invalidTeamSize', count: 5 },
    },
    {
      name: 'the same investigator twice',
      setup: { investigators: [roland, daisy, roland] },
      expected: { code: 'duplicateInvestigator', investigatorCode: roland.code },
    },
    { name: 'no scenarios', setup: { scenarioIds: [] }, expected: { code: 'noScenarios' } },
    {
      name: 'zero health',
      setup: { investigators: [{ ...roland, health: 0 }] },
      expected: {
        code: 'invalidInvestigatorStats',
        investigatorCode: roland.code,
        health: 0,
        sanity: 5,
      },
    },
    {
      name: 'fractional sanity',
      setup: { investigators: [{ ...roland, sanity: 2.5 }] },
      expected: {
        code: 'invalidInvestigatorStats',
        investigatorCode: roland.code,
        health: 9,
        sanity: 2.5,
      },
    },
  ])('rejects $name', ({ setup, expected }) => {
    expect(
      campaignRejectionOf(() => handleCampaign(emptyCampaignLog(), makeStartCampaign(setup))),
    ).toEqual(expected);
  });

  it('rejects starting a second campaign on a started log', () => {
    const started = startedCampaign({ investigators: [roland] });
    expect(campaignRejectionOf(() => handleCampaign(started, makeStartCampaign()))).toEqual({
      code: 'campaignAlreadyStarted',
    });
  });
});

describe('commands before the campaign started', () => {
  it.each<CampaignCommand>([
    { type: 'RecordStory', key: 'house_burned', value: { kind: 'flag', value: true } },
    { type: 'AddChaosToken', token: 'skull' },
    { type: 'RemoveChaosToken', token: 'skull' },
    { type: 'AwardXp', code: roland.code, amount: 1 },
    { type: 'SpendXp', code: roland.code, amount: 1 },
    { type: 'AddTrauma', code: roland.code, kind: 'physical', amount: 1 },
    { type: 'MarkKilled', code: roland.code },
    { type: 'MarkInsane', code: roland.code },
    { type: 'ReplaceInvestigator', code: roland.code, by: agnes },
    { type: 'AdvanceScenario' },
    { type: 'AdjustCampaign', adjustment: { kind: 'position', position: 0 } },
  ])('rejects $type with campaignNotStarted', (command) => {
    expect(campaignRejectionOf(() => handleCampaign(emptyCampaignLog(), command))).toEqual({
      code: 'campaignNotStarted',
    });
  });
});

describe('RecordStory', () => {
  const house = 'house_burned';

  it.each([
    { name: 'a flag', value: { kind: 'flag', value: true } },
    { name: 'a count', value: { kind: 'count', value: 2 } },
    { name: 'a list', value: { kind: 'list', entries: ['Ghoul Priest'] } },
    {
      name: 'a crossable list',
      value: { kind: 'crossableList', entries: [{ name: 'Wolf-Man Drew', crossedOut: false }] },
    },
  ] as const)('stores $name under its key', ({ value }) => {
    const log = startedCampaign({}, { type: 'RecordStory', key: house, value });
    expect(log.story).toEqual({ [house]: value });
  });

  it('overwrites an earlier value of the same kind', () => {
    const log = startedCampaign(
      {},
      { type: 'RecordStory', key: 'doubt', value: { kind: 'count', value: 1 } },
      { type: 'RecordStory', key: 'doubt', value: { kind: 'count', value: 3 } },
    );
    expect(log.story).toEqual({ doubt: { kind: 'count', value: 3 } });
  });

  it('rejects a value of another kind than the record already has', () => {
    const log = startedCampaign(
      {},
      { type: 'RecordStory', key: house, value: { kind: 'flag', value: true } },
    );
    expect(
      campaignRejectionOf(() =>
        handleCampaign(log, {
          type: 'RecordStory',
          key: house,
          value: { kind: 'count', value: 1 },
        }),
      ),
    ).toEqual({ code: 'storyKindMismatch', key: house, recorded: 'flag', given: 'count' });
  });

  it.each(['', '   ', ' doubt'])('rejects the blank or padded key %j', (key) => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(startedCampaign(), {
          type: 'RecordStory',
          key,
          value: { kind: 'flag', value: true },
        }),
      ),
    ).toEqual({ code: 'invalidStoryKey', key });
  });

  it.each([
    { name: 'a negative count', value: { kind: 'count', value: -1 } },
    { name: 'a fractional count', value: { kind: 'count', value: 1.5 } },
    { name: 'a list with a repeated name', value: { kind: 'list', entries: ['Lita', 'Lita'] } },
    { name: 'a list with a blank name', value: { kind: 'list', entries: [' '] } },
    {
      name: 'a crossable list with a repeated name',
      value: {
        kind: 'crossableList',
        entries: [
          { name: 'Drew', crossedOut: false },
          { name: 'Drew', crossedOut: true },
        ],
      },
    },
  ] as const)('rejects $name', ({ value }) => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(startedCampaign(), { type: 'RecordStory', key: house, value }),
      ),
    ).toEqual({ code: 'invalidStoryValue', key: house });
  });
});

describe('chaos bag', () => {
  it('adds a token to the bag', () => {
    const log = startedCampaign(
      { chaosBag: ['0', 'skull'] },
      { type: 'AddChaosToken', token: 'tablet' },
    );
    expect(log.chaosBag).toEqual(['0', 'skull', 'tablet']);
  });

  it('removes only one copy of a token', () => {
    const log = startedCampaign(
      { chaosBag: ['skull', '0', 'skull'] },
      { type: 'RemoveChaosToken', token: 'skull' },
    );
    expect(log.chaosBag).toEqual(['0', 'skull']);
  });

  it('rejects removing a token that is not in the bag', () => {
    const log = startedCampaign({ chaosBag: ['0', 'skull'] });
    expect(
      campaignRejectionOf(() => handleCampaign(log, { type: 'RemoveChaosToken', token: 'tablet' })),
    ).toEqual({ code: 'chaosTokenNotInBag', token: 'tablet' });
  });
});

describe('AdvanceScenario', () => {
  const advance: CampaignCommand = { type: 'AdvanceScenario' };

  it('moves through the scenarios until the campaign is complete, then rejects', () => {
    const start = { scenarioIds: ['the-gathering', 'the-midnight-masks', 'the-devourer-below'] };
    const positions = [startedCampaign(start)];
    for (let i = 0; i < 3; i++) positions.push(executeCampaign(positions[i]!, advance).log);

    expect(positions.map((log) => log.position)).toEqual([0, 1, 2, 3]);
    expect(campaignRejectionOf(() => handleCampaign(positions[3]!, advance))).toEqual({
      code: 'campaignComplete',
    });
  });
});
