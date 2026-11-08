// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PipRing } from './PipRing';

describe('PipRing', () => {
  afterEach(cleanup);

  it.each([
    { max: 9, taken: 0, marks: '.........' },
    { max: 9, taken: 3, marks: '......xxx' },
    { max: 5, taken: 5, marks: 'xxxxx' },
    { max: 0, taken: 0, marks: '' },
  ])('draws $max pips with the last $taken taken: $marks', ({ max, taken, marks }) => {
    const { container } = render(
      <svg>
        <PipRing max={max} taken={taken} radius={17} />
      </svg>,
    );

    const pips = [...container.querySelectorAll('[data-pips] path')];
    expect(pips.map((pip) => (pip.hasAttribute('data-taken') ? 'x' : '.')).join('')).toBe(marks);
  });

  it('starts the first pip at the top and goes clockwise', () => {
    const { container } = render(
      <svg>
        <PipRing max={4} taken={0} radius={10} />
      </svg>,
    );

    // A quarter each with 12° gaps: the first runs from 6° to 84°, right of the top.
    const first = container.querySelector('[data-pips] path')?.getAttribute('d');
    expect(first).toBe('M 1.05 -9.95 A 10 10 0 0 1 9.95 -1.05');
  });
});
