import { describe, expect, it } from 'vitest';
import { investigatorCode } from './ids';
import { investigatorDbFrom, type InvestigatorCard } from './investigator_cards';

describe('investigatorDbFrom', () => {
  const roland: InvestigatorCard = {
    code: investigatorCode('01001'),
    name: 'Roland Banks',
    health: 9,
    sanity: 5,
    skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
  };

  it('looks up a card by code', () => {
    expect(investigatorDbFrom([roland]).get(roland.code)).toBe(roland);
  });

  it('returns undefined for an unknown code', () => {
    expect(investigatorDbFrom([roland]).get(investigatorCode('unknown'))).toBeUndefined();
  });

  it('lets a later card replace an earlier one with the same code', () => {
    const reprintedRoland = { ...roland, name: 'Roland Banks (reprint)' };
    expect(investigatorDbFrom([roland, reprintedRoland]).get(roland.code)).toBe(reprintedRoland);
  });
});
