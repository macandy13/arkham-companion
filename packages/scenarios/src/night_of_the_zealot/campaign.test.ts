import {
  checkCampaignInvariants,
  compileCampaign,
  emptyCampaignLog,
  executeCampaign,
} from '@arkham/engine';
import { describe, expect, it } from 'vitest';
import { theGathering } from '../the_gathering/scenario';
import { nightOfTheZealot } from './campaign';

describe('Night of the Zealot campaign definition', () => {
  const roland = { code: '01001', name: 'Roland Banks', health: 9, sanity: 5 };
  const daisy = { code: '01002', name: 'Daisy Walker', health: 5, sanity: 9 };

  it('lists the three scenarios in campaign order', () => {
    const start = compileCampaign(nightOfTheZealot, {
      campaignId: 'campaign_a',
      difficulty: 'standard',
      investigators: [roland],
    });
    expect(start.definitionId).toBe('night-of-the-zealot');
    expect(start.scenarioIds).toEqual([
      'the-gathering',
      'the-midnight-masks',
      'the-devourer-below',
    ]);
  });

  it.each(['easy', 'standard', 'hard', 'expert'] as const)(
    'starts the %s campaign with the bag of that difficulty',
    (difficulty) => {
      const start = compileCampaign(nightOfTheZealot, {
        campaignId: 'campaign_a',
        difficulty,
        investigators: [roland],
      });
      expect(start.chaosBag).toEqual(theGathering.chaosBag[difficulty]);
    },
  );

  it('produces a valid campaign log at the first scenario', () => {
    const { log } = executeCampaign(
      emptyCampaignLog(),
      compileCampaign(nightOfTheZealot, {
        campaignId: 'campaign_a',
        difficulty: 'standard',
        investigators: [roland, daisy],
      }),
    );
    expect(checkCampaignInvariants(log)).toEqual([]);
    expect(log).toMatchObject({ definitionId: 'night-of-the-zealot', position: 0 });
    expect(log.investigators.map((inv) => inv.code)).toEqual(['01001', '01002']);
  });
});
