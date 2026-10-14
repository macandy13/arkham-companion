import { describe, expect, it } from 'vitest';
import { withEntry } from './record';

describe('withEntry', () => {
  it('sets a new key', () => {
    expect(withEntry<Record<string, number>, string>({ a: 1 }, 'b', 2)).toEqual({ a: 1, b: 2 });
  });

  it('overwrites an existing key', () => {
    expect(withEntry<Record<string, number>, string>({ a: 1 }, 'a', 5)).toEqual({ a: 5 });
  });

  it('removes the key when the value is undefined', () => {
    const result = withEntry({ a: 1, b: 2 }, 'a', undefined);

    expect(result).toEqual({ b: 2 });
    expect('a' in result).toBe(false);
  });

  it('does not modify the input when removing a key', () => {
    const record = { a: 1 };

    withEntry(record, 'a', undefined);

    expect(record).toEqual({ a: 1 });
  });
});
