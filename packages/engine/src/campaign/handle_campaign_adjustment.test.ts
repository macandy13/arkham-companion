import { describe, expect, it } from 'vitest';
import {
  campaignContext,
  campaignRejectionOf,
  daisy,
  roland,
  startedCampaign,
  wendy,
} from '../../test/utils';
import type { CampaignAdjustment } from './campaign_commands';
import type { CampaignRejection } from './campaign_rejection';
import { campaignInvestigator } from './campaign_log';
import { handleCampaign } from './handle_campaign';

describe('AdjustCampaign (Roland: health 9, sanity 5; three scenarios; Roland has 4 XP earned, 1 spent, 2 physical trauma; story: doubt = count 2)', () => {
  const log = startedCampaign(
    {
      investigators: [roland.code, daisy.code],
      scenarioIds: ['the-gathering', 'the-midnight-masks', 'the-devourer-below'],
    },
    { type: 'AwardXp', code: roland.code, amount: 4 },
    { type: 'SpendXp', code: roland.code, amount: 1 },
    { type: 'AddTrauma', code: roland.code, kind: 'physical', amount: 2 },
    { type: 'RecordStory', key: 'doubt', value: { kind: 'count', value: 2 } },
  );
  const adjust = (adjustment: CampaignAdjustment) =>
    handleCampaign(campaignContext, log, { type: 'AdjustCampaign', adjustment });

  it('lowers earned XP', () => {
    expect(adjust({ kind: 'xp', code: roland.code, account: 'earned', delta: -1 })).toEqual([
      { type: 'XpChanged', code: roland.code, account: 'earned', delta: -1 },
    ]);
  });

  it('lowers spent XP', () => {
    expect(adjust({ kind: 'xp', code: roland.code, account: 'spent', delta: -1 })).toEqual([
      { type: 'XpChanged', code: roland.code, account: 'spent', delta: -1 },
    ]);
  });

  it('lowers trauma', () => {
    expect(adjust({ kind: 'trauma', code: roland.code, trauma: 'physical', delta: -1 })).toEqual([
      { type: 'TraumaChanged', code: roland.code, kind: 'physical', delta: -1 },
    ]);
  });

  it('revives a killed investigator', () => {
    const killed = startedCampaign(
      { investigators: [roland.code] },
      { type: 'MarkKilled', code: roland.code },
    );
    const events = handleCampaign(campaignContext, killed, {
      type: 'AdjustCampaign',
      adjustment: { kind: 'fate', code: roland.code, fate: 'alive' },
    });
    expect(events).toEqual([{ type: 'InvestigatorFateChanged', code: roland.code, fate: 'alive' }]);
  });

  it('removes a story record', () => {
    expect(adjust({ kind: 'removeStory', key: 'doubt' })).toEqual([
      { type: 'StoryRecordRemoved', key: 'doubt' },
    ]);
  });

  it.each([0, 1, 3])('moves the scenario position to %s', (position) => {
    expect(adjust({ kind: 'position', position })).toEqual([
      { type: 'ScenarioPositionChanged', position },
    ]);
  });

  it('leaves the log with the corrected values when applied', () => {
    const corrected = startedCampaign(
      { investigators: [roland.code] },
      { type: 'AwardXp', code: roland.code, amount: 4 },
      {
        type: 'AdjustCampaign',
        adjustment: { kind: 'xp', code: roland.code, account: 'earned', delta: -3 },
      },
    );
    expect(campaignInvestigator(corrected, roland.code)?.xpEarned).toBe(1);
  });

  it.each<{ name: string; adjustment: CampaignAdjustment; expected: CampaignRejection }>([
    {
      name: 'a zero XP delta',
      adjustment: { kind: 'xp', code: roland.code, account: 'earned', delta: 0 },
      expected: { code: 'invalidDelta', delta: 0 },
    },
    {
      name: 'a fractional trauma delta',
      adjustment: { kind: 'trauma', code: roland.code, trauma: 'mental', delta: 0.5 },
      expected: { code: 'invalidDelta', delta: 0.5 },
    },
    {
      name: 'XP for an unknown investigator',
      adjustment: { kind: 'xp', code: wendy.code, account: 'earned', delta: 1 },
      expected: { code: 'unknownInvestigator', investigatorCode: wendy.code },
    },
    {
      name: 'trauma for an unknown investigator',
      adjustment: { kind: 'trauma', code: wendy.code, trauma: 'mental', delta: 1 },
      expected: { code: 'unknownInvestigator', investigatorCode: wendy.code },
    },
    {
      name: 'a fate for an unknown investigator',
      adjustment: { kind: 'fate', code: wendy.code, fate: 'killed' },
      expected: { code: 'unknownInvestigator', investigatorCode: wendy.code },
    },
    {
      name: 'a fate the investigator already has',
      adjustment: { kind: 'fate', code: roland.code, fate: 'alive' },
      expected: { code: 'fateUnchanged', investigatorCode: roland.code, fate: 'alive' },
    },
    {
      name: 'removing a story record that does not exist',
      adjustment: { kind: 'removeStory', key: 'house_burned' },
      expected: { code: 'unknownStoryRecord', key: 'house_burned' },
    },
    {
      name: 'removing a key every object inherits',
      adjustment: { kind: 'removeStory', key: 'toString' },
      expected: { code: 'unknownStoryRecord', key: 'toString' },
    },
    {
      name: 'a negative position',
      adjustment: { kind: 'position', position: -1 },
      expected: { code: 'invalidPosition', position: -1, max: 3 },
    },
    {
      name: 'a position past the last scenario',
      adjustment: { kind: 'position', position: 4 },
      expected: { code: 'invalidPosition', position: 4, max: 3 },
    },
    {
      name: 'a fractional position',
      adjustment: { kind: 'position', position: 1.5 },
      expected: { code: 'invalidPosition', position: 1.5, max: 3 },
    },
    {
      name: 'a negative earned XP total',
      adjustment: { kind: 'xp', code: roland.code, account: 'earned', delta: -5 },
      expected: {
        code: 'inconsistentAdjustment',
        violations: [
          `investigator ${roland.code} has -1 earned XP`,
          `investigator ${roland.code} spent 1 of -1 XP`,
        ],
      },
    },
    {
      name: 'more spent XP than earned',
      adjustment: { kind: 'xp', code: roland.code, account: 'spent', delta: 4 },
      expected: {
        code: 'inconsistentAdjustment',
        violations: [`investigator ${roland.code} spent 5 of 4 XP`],
      },
    },
    {
      name: 'negative trauma',
      adjustment: { kind: 'trauma', code: roland.code, trauma: 'physical', delta: -3 },
      expected: {
        code: 'inconsistentAdjustment',
        violations: [`investigator ${roland.code} has -1 physical trauma`],
      },
    },
    {
      name: 'trauma up to the limit on a living investigator',
      adjustment: { kind: 'trauma', code: roland.code, trauma: 'physical', delta: 7 },
      expected: {
        code: 'inconsistentAdjustment',
        violations: [`investigator ${roland.code} is alive with trauma at the limit`],
      },
    },
  ])('rejects $name', ({ adjustment, expected }) => {
    expect(campaignRejectionOf(() => adjust(adjustment))).toEqual(expected);
  });
});
