import { describe, expect, it } from 'vitest';
import { duplicates, matchingFirst, range, unique, withoutFirst, withRunningTotals } from './index';

describe('duplicates', () => {
  it('lists each repeated item once', () => {
    const cultists = ['Herman Collins', 'Peter Warren', 'Herman Collins', 'Herman Collins'];

    expect(duplicates(cultists)).toEqual(['Herman Collins']);
  });

  it('is empty for a list without repeats', () => {
    expect(duplicates(['roland', 'daisy'])).toEqual([]);
  });

  it('is empty for an empty list', () => {
    expect(duplicates([])).toEqual([]);
  });
});

describe('unique', () => {
  it('keeps each item once, in the order it first occurs', () => {
    const bag = ['-1', 'skull', '-1', '0', 'skull'];

    expect(unique(bag)).toEqual(['-1', 'skull', '0']);
  });

  it('is empty for an empty list', () => {
    expect(unique([])).toEqual([]);
  });
});

describe('withoutFirst', () => {
  it('removes only the first copy of the item', () => {
    const bag = ['-1', 'skull', '-1'];

    expect(withoutFirst(bag, '-1')).toEqual(['skull', '-1']);
  });

  it('leaves an equal copy when the item is absent', () => {
    const bag = ['skull'];

    expect(withoutFirst(bag, 'cultist')).toEqual(['skull']);
  });

  it('leaves the original untouched', () => {
    const bag = ['skull', 'cultist'];

    withoutFirst(bag, 'skull');

    expect(bag).toEqual(['skull', 'cultist']);
  });
});

describe('withRunningTotals', () => {
  it('adds each value to the total so far', () => {
    const payments = [{ amount: 3 }, { amount: 1 }, { amount: -2 }];

    expect(withRunningTotals(payments, (payment) => payment.amount)).toEqual([
      { amount: 3, total: 3 },
      { amount: 1, total: 4 },
      { amount: -2, total: 2 },
    ]);
  });

  it('starts from the given total', () => {
    const payments = [{ amount: 1 }, { amount: -2 }];

    expect(withRunningTotals(payments, (payment) => payment.amount, 4)).toEqual([
      { amount: 1, total: 5 },
      { amount: -2, total: 3 },
    ]);
  });

  it('leaves the items untouched', () => {
    const payments = [{ amount: 3 }];

    withRunningTotals(payments, (payment) => payment.amount);

    expect(payments).toEqual([{ amount: 3 }]);
  });

  it('is empty for an empty list', () => {
    expect(withRunningTotals([], () => 1, 4)).toEqual([]);
  });
});

describe('range', () => {
  it.each([
    { count: 3, numbers: [0, 1, 2] },
    { count: 1, numbers: [0] },
    { count: 0, numbers: [] },
  ])('counts $count numbers from 0', ({ count, numbers }) => {
    expect(range(count)).toEqual(numbers);
  });
});

describe('matchingFirst', () => {
  it.each<{ items: string[]; first: string; expected: string[] }>([
    {
      items: ['agnes', 'roland', 'daisy'],
      first: 'roland',
      expected: ['roland', 'agnes', 'daisy'],
    },
    { items: ['agnes', 'daisy'], first: 'roland', expected: ['agnes', 'daisy'] },
    { items: [], first: 'roland', expected: [] },
  ])('puts $first ahead of $items', ({ items, first, expected }) => {
    expect(matchingFirst(items, (item) => item === first)).toEqual(expected);
  });
});
