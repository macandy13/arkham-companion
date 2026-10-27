import { describe, expect, it } from 'vitest';
import {
  agnes,
  campaignContext,
  campaignRejectionOf,
  daisy,
  roland,
  startedCampaign,
} from '../../test/utils';
import { cardCode, investigatorCode } from '../ids';
import { findInvestigator } from './campaign_log';
import { handleCommand } from './handle_campaign';

/** A card code of an investigator who is on no team in these tests. */
const notOnTeam = investigatorCode('not_on_team');

describe('AwardXp and SpendXp', () => {
  const team = { investigators: [roland.code, daisy.code] };

  it('award raises earned XP of that investigator only', () => {
    const log = startedCampaign(team, { type: 'AwardXp', code: roland.code, amount: 3 });
    expect(findInvestigator(log, roland.code)).toMatchObject({ xpEarned: 3, xpSpent: 0 });
    expect(findInvestigator(log, daisy.code)).toMatchObject({ xpEarned: 0, xpSpent: 0 });
  });

  it('spending raises spent XP and keeps the earned total', () => {
    const log = startedCampaign(
      team,
      { type: 'AwardXp', code: roland.code, amount: 5 },
      { type: 'SpendXp', code: roland.code, amount: 2 },
    );
    expect(findInvestigator(log, roland.code)).toMatchObject({ xpEarned: 5, xpSpent: 2 });
  });

  it('allows spending exactly the available XP', () => {
    const log = startedCampaign(
      team,
      { type: 'AwardXp', code: roland.code, amount: 2 },
      { type: 'SpendXp', code: roland.code, amount: 2 },
    );
    expect(findInvestigator(log, roland.code)).toMatchObject({ xpEarned: 2, xpSpent: 2 });
  });

  it('rejects spending more than is available', () => {
    const log = startedCampaign(
      team,
      { type: 'AwardXp', code: roland.code, amount: 5 },
      { type: 'SpendXp', code: roland.code, amount: 4 },
    );
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, log, { type: 'SpendXp', code: roland.code, amount: 2 }),
      ),
    ).toEqual({ code: 'notEnoughXp', investigatorCode: roland.code, available: 1, requested: 2 });
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects the amount %s', (amount) => {
    const log = startedCampaign(team, { type: 'AwardXp', code: roland.code, amount: 5 });
    for (const type of ['AwardXp', 'SpendXp'] as const) {
      expect(
        campaignRejectionOf(() =>
          handleCommand(campaignContext, log, { type, code: roland.code, amount }),
        ),
      ).toEqual({
        code: 'invalidAmount',
        amount,
      });
    }
  });

  it('rejects an investigator who is not on the team', () => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, startedCampaign(team), {
          type: 'AwardXp',
          code: notOnTeam,
          amount: 1,
        }),
      ),
    ).toEqual({ code: 'unknownInvestigator', investigatorCode: notOnTeam });
  });
});

describe('AddTrauma (Roland: health 9, sanity 5)', () => {
  it('adds trauma of the given kind and leaves the investigator alive below the limit', () => {
    const log = startedCampaign(
      { investigators: [roland.code] },
      { type: 'AddTrauma', code: roland.code, kind: 'physical', amount: 2 },
      { type: 'AddTrauma', code: roland.code, kind: 'mental', amount: 4 },
    );
    expect(findInvestigator(log, roland.code)).toMatchObject({
      physicalTrauma: 2,
      mentalTrauma: 4,
      fate: 'alive',
    });
  });

  it('physical trauma reaching health kills the investigator', () => {
    const log = startedCampaign(
      { investigators: [roland.code] },
      { type: 'AddTrauma', code: roland.code, kind: 'physical', amount: 9 },
    );
    expect(findInvestigator(log, roland.code)).toMatchObject({
      physicalTrauma: 9,
      fate: 'killed',
    });
  });

  it('mental trauma reaching sanity drives the investigator insane', () => {
    const log = startedCampaign(
      { investigators: [roland.code] },
      { type: 'AddTrauma', code: roland.code, kind: 'mental', amount: 3 },
      { type: 'AddTrauma', code: roland.code, kind: 'mental', amount: 2 },
    );
    expect(findInvestigator(log, roland.code)).toMatchObject({
      mentalTrauma: 5,
      fate: 'insane',
    });
  });

  it('produces the trauma event followed by the fate event at the limit', () => {
    const events = handleCommand(
      campaignContext,
      startedCampaign({ investigators: [roland.code] }),
      {
        type: 'AddTrauma',
        code: roland.code,
        kind: 'mental',
        amount: 5,
      },
    );
    expect(events).toEqual([
      { type: 'TraumaChanged', code: roland.code, kind: 'mental', delta: 5 },
      { type: 'InvestigatorFateChanged', code: roland.code, fate: 'insane' },
    ]);
  });

  it.each([0, -2, 0.5])('rejects the amount %s', (amount) => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, startedCampaign({ investigators: [roland.code] }), {
          type: 'AddTrauma',
          code: roland.code,
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
    const log = startedCampaign({ investigators: [roland.code] }, { type, code: roland.code });
    expect(findInvestigator(log, roland.code)?.fate).toBe(fate);
  });

  it('rejects an unknown investigator', () => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, startedCampaign({ investigators: [roland.code] }), {
          type: 'MarkKilled',
          code: daisy.code,
        }),
      ),
    ).toEqual({ code: 'unknownInvestigator', investigatorCode: daisy.code });
  });
});

