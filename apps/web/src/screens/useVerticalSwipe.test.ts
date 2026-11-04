import { describe, expect, it } from 'vitest';
import { swipeDirection } from './useVerticalSwipe';

describe('swipeDirection', () => {
  const start = { x: 100, y: 300 };

  it.each([
    { touch: 'a swipe 60 px down', end: { x: 110, y: 360 }, direction: 'down' },
    { touch: 'a swipe 60 px up', end: { x: 90, y: 240 }, direction: 'up' },
    { touch: 'a tap that slides 20 px down', end: { x: 100, y: 320 }, direction: undefined },
    {
      touch: 'a sideways swipe 80 px across, 50 down',
      end: { x: 180, y: 350 },
      direction: undefined,
    },
  ])('reads $touch as $direction', ({ end, direction }) => {
    expect(swipeDirection(start, end)).toBe(direction);
  });
});
