import { describe, expect, it } from 'vitest';
import { LANDSCAPE_SCAN, PORTRAIT_SCAN } from './cardArt';
import { skyStars } from './cardFace';

/** The (x, y) points of a path of `M`, `L` and `Z` commands, as `starPath` draws a star. */
function points(d: string): { x: number; y: number }[] {
  const numbers = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
  return Array.from({ length: numbers.length / 2 }, (_, index) => ({
    x: numbers[2 * index] ?? NaN,
    y: numbers[2 * index + 1] ?? NaN,
  }));
}

describe('skyStars', () => {
  it('draws one star per count', () => {
    expect(skyStars(PORTRAIT_SCAN, 5).match(/M/g)).toHaveLength(5);
  });

  it.each([
    { card: 'portrait', scan: PORTRAIT_SCAN },
    { card: 'landscape', scan: LANDSCAPE_SCAN },
  ])('scatters the stars over every quarter of a $card card, all on the card', ({ scan }) => {
    const stars = points(skyStars(scan));
    const pad = 3;
    const quarters = new Set(
      stars.map(
        ({ x, y }) =>
          `${x < scan.width / 2 ? 'left' : 'right'} ${y < scan.height / 2 ? 'top' : 'bottom'}`,
      ),
    );

    expect(quarters).toEqual(new Set(['left top', 'right top', 'left bottom', 'right bottom']));
    for (const { x, y } of stars) {
      expect(x).toBeGreaterThan(-pad);
      expect(x).toBeLessThan(scan.width + pad);
      expect(y).toBeGreaterThan(-pad);
      expect(y).toBeLessThan(scan.height + pad);
    }
  });
});
