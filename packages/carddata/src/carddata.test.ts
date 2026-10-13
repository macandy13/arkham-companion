import { describe, expect, it } from 'vitest';
import { cardsByEncounterCode, expandByQuantity, normaliseCard, normalisePack } from './index';
import { packUrl } from './fetch';

// Hand-written fake cards – never real card text.
const raw = [
  {
    code: '99001',
    name: 'Fake Location',
    type_code: 'location',
    pack_code: 'fake',
    position: 1,
    quantity: 2,
    encounter_code: 'fake_set',
    encounter_position: 1,
    shroud: 2,
    clues: 1,
    traits: 'Test. Room.',
    extra_field: 'ignored',
  },
  {
    code: '99002',
    name: 'Fake Enemy',
    subname: 'Sub',
    type_code: 'enemy',
    pack_code: 'fake',
    position: 2,
    quantity: 3,
    encounter_code: 'fake_set',
    encounter_position: 2,
    enemy_fight: 3,
    enemy_evade: null,
    health: 4,
    is_unique: true,
  },
  {
    code: '99003',
    name: 'Other Treachery',
    type_code: 'treachery',
    pack_code: 'fake',
    position: 3,
    quantity: 1,
    encounter_code: 'other_set',
  },
  { code: '99004', name: 'Fake Asset', type_code: 'asset', pack_code: 'fake', position: 4 },
];

describe('normalise', () => {
  const cards = normalisePack(raw);

  it('maps fields and parses traits', () => {
    expect(cards[0]).toMatchObject({
      code: '99001',
      typeCode: 'location',
      encounterCode: 'fake_set',
      shroud: 2,
      traits: ['Test', 'Room'],
      doubleSided: false,
      isUnique: false,
    });
    expect(cards[1]).toMatchObject({ fight: 3, evade: undefined, isUnique: true });
    expect(cards[3]?.quantity).toBe(1);
  });

  it('rejects malformed cards', () => {
    expect(() => normaliseCard({ code: 1 })).toThrow();
    expect(() => normalisePack({})).toThrow();
  });
});

describe('helpers', () => {
  const cards = normalisePack(raw);

  it('lists cards by encounter code', () => {
    expect(cardsByEncounterCode(cards, 'fake_set').map((c) => c.code)).toEqual(['99001', '99002']);
    expect(cardsByEncounterCode(cards, 'nope')).toEqual([]);
  });

  it('expands by quantity', () => {
    const set = cardsByEncounterCode(cards, 'fake_set');
    expect(expandByQuantity(set).map((c) => c.code)).toEqual([
      '99001',
      '99001',
      '99002',
      '99002',
      '99002',
    ]);
  });
});

describe('fetch', () => {
  it('builds urls per language', () => {
    expect(packUrl('en', 'core_2026')).toBe(
      'https://arkhamdb.com/api/public/cards/core_2026.json?encounter=1',
    );
    expect(packUrl('de', 'core_2026')).toContain('https://de.arkhamdb.com/');
  });
});
