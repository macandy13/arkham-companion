import { describe, expect, it } from 'vitest';
import { nextInt, nextU32, seedRng, shuffle, type RngState } from './rng';

describe('xoshiro128**', () => {
  it('matches the reference output for state [1, 2, 3, 4]', () => {
    let s: RngState = [1, 2, 3, 4];
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const [v, next] = nextU32(s);
      out.push(v);
      s = next;
    }
    expect(out).toEqual([11520, 0, 5927040]);
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(seedRng(42)).toEqual(seedRng(42));
    expect(seedRng(42)).not.toEqual(seedRng(43));
    expect(nextU32(seedRng(7))).toEqual(nextU32(seedRng(7)));
  });

  it.each([
    { seed: 0, bound: 1 },
    { seed: 1, bound: 2 },
    { seed: -5, bound: 6 },
    { seed: 2 ** 31 - 1, bound: 7 },
    { seed: -(2 ** 31), bound: 1000 },
    { seed: 123456, bound: 3 },
  ])('nextInt(seed $seed, bound $bound) is an integer in [0, bound)', ({ seed, bound }) => {
    const [v] = nextInt(seedRng(seed), bound);

    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(bound);
  });

  it('rejects invalid bounds', () => {
    expect(() => nextInt(seedRng(1), 0)).toThrow(RangeError);
    expect(() => nextInt(seedRng(1), 1.5)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it.each([
    { seed: 1, items: [] },
    { seed: 2, items: [7] },
    { seed: 3, items: [1, 2, 3, 4, 5] },
    { seed: -4, items: [3, 3, 1, 1, 2] },
    { seed: 2 ** 31 - 1, items: [0, -1, 10, 42, 5, 6, 7, 8] },
  ])('returns a permutation of $items (seed $seed) without mutating it', ({ seed, items }) => {
    const copy = items.slice();

    const [out] = shuffle(items, seedRng(seed));

    expect(items).toEqual(copy);
    expect(out.slice().sort()).toEqual(items.slice().sort());
  });

  it.each([
    { seed: 5, items: ['a', 'b', 'c', 'd'] },
    { seed: -9, items: ['x', 'x', 'y'] },
    { seed: 0, items: [] },
  ])('shuffles $items the same way twice from seed $seed', ({ seed, items }) => {
    expect(shuffle(items, seedRng(seed))).toEqual(shuffle(items, seedRng(seed)));
  });

  it('actually reorders (sanity check over many seeds)', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const distinct = new Set<string>();
    for (let seed = 0; seed < 50; seed++) distinct.add(shuffle(items, seedRng(seed))[0].join());
    expect(distinct.size).toBeGreaterThan(45);
  });
});
