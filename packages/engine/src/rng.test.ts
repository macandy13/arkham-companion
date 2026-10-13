import fc from 'fast-check';
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

  it('nextInt stays in range', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, bound) => {
        const [v] = nextInt(seedRng(seed), bound);
        return Number.isInteger(v) && v >= 0 && v < bound;
      }),
    );
  });

  it('rejects invalid bounds', () => {
    expect(() => nextInt(seedRng(1), 0)).toThrow(RangeError);
    expect(() => nextInt(seedRng(1), 1.5)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.integer()), (seed, items) => {
        const copy = items.slice();
        const [out] = shuffle(items, seedRng(seed));
        expect(items).toEqual(copy);
        expect(out.slice().sort()).toEqual(items.slice().sort());
      }),
    );
  });

  it('is reproducible from the same RNG state', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.string()), (seed, items) => {
        expect(shuffle(items, seedRng(seed))).toEqual(shuffle(items, seedRng(seed)));
      }),
    );
  });

  it('actually reorders (sanity check over many seeds)', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const distinct = new Set<string>();
    for (let seed = 0; seed < 50; seed++) distinct.add(shuffle(items, seedRng(seed))[0].join());
    expect(distinct.size).toBeGreaterThan(45);
  });
});
