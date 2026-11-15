import { describe, expect, it } from 'vitest';
import { buildWeaknesses } from './weakness_parsing';

// Hand-written fake data – never real card text.
const rawCard = (overrides: Record<string, unknown>) => ({
  name: 'Fake Card',
  pack_code: 'old_core',
  position: 1,
  ...overrides,
});

const fakeStalker = rawCard({
  code: '9101',
  name: 'Fake Stalker',
  type_code: 'enemy',
  subtype_code: 'basicweakness',
  traits: 'Humanoid. Fake.',
  text: 'Hunter.',
  enemy_fight: 4,
  enemy_evade: 3,
  health: 3,
  enemy_damage: 1,
  enemy_horror: 1,
});
const fakeGrudge = rawCard({
  code: '9007',
  name: 'Fake Grudge',
  type_code: 'treachery',
  subtype_code: 'weakness',
  restrictions: { investigator: { '9001': '9001' } },
  text: 'Revelation - Put Fake Grudge into play in your threat area.',
});

describe('buildWeaknesses', () => {
  it('keeps a basic weakness enemy with its stats and keywords', () => {
    expect(buildWeaknesses([fakeStalker])).toEqual([
      expect.objectContaining({
        code: '9101',
        name: 'Fake Stalker',
        typeCode: 'enemy',
        basic: true,
        traits: ['Humanoid', 'Fake'],
        fight: 4,
        evade: 3,
        health: 3,
        damage: 1,
        horror: 1,
        keywords: [{ name: 'hunter' }],
      }),
    ]);
  });

  it('keeps a signature weakness treachery with its investigator and threat area', () => {
    expect(buildWeaknesses([fakeGrudge])).toEqual([
      expect.objectContaining({
        code: '9007',
        typeCode: 'treachery',
        basic: false,
        signatureOf: ['9001'],
        entersThreatArea: true,
      }),
    ]);
  });

  it.each([
    {
      name: 'an asset weakness',
      card: rawCard({ code: '9102', type_code: 'asset', subtype_code: 'weakness' }),
    },
    { name: 'an encounter enemy', card: rawCard({ code: '9103', type_code: 'enemy' }) },
    {
      name: 'a reprint',
      card: { ...fakeStalker, code: '9201', duplicate_of_code: '9101' },
    },
  ])('leaves out $name', ({ card }) => {
    expect(buildWeaknesses([card])).toEqual([]);
  });

  it('sorts by code', () => {
    expect(buildWeaknesses([fakeStalker, fakeGrudge]).map((weakness) => weakness.code)).toEqual([
      '9007',
      '9101',
    ]);
  });
});
