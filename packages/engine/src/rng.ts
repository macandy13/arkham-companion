/**
 * Seeded PRNG: xoshiro128** (Blackman & Vigna), seeded via splitmix32.
 *
 * Why not `Math.random()` or `crypto.getRandomValues()`? Neither can be seeded
 * nor have their internal state saved and restored. The engine is event-sourced
 * (architecture §2, §6): undo, refresh recovery and bug reproduction all rebuild
 * the game by replaying, and "same state + same command = same events" must hold
 * for every shuffle and random draw. So the generator state has to live inside
 * `GameState` as plain serialisable data. xoshiro128** is small, fast, uses only
 * 32-bit integer maths (exact in JS) and has good statistical quality for games.
 *
 * The state is a plain tuple; all functions are pure and return the value
 * together with the next state.
 */
/** The four 32-bit words of xoshiro128** state; stored in `GameMeta.rngState`. */
export type RngState = readonly [number, number, number, number];

/** Expands a single seed into well-mixed words (recommended way to seed xoshiro). */
function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** Initial RNG state for a game seed. */
export function seedRng(seed: number): RngState {
  const next = splitmix32(seed);
  const state: [number, number, number, number] = [next(), next(), next(), next()];
  // xoshiro must not start from the all-zero state.
  if (state.every((v) => v === 0)) state[0] = 1;
  return state;
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** Next uniformly distributed unsigned 32-bit integer. */
export function nextU32(state: RngState): [number, RngState] {
  const [s0, s1, s2, s3] = state;
  const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  let n2 = (s2 ^ s0) >>> 0;
  let n3 = (s3 ^ s1) >>> 0;
  const n1 = (s1 ^ n2) >>> 0;
  const n0 = (s0 ^ n3) >>> 0;
  n2 = (n2 ^ t) >>> 0;
  n3 = rotl(n3, 11);
  return [result, [n0, n1, n2, n3]];
}

/** Uniform integer in `[0, bound)` without modulo bias. `bound` must be in 1..2^32. */
export function nextInt(state: RngState, bound: number): [number, RngState] {
  if (!Number.isInteger(bound) || bound < 1 || bound > 0x100000000) {
    throw new RangeError(`nextInt: invalid bound ${bound}`);
  }
  // Reject values from the incomplete last bucket.
  const limit = 0x100000000 - (0x100000000 % bound);
  let s = state;
  for (;;) {
    const [v, next] = nextU32(s);
    s = next;
    if (v < limit) return [v % bound, s];
  }
}

/** Fisher–Yates shuffle; returns a new array and the advanced RNG state. */
export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(s, i + 1);
    s = next;
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return [out, s];
}
