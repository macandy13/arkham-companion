import { describe, expect, it } from 'vitest';
import { cardDbWith } from '@arkham/engine';
import { newAshCampaign } from '../brethren_of_ash/campaign.test_support';
import { daisyWalker, rolandBanks, zealotInvestigatorCards } from '../investigators';
import { playSpreadingFlames } from '../spreading_flames/end_to_end.test_support';
import { smokeAndMirrorsCards } from './cards';
import { playSmokeAndMirrors } from './end_to_end.test_support';

const campaignCtx = { cards: cardDbWith(smokeAndMirrorsCards, zealotInvestigatorCards) };
const yes = { kind: 'flag', value: true } as const;

describe('Smoke and Mirrors end to end: Roland and Daisy, seed 1', () => {
  it("plays from the log Spreading Flames wrote to both investigators resigning: Augurs of Flame draws Naomi O'Bannion from beneath Uptown, she is interrogated and put beneath the act, and the log records her as experience and the harbinger as Sgt. Earl Monroe", () => {
    const afterSpreadingFlames = playSpreadingFlames(newAshCampaign(campaignCtx));

    const log = playSmokeAndMirrors(afterSpreadingFlames);

    // No resolution: Sgt. Earl Monroe recorded as the harbinger, the cult not found, 2 cultist
    // tokens added for the rest of the campaign, and 2 more experience each (8 from Spreading
    // Flames before).
    expect(log.story).toEqual({
      defeatedTheirMaskedPursuer: yes,
      savedMiskatonicUniversity: yes,
      harbingerOfElokoss: { kind: 'list', entries: ['Sgt. Earl Monroe'] },
      discoveredTheCultsWhereabouts: { kind: 'flag', value: false },
    });
    expect(log.investigators).toMatchObject([
      { code: rolandBanks.code, xpEarned: 10 },
      { code: daisyWalker.code, xpEarned: 10 },
    ]);
    expect(log.chaosBag.filter((token) => token === 'cultist')).toEqual(['cultist', 'cultist']);
    expect(log.playedScenarios).toEqual([
      { scenarioId: 'spreading-flames', outcome: { kind: 'resolution', id: 'R2' } },
      { scenarioId: 'smoke-and-mirrors', outcome: { kind: 'noResolution' } },
    ]);
  });
});
