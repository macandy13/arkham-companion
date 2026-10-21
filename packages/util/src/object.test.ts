import { describe, expect, it } from 'vitest';
import { listIfAny, shallowEqual, withoutKey } from './index';

describe('withoutKey', () => {
  it('removes the key from the copy', () => {
    const turn = { investigatorId: 'roland', actionsTaken: 2 };

    expect(withoutKey(turn, 'actionsTaken')).toStrictEqual({ investigatorId: 'roland' });
  });

  it('leaves the original untouched', () => {
    const turn = { investigatorId: 'roland', actionsTaken: 2 };

    withoutKey(turn, 'actionsTaken');

    expect(turn).toStrictEqual({ investigatorId: 'roland', actionsTaken: 2 });
  });

  it('copies an object that lacks the optional key', () => {
    const meta: { round: number; turn?: string } = { round: 1 };

    expect(withoutKey(meta, 'turn')).toStrictEqual({ round: 1 });
  });
});

describe('listIfAny', () => {
  it.each([
    { list: [], expected: {} },
    { list: ['study'], expected: { cards: ['study'] } },
    { list: ['study', 'hallway'], expected: { cards: ['study', 'hallway'] } },
  ])('returns $expected for $list', ({ list, expected }) => {
    expect(listIfAny('cards', list)).toStrictEqual(expected);
  });

  it('returns a copy, not the list itself', () => {
    const list = ['study'];

    expect(listIfAny('cards', list).cards).not.toBe(list);
  });
});

describe('shallowEqual', () => {
  it.each([
    {
      name: 'the same keys and values',
      a: { kind: 'won', round: 2 },
      b: { round: 2, kind: 'won' },
      equal: true,
    },
    {
      name: 'a different value',
      a: { kind: 'won', round: 2 },
      b: { kind: 'won', round: 3 },
      equal: false,
    },
    {
      name: 'a key only one of them has',
      a: { kind: 'won' },
      b: { kind: 'won', round: 2 },
      equal: false,
    },
    {
      name: 'the same number of keys, but different ones',
      a: { kind: 'won', round: 2 },
      b: { kind: 'won', turn: 2 },
      equal: false,
    },
    {
      name: 'equal nested objects that are not the same object',
      a: { at: { row: 0 } },
      b: { at: { row: 0 } },
      equal: false,
    },
  ])('compares two objects with $name', ({ a, b, equal }) => {
    expect(shallowEqual<object>(a, b)).toBe(equal);
  });
});
