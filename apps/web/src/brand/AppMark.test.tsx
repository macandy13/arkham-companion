// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppMark, Spinner } from './AppMark';

const ticks = (container: HTMLElement, state: 'lit' | 'next') =>
  [...container.querySelectorAll('line')].flatMap((line, i) =>
    line.hasAttribute(`data-${state}`) ? [i] : [],
  );

describe('AppMark', () => {
  afterEach(cleanup);

  it('lights every tick when no count is given', () => {
    const { container } = render(<AppMark />);

    expect(ticks(container, 'lit')).toHaveLength(36);
  });

  it.each([
    { lit: 0, firstLit: [], next: [0] },
    { lit: 3, firstLit: [0, 1, 2], next: [3] },
  ])('lights the first $lit ticks clockwise and marks the next', ({ lit, firstLit, next }) => {
    const { container } = render(<AppMark lit={lit} />);

    expect(ticks(container, 'lit')).toEqual(firstLit);
    expect(ticks(container, 'next')).toEqual(next);
  });
});

describe('Spinner', () => {
  afterEach(cleanup);

  it('lights a third of the ring', () => {
    const { container } = render(<Spinner />);

    expect(ticks(container, 'lit')).toHaveLength(12);
  });
});
