import { describe, expect, it } from 'vitest';
import {
  agnes,
  campaignContext,
  campaignRejectionOf,
  daisy,
  makeStartCampaign,
  roland,
  skids,
  startedCampaign,
  wendy,
} from '../../test/utils';
import {
  campaignId,
  campaignDefinitionId,
  scenarioId,
  investigatorCode,
  resolutionId,
} from '../ids';
import { cardDbFrom } from '../cards';
import { investigatorCardStats } from '../investigator_cards';
import type { CampaignCommand } from './campaign_commands';
import type { CampaignRejection } from './campaign_rejection';
import { createEmptyLog } from './campaign_log';
import { executeCommand, handleCommand } from './handle_campaign';

describe('StartCampaign', () => {
  it('writes the campaign log with fresh investigators, the bag and the scenario order', () => {
    const { log, events } = executeCommand(
      campaignContext,
      createEmptyLog(),
      makeStartCampaign({
        campaignId: campaignId('campaign_a'),
        definitionId: campaignDefinitionId('night-of-the-zealot'),
        difficulty: 'hard',
        investigators: [roland.code, daisy.code],
        chaosBag: ['0', 'skull'],
        scenarioIds: [scenarioId('the-gathering'), scenarioId('the-midnight-masks')],
      }),
    );

    expect(events.map((e) => e.type)).toEqual(['CampaignStarted']);
    expect(log).toEqual({
      campaignId: campaignId('campaign_a'),
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
          earnedCards: [],
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
          earnedCards: [],
        },
      ],
      formerInvestigators: [],
      story: {},
      chaosBag: ['0', 'skull'],
      playedScenarios: [],
      scenarioIds: ['the-gathering', 'the-midnight-masks'],
      position: 0,
    });
  });

  it('accepts a team of four', () => {
    const log = startedCampaign({
      investigators: [roland.code, daisy.code, wendy.code, agnes.code],
    });
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
        investigators: [roland.code, daisy.code, wendy.code, agnes.code, skids.code],
      },
      expected: { code: 'invalidTeamSize', count: 5 },
    },
    {
      name: 'the same investigator twice',
      setup: { investigators: [roland.code, daisy.code, roland.code] },
      expected: { code: 'duplicateInvestigator', investigatorCode: roland.code },
    },
    { name: 'no scenarios', setup: { scenarioIds: [] }, expected: { code: 'noScenarios' } },
  ])('rejects $name', ({ setup, expected }) => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, createEmptyLog(), makeStartCampaign(setup)),
      ),
    ).toEqual(expected);
  });

  it.each([
    { name: 'zero health', health: 0, sanity: 5 },
    { name: 'fractional sanity', health: 9, sanity: 2.5 },
  ])('rejects an investigator card with $name', ({ health, sanity }) => {
    const contextWithBrokenRoland = {
      cards: cardDbFrom([investigatorCardStats({ ...roland, health, sanity })]),
    };
    expect(
      campaignRejectionOf(() =>
        handleCommand(
          contextWithBrokenRoland,
          createEmptyLog(),
          makeStartCampaign({ investigators: [roland.code] }),
        ),
      ),
    ).toEqual({ code: 'invalidInvestigatorStats', investigatorCode: roland.code, health, sanity });
  });

  it('rejects an investigator whose card is not in the context', () => {
    const notACard = investigatorCode('not_a_card');
    expect(
      campaignRejectionOf(() =>
        handleCommand(
          campaignContext,
          createEmptyLog(),
          makeStartCampaign({ investigators: [notACard] }),
        ),
      ),
    ).toEqual({ code: 'unknownInvestigatorCard', investigatorCode: notACard });
  });

  it('rejects starting a second campaign on a started log', () => {
    const started = startedCampaign({ investigators: [roland.code] });
    expect(
      campaignRejectionOf(() => handleCommand(campaignContext, started, makeStartCampaign())),
    ).toEqual({
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
    { type: 'ReplaceInvestigator', code: roland.code, by: agnes.code },
    { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } },
    { type: 'AdjustCampaign', adjustment: { kind: 'position', position: 0 } },
  ])('rejects $type with campaignNotStarted', (command) => {
    expect(
      campaignRejectionOf(() => handleCommand(campaignContext, createEmptyLog(), command)),
    ).toEqual({
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
        handleCommand(campaignContext, log, {
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
        handleCommand(campaignContext, startedCampaign(), {
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
        handleCommand(campaignContext, startedCampaign(), {
          type: 'RecordStory',
          key: house,
          value,
        }),
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
      campaignRejectionOf(() =>
        handleCommand(campaignContext, log, { type: 'RemoveChaosToken', token: 'tablet' }),
      ),
    ).toEqual({ code: 'chaosTokenNotInBag', token: 'tablet' });
  });
});

describe('AdvanceScenario', () => {
  const advance: CampaignCommand = { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } };

  it('moves through the scenarios until the campaign is complete, then rejects', () => {
    const start = {
      scenarioIds: ['the-gathering', 'the-midnight-masks', 'the-devourer-below'].map(scenarioId),
    };
    const positions = [startedCampaign(start)];
    for (let i = 0; i < 3; i++)
      positions.push(executeCommand(campaignContext, positions[i]!, advance).log);

    expect(positions.map((log) => log.position)).toEqual([0, 1, 2, 3]);
    expect(
      campaignRejectionOf(() => handleCommand(campaignContext, positions[3]!, advance)),
    ).toEqual({
      code: 'campaignComplete',
    });
  });

  it('records each scenario it leaves with how it ended', () => {
    const start = { scenarioIds: ['the-gathering', 'the-midnight-masks'].map(scenarioId) };

    const log = startedCampaign(
      start,
      { type: 'AdvanceScenario', outcome: { kind: 'resolution', id: resolutionId('R1') } },
      { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } },
    );

    expect(log.playedScenarios).toEqual([
      { scenarioId: 'the-gathering', outcome: { kind: 'resolution', id: 'R1' } },
      { scenarioId: 'the-midnight-masks', outcome: { kind: 'noResolution' } },
    ]);
  });
});

describe('EndCampaign', () => {
  it.each(['won', 'lost', 'survived'] as const)(
    'records that the investigators %s after the last scenario',
    (result) => {
      const log = startedCampaign(
        { scenarioIds: [scenarioId('the-devourer-below')] },
        { type: 'EndCampaign', result },
        { type: 'AdvanceScenario', outcome: { kind: 'noResolution' } },
      );

      expect(log).toMatchObject({ result, position: 1 });
    },
  );

  it('leaves no result on a campaign that goes on', () => {
    const log = startedCampaign({ scenarioIds: [scenarioId('the-gathering')] });

    expect(log.result).toBeUndefined();
  });
});