describe('EarnCard', () => {
  it('adds the story card to roland’s earned cards only', () => {
    const log = startedCampaign(
      { investigators: [roland.code, daisy.code] },
      { type: 'EarnCard', code: roland.code, card: cardCode('lita') },
    );

    expect(findInvestigator(log, roland.code)?.earnedCards).toEqual([cardCode('lita')]);
    expect(findInvestigator(log, daisy.code)?.earnedCards).toEqual([]);
  });

  it('lists a story card roland earns twice once', () => {
    const log = startedCampaign(
      { investigators: [roland.code] },
      { type: 'EarnCard', code: roland.code, card: cardCode('lita') },
      { type: 'EarnCard', code: roland.code, card: cardCode('lita') },
    );

    expect(findInvestigator(log, roland.code)?.earnedCards).toEqual([cardCode('lita')]);
  });
});

describe('eliminated investigators (Roland is killed, Daisy is insane)', () => {
  const log = startedCampaign(
    { investigators: [roland.code, daisy.code] },
    { type: 'MarkKilled', code: roland.code },
    { type: 'MarkInsane', code: daisy.code },
  );

  it.each([
    { code: roland.code, fate: 'killed' },
    { code: daisy.code, fate: 'insane' },
  ] as const)(
    '$code ($fate) cannot gain XP, spend XP, gain trauma, be marked again or earn a card',
    ({ code, fate }) => {
      const commands = [
        { type: 'AwardXp', code, amount: 1 },
        { type: 'SpendXp', code, amount: 1 },
        { type: 'AddTrauma', code, kind: 'physical', amount: 1 },
        { type: 'MarkKilled', code },
        { type: 'MarkInsane', code },
        { type: 'EarnCard', code, card: cardCode('lita') },
      ] as const;
      for (const command of commands) {
        expect(campaignRejectionOf(() => handleCommand(campaignContext, log, command))).toEqual({
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
    { investigators: [roland.code, daisy.code] },
    { type: 'MarkKilled', code: roland.code },
  );

  it('puts the newcomer into the same seat and moves Roland to the former investigators', () => {
    const log = startedCampaign(
      { investigators: [roland.code, daisy.code] },
      { type: 'MarkKilled', code: roland.code },
      { type: 'ReplaceInvestigator', code: roland.code, by: agnes.code },
    );

    expect(log.investigators.map((member) => member.code)).toEqual([agnes.code, daisy.code]);
    expect(log.investigators[0]).toMatchObject({
      health: agnes.health,
      sanity: agnes.sanity,
      xpEarned: 0,
      physicalTrauma: 0,
      fate: 'alive',
    });
    expect(log.formerInvestigators.map((member) => [member.code, member.fate])).toEqual([
      [roland.code, 'killed'],
    ]);
  });

  it('rejects replacing an investigator who is still alive', () => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, killedRoland, {
          type: 'ReplaceInvestigator',
          code: daisy.code,
          by: agnes.code,
        }),
      ),
    ).toEqual({ code: 'investigatorNotEliminated', investigatorCode: daisy.code });
  });

  it('rejects replacing someone who is not on the team', () => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, killedRoland, {
          type: 'ReplaceInvestigator',
          code: notOnTeam,
          by: agnes.code,
        }),
      ),
    ).toEqual({ code: 'unknownInvestigator', investigatorCode: notOnTeam });
  });

  it('rejects a replacement who is a current team member', () => {
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, killedRoland, {
          type: 'ReplaceInvestigator',
          code: roland.code,
          by: daisy.code,
        }),
      ),
    ).toEqual({ code: 'duplicateInvestigator', investigatorCode: daisy.code });
  });

  it('rejects a replacement who is a former investigator', () => {
    const replaced = startedCampaign(
      { investigators: [roland.code, daisy.code] },
      { type: 'MarkKilled', code: roland.code },
      { type: 'ReplaceInvestigator', code: roland.code, by: agnes.code },
      { type: 'MarkInsane', code: agnes.code },
    );
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, replaced, {
          type: 'ReplaceInvestigator',
          code: agnes.code,
          by: roland.code,
        }),
      ),
    ).toEqual({ code: 'duplicateInvestigator', investigatorCode: roland.code });
  });

  it('rejects a replacement whose card is not in the context', () => {
    const notACard = investigatorCode('not_a_card');
    expect(
      campaignRejectionOf(() =>
        handleCommand(campaignContext, killedRoland, {
          type: 'ReplaceInvestigator',
          code: roland.code,
          by: notACard,
        }),
      ),
    ).toEqual({ code: 'unknownInvestigatorCard', investigatorCode: notACard });
  });
});
