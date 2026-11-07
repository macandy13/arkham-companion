import { type InvestigatorDef, toCardCode } from '@arkham/carddata';
import {
  campaign,
  investigatorCode,
  type CampaignInvestigator,
  type CampaignLog,
} from '@arkham/engine';
import { describe, expect, it } from 'vitest';
import { replacementCandidates, teamAfter } from './replacements';

function member(code: string, fate: CampaignInvestigator['fate']): CampaignInvestigator {
  return {
    code: investigatorCode(code),
    name: code,
    health: 7,
    sanity: 7,
    physicalTrauma: 0,
    mentalTrauma: 0,
    xpEarned: 0,
    xpSpent: 0,
    fate,
    earnedCards: [],
  };
}

function def(code: string, parallelOfCode?: string): InvestigatorDef {
  return {
    code: toCardCode(code),
    ...(parallelOfCode === undefined ? {} : { parallelOfCode: toCardCode(parallelOfCode) }),
    name: code,
    factionCode: 'neutral',
    health: 7,
    sanity: 7,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'core',
    cyclePosition: 1,
    parallel: parallelOfCode !== undefined,
    chapter: 1,
  };
}

describe('after alder was killed and cedar went insane, beside birch, with former member dusk', () => {
  const log: CampaignLog = {
    ...campaign.createEmptyLog(),
    investigators: [member('alder', 'killed'), member('birch', 'alive'), member('cedar', 'insane')],
    formerInvestigators: [member('dusk', 'killed')],
  };
  const catalog = [
    ...['alder', 'birch', 'cedar', 'dusk', 'elm', 'fir'].map((code) => def(code)),
    def('parallel_alder', 'alder'),
    def('parallel_fir', 'fir'),
  ];
  const elmForAlder = {
    type: 'ReplaceInvestigator' as const,
    code: investigatorCode('alder'),
    by: investigatorCode('elm'),
  };

  it.each([
    ['alder, with nothing chosen yet', [], 'alder', ['elm', 'fir', 'parallel_fir']],
    ['cedar, with elm chosen for alder', [elmForAlder], 'cedar', ['fir', 'parallel_fir']],
    [
      'alder again, with elm chosen for alder',
      [elmForAlder],
      'alder',
      ['elm', 'fir', 'parallel_fir'],
    ],
    [
      'cedar, with parallel fir chosen for alder',
      [{ ...elmForAlder, by: investigatorCode('parallel_fir') }],
      'cedar',
      ['elm'],
    ],
  ])(
    'offers for %s only investigators new to the campaign, a parallel version going with its original',
    (_, chosen, code, expected) => {
      const candidates = replacementCandidates(catalog, log, chosen, investigatorCode(code));

      expect(candidates.map((candidate) => candidate.code)).toEqual(expected);
    },
  );

  it("seats elm in alder's place", () => {
    expect(teamAfter(log, [elmForAlder])).toEqual(['elm', 'birch', 'cedar']);
  });
});
