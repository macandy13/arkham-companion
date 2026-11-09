import { describe, expect, it } from 'vitest';
import { isDoubleTap } from './useDoubleTap';

describe('isDoubleTap', () => {
  it.each([
    { last: undefined, now: 100, double: false, why: 'the first tap' },
    { last: 1000, now: 1200, double: true, why: '200 ms after the first' },
    { last: 1000, now: 1350, double: true, why: '350 ms after the first, the longest pause' },
    { last: 1000, now: 1351, double: false, why: '351 ms after the first, too slow' },
  ])('is $double for $why', ({ last, now, double }) => {
    expect(isDoubleTap(last, now)).toBe(double);
  });
});
