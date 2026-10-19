import { describe, expect, it } from 'vitest';
import { assertNever } from './index';

describe('assertNever', () => {
  it('throws naming the unexpected value', () => {
    // Simulates data from outside the type system that slipped past the union.
    const unexpected = { by: 'unknown' } as never;

    expect(() => assertNever(unexpected)).toThrow('Unhandled variant: {"by":"unknown"}');
  });
});
