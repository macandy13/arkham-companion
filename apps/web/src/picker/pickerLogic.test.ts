import { describe, expect, it } from 'vitest';
import type { InvestigatorDef, PackDef } from '@arkham/carddata';
import {
  activeFilterCount,
  applyPickerFilters,
  cyclePositions,
  moveSeat,
  seatNumber,
  sortedPacks,
} from './pickerLogic';

function makeInvestigator(overrides: Partial<InvestigatorDef>): InvestigatorDef {
  return {
    code: 'x',
    name: 'X',
    factionCode: 'neutral',
    health: 7,
    sanity: 7,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'p1',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
    ...overrides,
  };
}

function makePack(overrides: Partial<PackDef>): PackDef {
  return { code: 'p1', name: 'Pack', position: 1, cyclePosition: 1, chapter: 1, ...overrides };
}

describe('applyPickerFilters', () => {
  const none = { search: '', factions: [], onlyOwned: false };
  const alder = makeInvestigator({ code: 'a', name: 'Alder', factionCode: 'seeker' });
  const alder2 = makeInvestigator({
    code: 'a2',
    name: 'Alder',
    factionCode: 'seeker',
    chapter: 2,
    packCode: 'p2',
  });
  const birch = makeInvestigator({
    code: 'b',
    name: 'Birch',
    factionCode: 'rogue',
    cyclePosition: 2,
    packCode: 'p3',
  });
  const all = [birch, alder2, alder];

  it('sorts by name, then chapter', () => {
    expect(applyPickerFilters(all, none).map((i) => i.code)).toEqual(['a', 'a2', 'b']);
  });

  it('sorts names in quotes by their letters', () => {
    const ashcan = makeInvestigator({ code: 'ashcan', name: '"Ashcan" Pete' });
    const agnes = makeInvestigator({ code: 'agnes', name: 'Agnes Baker' });
    const bob = makeInvestigator({ code: 'bob', name: 'Bob Jenkins' });

    const sorted = applyPickerFilters([bob, ashcan, agnes], none).map((i) => i.code);

    expect(sorted).toEqual(['agnes', 'ashcan', 'bob']);
  });

  it('searches the name case-insensitively', () => {
    expect(applyPickerFilters(all, { ...none, search: ' BIR' }).map((i) => i.code)).toEqual(['b']);
  });

  it('keeps investigators of any selected class', () => {
    const result = applyPickerFilters(all, { ...none, factions: ['rogue', 'mystic'] });
    expect(result.map((i) => i.code)).toEqual(['b']);
  });

  it('filters by cycle', () => {
    expect(applyPickerFilters(all, { ...none, cyclePosition: 2 }).map((i) => i.code)).toEqual([
      'b',
    ]);
  });

  it('filters by pack', () => {
    expect(applyPickerFilters(all, { ...none, packCode: 'p2' }).map((i) => i.code)).toEqual(['a2']);
  });

  it('filters by chapter', () => {
    expect(applyPickerFilters(all, { ...none, chapter: 2 }).map((i) => i.code)).toEqual(['a2']);
  });

  it('keeps everything when the collection filter is on but no packs are known', () => {
    expect(applyPickerFilters(all, { ...none, onlyOwned: true })).toHaveLength(3);
  });

  it('keeps only investigators from owned packs', () => {
    const result = applyPickerFilters(all, { ...none, onlyOwned: true }, new Set(['p1', 'p3']));
    expect(result.map((i) => i.code)).toEqual(['a', 'b']);
  });
});

describe('pack helpers', () => {
  const packs = [
    makePack({ code: 'c', cyclePosition: 2, position: 1 }),
    makePack({ code: 'b', cyclePosition: 1, position: 2 }),
    makePack({ code: 'a', cyclePosition: 1, position: 1 }),
  ];

  it('lists distinct cycles ascending', () => {
    expect(cyclePositions(packs)).toEqual([1, 2]);
  });

  it('sorts packs by cycle, then position', () => {
    expect(sortedPacks(packs).map((p) => p.code)).toEqual(['a', 'b', 'c']);
  });
});

describe('moveSeat', () => {
  it('moves an entry to a new index', () => {
    expect(moveSeat(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('ignores out-of-range moves', () => {
    expect(moveSeat(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveSeat(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
});

describe('activeFilterCount', () => {
  const none = { search: '', factions: [], onlyOwned: false };

  it.each([
    ['no filters', none, 0],
    ['only a search', { ...none, search: 'alder' }, 0],
    ['two classes', { ...none, factions: ['seeker', 'rogue'] }, 1],
    ['a cycle and a pack', { ...none, cyclePosition: 2, packCode: 'p1' }, 2],
    ['a chapter and the collection', { ...none, chapter: 2 as const, onlyOwned: true }, 2],
  ])('counts %s as %i', (_, filters, count) => {
    expect(activeFilterCount(filters)).toBe(count);
  });
});

describe('seatNumber', () => {
  it.each([
    ['the lead', 'roland', 1],
    ['the second seat', 'daisy', 2],
    ['no one not seated', 'skids', undefined],
  ])('gives %s', (_, code, seat) => {
    expect(seatNumber(['roland', 'daisy'], code)).toBe(seat);
  });
});
