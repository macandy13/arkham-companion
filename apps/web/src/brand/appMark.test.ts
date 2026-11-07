import { describe, expect, it } from 'vitest';
import { appMarkSvg, MARK_TICKS } from './appMark';

describe('MARK_TICKS', () => {
  it('has one tick per ten degrees', () => {
    expect(MARK_TICKS).toHaveLength(36);
  });

  it('starts with a long tick straight up from the inner ring', () => {
    expect(MARK_TICKS[0]).toEqual({ x1: 50, y1: 12, x2: 50, y2: 4, long: true });
  });

  it.each([
    { tick: 1, long: false },
    { tick: 2, long: false },
    { tick: 3, long: true },
    { tick: 9, long: true },
  ])('makes every third tick long (tick $tick: $long)', ({ tick, long }) => {
    expect(MARK_TICKS[tick]?.long).toBe(long);
  });

  it('turns clockwise, so the quarter tick points right', () => {
    expect(MARK_TICKS[9]).toEqual({ x1: 88, y1: 50, x2: 96, y2: 50, long: true });
  });
});

describe('appMarkSvg', () => {
  it('draws the mark in the ink on the ground', () => {
    const svg = appMarkSvg({ ink: '#d9b86e', ground: '#0b1614' });

    expect(svg).toContain('<rect width="100" height="100" fill="#0b1614"/>');
    expect(svg).toContain('stroke="#d9b86e"');
  });

  it.each([
    { inset: 0, transform: 'translate(0 0) scale(1)' },
    { inset: 0.12, transform: 'translate(12 12) scale(0.76)' },
  ])('shrinks the mark into the middle for inset $inset', ({ inset, transform }) => {
    const svg = appMarkSvg({ ink: '#d9b86e', ground: '#0b1614', inset });

    expect(svg).toContain(`transform="${transform}"`);
  });
});
