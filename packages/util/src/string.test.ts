import { describe, expect, it } from 'vitest';
import { splitTrimmed } from './string';

describe('splitTrimmed', () => {
  it('splits and trims each part', () => {
    expect(splitTrimmed('Humanoid. Monster.', '.')).toEqual(['Humanoid', 'Monster']);
  });

  it('drops empty parts', () => {
    expect(splitTrimmed('en,,de,', ',')).toEqual(['en', 'de']);
  });

  it('returns an empty list for empty text', () => {
    expect(splitTrimmed('', ',')).toEqual([]);
  });
});
