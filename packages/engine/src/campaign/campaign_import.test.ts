import { describe, expect, it } from 'vitest';
import { execute } from '../execute';
import { newGame } from '../game_builder';
import { campaignId, investigatorCode, scenarioId } from '../ids';
import { emptyState } from '../state';
import { createEmptyLog } from './campaign_log';
import type { CampaignEvent } from './campaign_events';
import { moveCampaignEvent, moveGameEvent } from './campaign_import';

describe('moving an imported campaign to its new id', () => {
  const onThisDevice = campaignId('on-this-device');

  it('names the new id in the event that starts the campaign', () => {
    const started: CampaignEvent = {
      type: 'CampaignStarted',
      campaignId: campaignId('on-the-other-device'),
      definitionId: createEmptyLog().definitionId,
      difficulty: 'standard',
      investigators: [],
      chaosBag: ['0'],
      scenarioIds: [scenarioId('the-gathering')],
    };

    expect(moveCampaignEvent(started, onThisDevice)).toEqual({
      ...started,
      campaignId: onThisDevice,
    });
  });

  it('leaves the campaign’s other events as they are', () => {
    const xp: CampaignEvent = {
      type: 'XpChanged',
      code: investigatorCode('01001'),
      account: 'earned',
      delta: 2,
    };

    expect(moveCampaignEvent(xp, onThisDevice)).toBe(xp);
  });

  it('names the new id in the campaign log a game of the campaign starts with', () => {
    const game = newGame().withCampaign({
      ...createEmptyLog(),
      campaignId: campaignId('on-the-other-device'),
    });
    const [started] = execute(game.context(), emptyState(), game.startCommand()).events;

    expect(moveGameEvent(started!, onThisDevice)).toMatchObject({
      type: 'ScenarioStarted',
      campaign: { campaignId: onThisDevice },
    });
  });

  it('leaves a standalone game’s start as it is', () => {
    const game = newGame();
    const [started] = execute(game.context(), emptyState(), game.startCommand()).events;

    expect(moveGameEvent(started!, onThisDevice)).toBe(started);
  });
});
