import { describe, expect, it } from 'vitest';
import { campaignContext, roland, startedCampaign, stateAfter } from '../../test/utils';
import {
  blankLocation,
  campaign,
  CUSTOM_SCENARIO,
  instanceId,
  interludeId,
  investigatorId,
  newGame,
  resolutionId,
  scenarioId,
  type CampaignEvent,
} from '../index';

const study = instanceId('study');
const alice = investigatorId('alice');

/** Roland's campaign, at the scenario `newGame()` tables play, before the next one. */
const atTheTablesScenario = startedCampaign({
  investigators: [roland.code],
  scenarioIds: [CUSTOM_SCENARIO, scenarioId('next_scenario')],
});

/** A game of that scenario, ended with resolution 1. */
function endedWithR1() {
  const { context, state } = newGame()
    .withLocation(study, blankLocation('study'))
    .withInvestigator(alice, { locationId: study })
    .start();
  return stateAfter(context, state, { type: 'EndScenario', resolution: resolutionId('R1') });
}

describe('campaignNotices', () => {
  it("files a resolution's entries by kind, each as the resolution's", () => {
    const written = campaign.applyResolution(campaignContext, atTheTablesScenario, endedWithR1(), [
      { type: 'AwardXp', code: roland.code, amount: 3 },
      { type: 'AddTrauma', code: roland.code, kind: 'mental', amount: 1 },
      { type: 'AddChaosToken', token: 'cultist' },
      { type: 'RecordStory', key: 'houseStillStanding', value: { kind: 'flag', value: true } },
    ]);

    const byR1 = {
      kind: 'resolution',
      scenarioId: CUSTOM_SCENARIO,
      outcome: { kind: 'resolution', id: 'R1' },
    };
    expect(
      campaign.campaignNotices(written).map(({ kind, cause, events }) => ({
        kind,
        cause,
        events: events.map((event) => event.type),
      })),
    ).toEqual([
      { kind: 'xp', cause: byR1, events: ['XpChanged'] },
      { kind: 'trauma', cause: byR1, events: ['TraumaChanged'] },
      { kind: 'chaosBag', cause: byR1, events: ['ChaosTokenAdded'] },
      { kind: 'story', cause: byR1, events: ['StoryRecorded'] },
      { kind: 'scenario', cause: byR1, events: ['ScenarioPlayed', 'ScenarioPositionChanged'] },
    ]);
  });

  it('splits entries of one kind written by two resolutions', () => {
    const xpFor = (resolution: string, amount: number): campaign.CausedCampaignEvents => ({
      events: [{ type: 'XpChanged', code: roland.code, account: 'earned', delta: amount }],
      causes: [
        {
          kind: 'resolution',
          scenarioId: CUSTOM_SCENARIO,
          outcome: { kind: 'resolution', id: resolutionId(resolution) },
        },
      ],
    });
    const r1 = xpFor('R1', 2);
    const r2 = xpFor('R2', 1);

    const notices = campaign.campaignNotices({
      events: [...r1.events, ...r2.events],
      causes: [...r1.causes, ...r2.causes],
    });

    expect(notices.map(({ cause, events }) => [cause, events.length])).toEqual([
      [r1.causes[0], 1],
      [r2.causes[0], 1],
    ]);
  });

  it("splits a resolution's entries from an interlude's of the same kind", () => {
    const byR1 = {
      kind: 'resolution',
      scenarioId: CUSTOM_SCENARIO,
      outcome: { kind: 'resolution', id: resolutionId('R1') },
    } as const;
    const byInterlude = { kind: 'interlude', interludeId: interludeId('the_survivors') } as const;
    const xp: CampaignEvent = { type: 'XpChanged', code: roland.code, account: 'earned', delta: 1 };

    const notices = campaign.campaignNotices({
      events: [xp, xp, xp],
      causes: [byR1, byInterlude, byInterlude],
    });

    expect(notices.map(({ cause, events }) => [cause, events.length])).toEqual([
      [byR1, 1],
      [byInterlude, 2],
    ]);
  });

  it('gives no notice for what the players write by hand', () => {
    const adjusted = campaign.executeCommand(campaignContext, atTheTablesScenario, {
      type: 'AwardXp',
      code: roland.code,
      amount: 2,
    });

    expect(adjusted.causes).toEqual([{ kind: 'player' }]);
    expect(campaign.campaignNotices(adjusted)).toEqual([]);
  });
});

describe('campaignNoticeKindOf', () => {
  it.each<{ event: CampaignEvent; kind: campaign.CampaignNoticeKind | undefined }>([
    { event: { type: 'ChaosTokenRemoved', token: '-1' }, kind: 'chaosBag' },
    { event: { type: 'InvestigatorFateChanged', code: roland.code, fate: 'killed' }, kind: 'fate' },
    { event: { type: 'StoryRecordRemoved', key: 'houseStillStanding' }, kind: 'story' },
    { event: { type: 'CampaignEnded', result: 'won' }, kind: 'scenario' },
    {
      event: { type: 'InterludePlayed', interludeId: interludeId('the_survivors') },
      kind: 'scenario',
    },
  ])('files $event.type under $kind', ({ event, kind }) => {
    expect(campaign.campaignNoticeKindOf(event)).toBe(kind);
  });
});
