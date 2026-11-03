import type { InvestigatorDef } from '@arkham/carddata';
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

function def(code: string): InvestigatorDef {
  return {
    code,
    name: code,
    factionCode: 'neutral',
    health: 7,
    sanity: 7,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'core',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
  };
}

describe('after alder was killed and cedar went insane, beside birch, with former member dusk', () => {
  const log: CampaignLog = {
    ...campaign.createEmptyLog(),
    investigators: [member('alder', 'killed'), member('birch', 'alive'), member('cedar', 'insane')],
    formerInvestigators: [member('dusk', 'killed')],
  };
  const catalog = ['alder', 'birch', 'cedar', 'dusk', 'elm', 'fir'].map(def);
  const elmForAlder = {
    type: 'ReplaceInvestigator' as const,
    code: investigatorCode('alder'),
    by: investigatorCode('elm'),
  };

  it.each([
    ['alder, with nothing chosen yet', [], 'alder', ['elm', 'fir']],
    ['cedar, with elm chosen for alder', [elmForAlder], 'cedar', ['fir']],
    ['alder again, with elm chosen for alder', [elmForAlder], 'alder', ['elm', 'fir']],
  ])('offers for %s only investigators new to the campaign', (_, chosen, code, expected) => {
    const candidates = replacementCandidates(catalog, log, chosen, investigatorCode(code));

    expect(candidates.map((candidate) => candidate.code)).toEqual(expected);
  });

  it("seats elm in alder's place", () => {
    expect(teamAfter(log, [elmForAlder])).toEqual(['elm', 'birch', 'cedar']);
  });
});
