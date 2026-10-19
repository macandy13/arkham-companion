import { describe, expect, it } from 'vitest';
import { listIfAny, withoutKey } from './index';

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
