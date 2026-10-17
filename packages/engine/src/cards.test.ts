import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardCode,
  cardDbFrom,
  cardDbWith,
  cardStats,
  comparableName,
  resolveValue,
  trait,
  type CardStats,
} from './index';

/**
 * A card definition with boring defaults; tests pass only the fields they
 * assert on. Takes the code as a plain string so card tables stay readable.
 */
function makeCard(overrides: Partial<Omit<CardStats, 'code'>> & { code: string }): CardStats {
  return {
    name: overrides.code,
    typeCode: 'treachery',
    traits: [],
    ...overrides,
    code: cardCode(overrides.code),
  };
}

describe('cardDbFrom', () => {
  it('looks up a definition by code', () => {
    const location = makeCard({ code: 'loc', typeCode: 'location', shroud: 4 });
    const cards = cardDbFrom([location]);

    const stats = cards.get(cardCode('loc'));

    expect(stats?.shroud).toBe(4);
  });

  it('returns undefined for an unknown code', () => {
    const cards = cardDbFrom([makeCard({ code: 'known' })]);

    expect(cards.get(cardCode('unknown'))).toBeUndefined();
  });

  it('lets a later definition replace an earlier one with the same code', () => {
    const cards = cardDbFrom([
      makeCard({ code: 'loc', shroud: 1 }),
      makeCard({ code: 'loc', shroud: 3 }),
    ]);

    expect(cards.get(cardCode('loc'))?.shroud).toBe(3);
  });

  it('keeps alternative cards of the same stage apart by variant', () => {
    const cards = cardDbFrom([
      makeCard({ code: 'act2a', typeCode: 'act', stage: { number: 2 } }),
      makeCard({ code: 'act2c', typeCode: 'act', stage: { number: 2, variant: 'c' } }),
    ]);

    expect(cards.get(cardCode('act2a'))?.stage).toEqual({ number: 2 });
    expect(cards.get(cardCode('act2c'))?.stage).toEqual({ number: 2, variant: 'c' });
  });

  it('keeps traits as given', () => {
    const cards = cardDbFrom([makeCard({ code: 'ghoul', traits: [trait('Monster')] })]);

    expect(cards.get(cardCode('ghoul'))?.traits).toEqual(['Monster']);
  });

  it('lists the definitions of an encounter set', () => {
    const cards = cardDbFrom([
      makeCard({ code: 'a', encounterCode: 'cult' }),
      makeCard({ code: 'b', encounterCode: 'rats' }),
      makeCard({ code: 'c', encounterCode: 'cult' }),
    ]);

    const codes = cards.encounterSet('cult').map((def) => def.code);

    expect(codes).toEqual(['a', 'c']);
  });

  it('lists nothing for an unknown encounter set', () => {
    const cards = cardDbFrom([makeCard({ code: 'a', encounterCode: 'cult' })]);

    expect(cards.encounterSet('unknown')).toEqual([]);
  });
});

describe('cardDbWith', () => {
  const scenarioCards = cardDbFrom([
    makeCard({ code: 'study', typeCode: 'location' }),
    makeCard({ code: 'rat', typeCode: 'enemy', encounterCode: 'rats' }),
  ]);

  it('finds the cards of both the base and the extra cards', () => {
    const cards = cardDbWith(scenarioCards, [
      makeCard({ code: 'roland', typeCode: 'investigator' }),
    ]);

    expect([
      cards.get(cardCode('study'))?.typeCode,
      cards.get(cardCode('roland'))?.typeCode,
    ]).toEqual(['location', 'investigator']);
  });

  it('lets an extra card replace a base card with the same code, in encounter sets too', () => {
    const cards = cardDbWith(scenarioCards, [
      makeCard({ code: 'rat', name: 'Big Rat', typeCode: 'enemy', encounterCode: 'rats' }),
    ]);

    expect(cards.get(cardCode('rat'))?.name).toBe('Big Rat');
    expect(cards.encounterSet('rats').map((card) => card.name)).toEqual(['Big Rat']);
  });
});

describe('cardStats', () => {
  it('reads an agenda doom threshold through the card db', () => {
    const cards = cardDbFrom([
      makeCard({ code: 'agenda', typeCode: 'agenda', doom: { fixed: 6, perInvestigator: 0 } }),
    ]);

    const doom = cardStats(cards, cardCode('agenda')).doom;

    expect(doom).toEqual({ fixed: 6, perInvestigator: 0 });
  });

  it('rejects an unknown code', () => {
    const cards = cardDbFrom([]);

    const lookup = () => cardStats(cards, cardCode('nope'));

    expect(lookup).toThrow(CommandRejected);
    expect(lookup).toThrow('no card definition for code nope');
  });
});

describe('resolveValue', () => {
  it('keeps a fixed value regardless of player count', () => {
    expect(resolveValue({ fixed: 3, perInvestigator: 0 }, 4)).toBe(3);
  });

  it('scales a per-investigator value with the player count', () => {
    expect(resolveValue({ fixed: 0, perInvestigator: 2 }, 3)).toBe(6);
  });

  it('adds the fixed part to the scaled part', () => {
    expect(resolveValue({ fixed: 3, perInvestigator: 2 }, 4)).toBe(11);
  });
});

describe('comparableName', () => {
  it.each([
    { name: 'ignores case', text: 'Most Clues', expected: 'most clues' },
    { name: 'strips a trailing dot', text: 'Attic.', expected: 'attic' },
    { name: 'trims before stripping the dot', text: '  Attic. ', expected: 'attic' },
    { name: 'keeps inner dots', text: 'St. Mary', expected: 'st. mary' },
  ])('$name', ({ text, expected }) => {
    expect(comparableName(text)).toEqual(expected);
  });
});
