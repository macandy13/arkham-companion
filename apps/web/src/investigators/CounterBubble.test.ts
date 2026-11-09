import { describe, expect, it } from 'vitest';
import { lengthInPixels } from './CounterBubble';

describe('lengthInPixels', () => {
  it.each([
    { length: '0.5rem', rootFontSize: 16, pixels: 8 },
    { length: ' 0.5rem', rootFontSize: 20, pixels: 10 },
    { length: '12px', rootFontSize: 16, pixels: 12 },
  ])(
    'is $pixels for $length at a root font size of $rootFontSize',
    ({ length, rootFontSize, pixels }) => {
      expect(lengthInPixels(length, rootFontSize)).toBe(pixels);
    },
  );
});
