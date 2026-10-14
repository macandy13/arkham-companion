import { describe, expect, it } from 'vitest';
import { insertedAt, without } from './array';

describe('without', () => {
  it('removes every occurrence of the item', () => {
    expect(without(['a', 'b', 'a'], 'a')).toEqual(['b']);
  });

  it('returns an equal copy when the item is absent', () => {
    const items = ['a', 'b'];

    const result = without(items, 'c');

    expect(result).toEqual(['a', 'b']);
    expect(result).not.toBe(items);
  });
});

describe('insertedAt', () => {
  it('inserts at the given index', () => {
    expect(insertedAt(['a', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });

  it('inserts at the front for index 0', () => {
    expect(insertedAt(['b'], 'a', 0)).toEqual(['a', 'b']);
  });

  it('appends when no index is given', () => {
    expect(insertedAt(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('does not modify the input', () => {
    const items = ['a'];

    insertedAt(items, 'b');

    expect(items).toEqual(['a']);
  });
});
