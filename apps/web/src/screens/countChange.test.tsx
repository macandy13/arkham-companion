// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { deltaText, useCountChange, type CountChange } from './countChange';

/** Hands each render's `useCountChange` of `count` to `seen`. */
function Probe({ count, seen }: { count: number; seen: (change?: CountChange) => void }) {
  seen(useCountChange(count));
  return null;
}

/** The change `useCountChange` reports last, once `counts` were shown one after another. */
function lastChangeWhile(counts: readonly number[]): CountChange | undefined {
  let last: CountChange | undefined;
  const { rerender } = render(<Probe count={counts[0] ?? 0} seen={() => {}} />);
  for (const count of counts.slice(1)) {
    rerender(<Probe count={count} seen={(change) => (last = change)} />);
  }
  return last;
}

describe('useCountChange', () => {
  afterEach(cleanup);

  it('has none for the count first shown', () => {
    const changes: (CountChange | undefined)[] = [];

    render(<Probe count={3} seen={(change) => changes.push(change)} />);

    expect(changes).toEqual([undefined]);
  });

  it.each([
    ['3 then 4', [3, 4], { delta: 1, key: 1 }],
    ['3, 4 then 2: a new key for the second change', [3, 4, 2], { delta: -2, key: 2 }],
    ['3, 4 and 4 again: the last change kept', [3, 4, 4], { delta: 1, key: 1 }],
  ])('reports %s as %o', (_counts, counts, change) => {
    expect(lastChangeWhile(counts)).toEqual(change);
  });
});

describe('deltaText', () => {
  it.each([
    [{ delta: 1, key: 1 }, '+1'],
    [{ delta: -2, key: 1 }, '−2'],
    [undefined, undefined],
  ])('reads %o as %s', (change, text) => {
    expect(deltaText(change)).toBe(text);
  });
});
