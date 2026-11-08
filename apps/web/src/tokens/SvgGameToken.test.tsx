// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SvgGameToken } from './SvgGameToken';

describe('SvgGameToken', () => {
  afterEach(cleanup);

  it('carries the plain face of each token set, for the stylesheet to show the chosen one', () => {
    const { container } = render(
      <svg>
        <SvgGameToken kind="damage" centre={{ x: 50, y: 50 }} radius={10} />
      </svg>,
    );

    const faces = [...container.querySelectorAll('[data-svg-game-token="damage"] > image')];
    expect(faces.map((face) => face.getAttribute('data-token-face'))).toEqual([
      'resin',
      'cardboard',
    ]);
    // Each set draws its own face; tests may get them inlined rather than as file URLs.
    expect(new Set(faces.map((face) => face.getAttribute('href'))).size).toBe(2);
  });

  it.each([
    { count: 3, disc: '3' },
    { count: 0, disc: '0' },
    { count: undefined, disc: undefined },
  ])('writes the count $count in its disc', ({ count, disc }) => {
    const { container } = render(
      <svg>
        <SvgGameToken kind="clue" centre={{ x: 50, y: 50 }} radius={10} count={count} />
      </svg>,
    );

    expect(container.querySelector('[data-part="count"]')?.textContent).toBe(disc);
  });
});
