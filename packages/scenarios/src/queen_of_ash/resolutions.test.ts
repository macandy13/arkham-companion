import { describe, expect, it } from 'vitest';
import {
  campaign,
  cardDbWith,
  investigatorCode,
  investigatorId,
  type ResolutionId,
  type ScenarioContext,
} from '@arkham/engine';
import { standardInvestigatorCards, startScenario, stateAfter } from '@arkham/engine/test/utils';
import {
  ASH_STORY,
  QUEEN_OF_ASH_RESOLUTIONS,
  queenOfAsh,
  queenOfAshCards,
  queenOfAshResolutions,
} from '../index';

const ctx: ScenarioContext = {
  cards: cardDbWith(queenOfAshCards, standardInvestigatorCards),
  scenario: queenOfAsh,
};

describe('Queen of Ash resolutions', () => {
  const tank = investigatorCode('tank');
  const seeker = investigatorCode('seeker');
  const yes = { kind: 'flag', value: true } as const;
  const collector = {
    kind: 'byHand',
    textKey: 'scenario.queenOfAsh.resolution.collector',
  } as const;
  /** A standalone game with the tank alone, ended in `resolution`. */
  const endedIn = (resolution: ResolutionId) =>
    stateAfter(ctx, startScenario(ctx), { type: 'EndScenario', resolution });

  it.each([
    {
      resolution: QUEEN_OF_ASH_RESOLUTIONS.elokossDefeated,
      record: ASH_STORY.defeatedElokossAndTheBrethren,
      name: 'R1: Elokoss and the Brethren defeated',
    },
    {
      resolution: QUEEN_OF_ASH_RESOLUTIONS.rebirthStopped,
      record: ASH_STORY.stoppedElokosssRebirth,
      name: "R2: Elokoss's rebirth stopped",
    },
  ])(
    'records $name, 5 bonus XP, the Collector, 2 mental and 2 physical trauma, and the campaign won',
    ({ resolution, record }) => {
      const ended = endedIn(resolution);

      expect(campaign.proposeResolution(ctx, ended, queenOfAshResolutions)).toEqual([
        { kind: 'command', command: { type: 'RecordStory', key: record, value: yes } },
        { kind: 'command', command: { type: 'AwardXp', code: tank, amount: 5 } },
        collector,
        { kind: 'command', command: { type: 'AddTrauma', code: tank, kind: 'mental', amount: 2 } },
        {
          kind: 'command',
          command: { type: 'AddTrauma', code: tank, kind: 'physical', amount: 2 },
        },
        { kind: 'command', command: { type: 'EndCampaign', result: 'won' } },
      ]);
    },
  );

  it('records R3: the ritual flooded, the seeker who stayed killed, the tank who resigned with 3 XP and 3 mental trauma, and the campaign won', () => {
    const ended = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      { type: 'Resign', investigatorId: investigatorId('tank'), immediately: true },
      { type: 'EndScenario', resolution: QUEEN_OF_ASH_RESOLUTIONS.ritualFlooded },
    );

    expect(campaign.proposeResolution(ctx, ended, queenOfAshResolutions)).toEqual([
      {
        kind: 'command',
        command: { type: 'RecordStory', key: ASH_STORY.floodedTheSummoningRitual, value: yes },
      },
      { kind: 'command', command: { type: 'MarkKilled', code: seeker } },
      { kind: 'command', command: { type: 'AwardXp', code: tank, amount: 3 } },
      collector,
      { kind: 'command', command: { type: 'AddTrauma', code: tank, kind: 'mental', amount: 3 } },
      { kind: 'command', command: { type: 'EndCampaign', result: 'won' } },
    ]);
  });

  it('records no resolution: Elokoss reborn, each investigator killed, and the campaign lost', () => {
    const ended = stateAfter(ctx, startScenario(ctx), {
      type: 'DefeatInvestigator',
      investigatorId: investigatorId('tank'),
    });

    expect(campaign.proposeResolution(ctx, ended, queenOfAshResolutions)).toEqual([
      {
        kind: 'command',
        command: { type: 'RecordStory', key: ASH_STORY.elokossWasReborn, value: yes },
      },
      { kind: 'command', command: { type: 'MarkKilled', code: tank } },
      { kind: 'command', command: { type: 'EndCampaign', result: 'lost' } },
    ]);
  });
});
