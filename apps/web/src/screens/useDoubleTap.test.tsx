// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOUBLE_TAP_MS, isDoubleTap, useDoubleTap } from './useDoubleTap';

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

describe('useDoubleTap with a single tap of its own', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  /** A button that logs "single" for a single tap and "double" for a double tap. */
  function Tapped({ log }: { log: string[] }) {
    const tap = useDoubleTap(
      () => log.push('double'),
      () => log.push('single'),
    );
    return (
      <button type="button" onClick={tap}>
        Tile
      </button>
    );
  }

  it.each([
    { taps: 1, logged: ['single'] },
    { taps: 2, logged: ['double'] },
  ])('logs $logged for $taps quick taps, once no further tap came', ({ taps, logged }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const log: string[] = [];
    render(<Tapped log={log} />);

    for (let tap = 0; tap < taps; tap++) fireEvent.click(screen.getByRole('button'));
    act(() => vi.advanceTimersByTime(DOUBLE_TAP_MS));

    expect(log).toEqual(logged);
  });
});
