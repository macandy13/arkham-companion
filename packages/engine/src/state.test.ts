import { describe, expect, expectTypeOf, it } from 'vitest';
import { CHAOS_TOKENS, type ChaosToken } from './state';

describe('CHAOS_TOKENS', () => {
  it('lists every chaos token once', () => {
    expectTypeOf<(typeof CHAOS_TOKENS)[number]>().toEqualTypeOf<ChaosToken>();
    expect(new Set(CHAOS_TOKENS).size).toBe(CHAOS_TOKENS.length);
  });
});
