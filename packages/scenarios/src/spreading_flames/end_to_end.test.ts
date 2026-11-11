import { describe, expect, it } from 'vitest';
import { cardDbWith } from '@arkham/engine';
import { newAshCampaign } from '../brethren_of_ash/campaign.test_support';
import { SPREADING_FLAMES_CODES } from '../index';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';
import { spreadingFlamesCards } from './cards';
import { playSpreadingFlames } from './end_to_end.test_support';

const campaignCtx = { cards: cardDbWith(spreadingFlamesCards, zealotInvestigatorCards) };
const yes = { kind: 'flag', value: true } as const;

describe('Spreading Flames, played end to end with Roland and Daisy, seed 1', () => {
  it('plays from setup to resolution 2: act 1 spends clues from anywhere, Escape the Dorms removes the burning room, act 3 spends clues at Orne Library, and the Servant’s defeat lets the group stay and fight the fire', () => {
    const log = playSpreadingFlames(newAshCampaign(campaignCtx));

    // What resolution 2 wrote: the pursuer defeated and the university saved; Roland earned Dr.
    // Henry Armitage; each earned 8 experience and 1 physical trauma.
    expect(log.story).toEqual({
      defeatedTheirMaskedPursuer: yes,
      savedMiskatonicUniversity: yes,
    });
    expect(log.investigators).toMatchObject([
      {
        code: rolandBanks.code,
        xpEarned: 8,
        physicalTrauma: 1,
        earnedCards: [SPREADING_FLAMES_CODES.drHenryArmitage],
      },
      { code: daisyWalker.code, xpEarned: 8, physicalTrauma: 1, earnedCards: [] },
    ]);
    expect(log.playedScenarios).toEqual([
      { scenarioId: 'spreading-flames', outcome: { kind: 'resolution', id: 'R2' } },
    ]);
  });
});
