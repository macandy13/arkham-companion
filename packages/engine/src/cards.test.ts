import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardCode,
  encounterSetCode,
  cardDbFrom,
  cardDbWith,
  cardStats,
  comparableName,
  fixed,
  investigatorCardStats,
  investigatorCode,
  resolveValue,
  trait,
} from './index';

describe('cardDbFrom', () => {
  it('looks up a definition by code', () => {
    const location = blankLocation('loc', { shroud: 4 });
    const cards = cardDbFrom([location]);

    const stats = cards.get(cardCode('loc'));

    expect(stats?.shroud).toBe(4);
  });

  it('returns undefined for an unknown code', () => {
    const cards = cardDbFrom([blankTreachery('known')]);

    expect(cards.get(cardCode('unknown'))).toBeUndefined();
  });

  it('lets a later definition replace an earlier one with the same code', () => {
    const cards = cardDbFrom([
      blankLocation('loc', { shroud: 1 }),
      blankLocation('loc', { shroud: 3 }),
    ]);

    expect(cards.get(cardCode('loc'))?.shroud).toBe(3);
  });

  it('keeps alternative cards of the same stage apart by variant', () => {
    const cards = cardDbFrom([
      blankAct('act2a', { stage: { number: 2 } }),
      blankAct('act2c', { stage: { number: 2, variant: 'c' } }),
    ]);

    expect(cards.get(cardCode('act2a'))?.stage).toEqual({ number: 2 });
    expect(cards.get(cardCode('act2c'))?.stage).toEqual({ number: 2, variant: 'c' });
  });

  it('keeps traits as given', () => {
    const cards = cardDbFrom([blankEnemy('ghoul', { traits: [trait('Monster')] })]);

    expect(cards.get(cardCode('ghoul'))?.traits).toEqual(['Monster']);
  });

  it('lists the definitions of an encounter set', () => {
    const cards = cardDbFrom([
      blankTreachery('a', { encounterCode: encounterSetCode('cult') }),
      blankTreachery('b', { encounterCode: encounterSetCode('rats') }),
      blankTreachery('c', { encounterCode: encounterSetCode('cult') }),
    ]);

    const codes = cards.encounterSet(encounterSetCode('cult')).map((def) => def.code);

    expect(codes).toEqual(['a', 'c']);
  });

  it('lists nothing for an unknown encounter set', () => {
    const cards = cardDbFrom([blankTreachery('a', { encounterCode: encounterSetCode('cult') })]);

    expect(cards.encounterSet(encounterSetCode('unknown'))).toEqual([]);
  });
});

describe('cardDbWith', () => {
  const scenarioCards = cardDbFrom([
    blankLocation('study'),
    blankEnemy('rat', { encounterCode: encounterSetCode('rats') }),
  ]);

  it('finds the cards of both the base and the extra cards', () => {
    const cards = cardDbWith(scenarioCards, [
      investigatorCardStats({
        code: investigatorCode('roland'),
        name: 'roland',
        health: 9,
        sanity: 5,
        skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
      }),
    ]);

    expect([
      cards.get(cardCode('study'))?.typeCode,
      cards.get(cardCode('roland'))?.typeCode,
    ]).toEqual(['location', 'investigator']);
  });

  it('lets an extra card replace a base card with the same code, in encounter sets too', () => {
    const cards = cardDbWith(scenarioCards, [
      blankEnemy('rat', { name: 'Big Rat', encounterCode: encounterSetCode('rats') }),
    ]);

    expect(cards.get(cardCode('rat'))?.name).toBe('Big Rat');
    expect(cards.encounterSet(encounterSetCode('rats')).map((card) => card.name)).toEqual([
      'Big Rat',
    ]);
  });
});

describe('cardStats', () => {
  it('reads an agenda doom threshold through the card db', () => {
    const cards = cardDbFrom([blankAgenda('agenda', fixed(6))]);

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
