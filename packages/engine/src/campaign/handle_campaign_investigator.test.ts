import { describe, expect, it } from 'vitest';
import {
  agnes,
  campaignRejectionOf,
  daisy,
  roland,
  startedCampaign,
  wendy,
} from '../../test/utils';
import { campaignInvestigator } from './campaign_log';
import { handleCampaign } from './handle_campaign';

describe('AwardXp and SpendXp', () => {
  const team = { investigators: [roland, daisy] };

  it('award raises earned XP of that investigator only', () => {
    const log = startedCampaign(team, { type: 'AwardXp', code: '01001', amount: 3 });
    expect(campaignInvestigator(log, '01001')).toMatchObject({ xpEarned: 3, xpSpent: 0 });
    expect(campaignInvestigator(log, '01002')).toMatchObject({ xpEarned: 0, xpSpent: 0 });
  });

  it('spending raises spent XP and keeps the earned total', () => {
    const log = startedCampaign(
      team,
      { type: 'AwardXp', code: '01001', amount: 5 },
      { type: 'SpendXp', code: '01001', amount: 2 },
    );
    expect(campaignInvestigator(log, '01001')).toMatchObject({ xpEarned: 5, xpSpent: 2 });
  });

  it('allows spending exactly the available XP', () => {
    const log = startedCampaign(
      team,
      { type: 'AwardXp', code: '01001', amount: 2 },
      { type: 'SpendXp', code: '01001', amount: 2 },
    );
    expect(campaignInvestigator(log, '01001')).toMatchObject({ xpEarned: 2, xpSpent: 2 });
  });

  it('rejects spending more than is available', () => {
    const log = startedCampaign(
      team,
      { type: 'AwardXp', code: '01001', amount: 5 },
      { type: 'SpendXp', code: '01001', amount: 4 },
    );
    expect(
      campaignRejectionOf(() => handleCampaign(log, { type: 'SpendXp', code: '01001', amount: 2 })),
    ).toEqual({ code: 'notEnoughXp', investigatorCode: '01001', available: 1, requested: 2 });
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects the amount %s', (amount) => {
    const log = startedCampaign(team, { type: 'AwardXp', code: '01001', amount: 5 });
    for (const type of ['AwardXp', 'SpendXp'] as const) {
      expect(
        campaignRejectionOf(() => handleCampaign(log, { type, code: '01001', amount })),
      ).toEqual({
        code: 'invalidAmount',
        amount,
      });
    }
  });

  it('rejects an investigator who is not on the team', () => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(startedCampaign(team), { type: 'AwardXp', code: '01005', amount: 1 }),
      ),
    ).toEqual({ code: 'unknownInvestigator', investigatorCode: '01005' });
  });
});

describe('AddTrauma (Roland: health 9, sanity 5)', () => {
  it('adds trauma of the given kind and leaves the investigator alive below the limit', () => {
    const log = startedCampaign(
      { investigators: [roland] },
      { type: 'AddTrauma', code: '01001', kind: 'physical', amount: 2 },
      { type: 'AddTrauma', code: '01001', kind: 'mental', amount: 4 },
    );
    expect(campaignInvestigator(log, '01001')).toMatchObject({
      physicalTrauma: 2,
      mentalTrauma: 4,
      fate: 'alive',
    });
  });

  it('physical trauma reaching health kills the investigator', () => {
    const log = startedCampaign(
      { investigators: [roland] },
      { type: 'AddTrauma', code: '01001', kind: 'physical', amount: 9 },
    );
    expect(campaignInvestigator(log, '01001')).toMatchObject({ physicalTrauma: 9, fate: 'killed' });
  });

  it('mental trauma reaching sanity drives the investigator insane', () => {
    const log = startedCampaign(
      { investigators: [roland] },
      { type: 'AddTrauma', code: '01001', kind: 'mental', amount: 3 },
      { type: 'AddTrauma', code: '01001', kind: 'mental', amount: 2 },
    );
    expect(campaignInvestigator(log, '01001')).toMatchObject({ mentalTrauma: 5, fate: 'insane' });
  });

  it('produces the trauma event followed by the fate event at the limit', () => {
    const events = handleCampaign(startedCampaign({ investigators: [roland] }), {
      type: 'AddTrauma',
      code: '01001',
      kind: 'mental',
      amount: 5,
    });
    expect(events).toEqual([
      { type: 'TraumaChanged', code: '01001', kind: 'mental', delta: 5 },
      { type: 'InvestigatorFateChanged', code: '01001', fate: 'insane' },
    ]);
  });

  it.each([0, -2, 0.5])('rejects the amount %s', (amount) => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(startedCampaign({ investigators: [roland] }), {
          type: 'AddTrauma',
          code: '01001',
          kind: 'physical',
          amount,
        }),
      ),
    ).toEqual({ code: 'invalidAmount', amount });
  });
});

