import { campaign, campaignId } from '@arkham/engine';
import { campaignContext, daisy, roland } from '@arkham/engine/test/utils';
import { describe, expect, it } from 'vitest';
import { spreadingFlames } from '../spreading_flames/scenario';
import { brethrenOfAsh } from './campaign';

describe('Brethren of Ash campaign definition', () => {
  it('lists Spreading Flames, then Smoke and Mirrors', () => {
    const start = campaign.compileStart(brethrenOfAsh, {
      campaignId: campaignId('campaign_a'),
      difficulty: 'standard',
      investigators: [roland.code],
    });
    expect(start.definitionId).toBe('brethren-of-ash');
    expect(start.scenarioIds).toEqual(['spreading-flames', 'smoke-and-mirrors']);
  });

  it.each(['easy', 'standard', 'hard', 'expert'] as const)(
    'starts the %s campaign with the Spreading Flames bag of that difficulty',
    (difficulty) => {
      const start = campaign.compileStart(brethrenOfAsh, {
        campaignId: campaignId('campaign_a'),
        difficulty,
        investigators: [roland.code],
      });
      expect(start.chaosBag).toEqual(spreadingFlames.chaosBag[difficulty]);
    },
  );

  it('produces a valid campaign log at the first scenario', () => {
    const { log } = campaign.executeCommand(
      campaignContext,
      campaign.createEmptyLog(),
      campaign.compileStart(brethrenOfAsh, {
        campaignId: campaignId('campaign_a'),
        difficulty: 'standard',
        investigators: [roland.code, daisy.code],
      }),
    );
    expect(campaign.checkInvariants(log)).toEqual([]);
    expect(log).toMatchObject({ definitionId: 'brethren-of-ash', position: 0 });
  });
});
