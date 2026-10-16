import { describe, expect, it } from 'vitest';
import { duplicates, withoutFirst } from './index';

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