describe('MarkKilled and MarkInsane', () => {
  it.each([
    { type: 'MarkKilled', fate: 'killed' },
    { type: 'MarkInsane', fate: 'insane' },
  ] as const)('$type sets the fate to $fate', ({ type, fate }) => {
    const log = startedCampaign({ investigators: [roland] }, { type, code: '01001' });
    expect(campaignInvestigator(log, '01001')?.fate).toBe(fate);
  });

  it('rejects an unknown investigator', () => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(startedCampaign({ investigators: [roland] }), {
          type: 'MarkKilled',
          code: '01002',
        }),
      ),
    ).toEqual({ code: 'unknownInvestigator', investigatorCode: '01002' });
  });
});

describe('eliminated investigators (Roland is killed, Daisy is insane)', () => {
  const log = startedCampaign(
    { investigators: [roland, daisy] },
    { type: 'MarkKilled', code: '01001' },
    { type: 'MarkInsane', code: '01002' },
  );

  it.each([
    { code: '01001', fate: 'killed' },
    { code: '01002', fate: 'insane' },
  ] as const)(
    '$code ($fate) cannot gain XP, spend XP, gain trauma or be marked again',
    ({ code, fate }) => {
      const commands = [
        { type: 'AwardXp', code, amount: 1 },
        { type: 'SpendXp', code, amount: 1 },
        { type: 'AddTrauma', code, kind: 'physical', amount: 1 },
        { type: 'MarkKilled', code },
        { type: 'MarkInsane', code },
      ] as const;
      for (const command of commands) {
        expect(campaignRejectionOf(() => handleCampaign(log, command))).toEqual({
          code: 'investigatorEliminated',
          investigatorCode: code,
          fate,
        });
      }
    },
  );
});

describe('ReplaceInvestigator (Roland is killed, Daisy stays alive)', () => {
  const killedRoland = startedCampaign(
    { investigators: [roland, daisy] },
    { type: 'MarkKilled', code: '01001' },
  );

  it('puts the newcomer into the same seat and moves Roland to the former investigators', () => {
    const log = startedCampaign(
      { investigators: [roland, daisy] },
      { type: 'MarkKilled', code: '01001' },
      { type: 'ReplaceInvestigator', code: '01001', by: agnes },
    );

    expect(log.investigators.map((inv) => inv.code)).toEqual(['01004', '01002']);
    expect(log.investigators[0]).toMatchObject({
      health: 6,
      sanity: 8,
      xpEarned: 0,
      physicalTrauma: 0,
      fate: 'alive',
    });
    expect(log.formerInvestigators.map((inv) => [inv.code, inv.fate])).toEqual([
      ['01001', 'killed'],
    ]);
  });

  it('rejects replacing an investigator who is still alive', () => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(killedRoland, { type: 'ReplaceInvestigator', code: '01002', by: agnes }),
      ),
    ).toEqual({ code: 'investigatorNotEliminated', investigatorCode: '01002' });
  });

  it('rejects replacing someone who is not on the team', () => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(killedRoland, { type: 'ReplaceInvestigator', code: '01005', by: agnes }),
      ),
    ).toEqual({ code: 'unknownInvestigator', investigatorCode: '01005' });
  });

  it('rejects a replacement who is a current team member', () => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(killedRoland, { type: 'ReplaceInvestigator', code: '01001', by: daisy }),
      ),
    ).toEqual({ code: 'duplicateInvestigator', investigatorCode: '01002' });
  });

  it('rejects a replacement who is a former investigator', () => {
    const replaced = startedCampaign(
      { investigators: [roland, daisy] },
      { type: 'MarkKilled', code: '01001' },
      { type: 'ReplaceInvestigator', code: '01001', by: agnes },
      { type: 'MarkInsane', code: '01004' },
    );
    expect(
      campaignRejectionOf(() =>
        handleCampaign(replaced, { type: 'ReplaceInvestigator', code: '01004', by: roland }),
      ),
    ).toEqual({ code: 'duplicateInvestigator', investigatorCode: '01001' });
  });

  it('rejects a replacement with invalid printed stats', () => {
    expect(
      campaignRejectionOf(() =>
        handleCampaign(killedRoland, {
          type: 'ReplaceInvestigator',
          code: '01001',
          by: { code: wendy.code, health: 0, sanity: 7 },
        }),
      ),
    ).toEqual({
      code: 'invalidInvestigatorStats',
      investigatorCode: '01005',
      health: 0,
      sanity: 7,
    });
  });
});
