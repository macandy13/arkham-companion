import { describe, expect, it } from 'vitest';
import type { InvestigatorDef } from '@arkham/carddata';
import { seatInvestigators } from './seating';

function makeDef(code: string, name: string, health: number, sanity: number): InvestigatorDef {
  return {
    code,
    name,
    factionCode: 'neutral',
    health,
    sanity,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'p',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
  };
}

describe('seatInvestigators', () => {
  const catalog = [makeDef('a', 'Alder', 6, 8), makeDef('b', 'Birch', 9, 5)];

  it('seats investigators in the given order with the stats of their card', () => {
    const seated = seatInvestigators(catalog, ['b', 'a']);

    expect(seated.map((i) => [i.code, i.seat, i.health.max, i.sanity.max])).toEqual([
      ['b', 0, 9, 5],
      ['a', 1, 6, 8],
    ]);
  });

  it('skips codes the catalog does not know without leaving a gap in the seats', () => {
    const seated = seatInvestigators(catalog, ['gone', 'a']);

    expect(seated.map((i) => [i.code, i.seat])).toEqual([['a', 0]]);
  });
});
