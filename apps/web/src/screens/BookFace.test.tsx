// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { encounterSetCode } from '@arkham/engine';
import { BookFace } from './BookFace';

// The face is decoration without roles (aria-hidden), so its parts are found by `data-part`.
describe('BookFace', () => {
  afterEach(cleanup);

  it.each([
    { kind: 'agenda', threshold: 7, printed: '7' },
    { kind: 'act', threshold: 2, printed: '2' },
  ] as const)(
    "prints the $kind's threshold of $threshold on its disc",
    ({ kind, threshold, printed }) => {
      const { container } = render(
        <BookFace kind={kind} picture={undefined} threshold={threshold} set={undefined} />,
      );

      expect(container.querySelector('svg[data-face] text')?.textContent).toBe(printed);
    },
  );

  it('prints no number on the disc of an act without a clue threshold', () => {
    const { container } = render(
      <BookFace kind="act" picture={undefined} threshold={undefined} set={undefined} />,
    );

    expect(container.querySelector('svg[data-face] text')).toBeNull();
  });

  it.each([
    { kind: 'agenda', handles: 0, discX: '205' },
    { kind: 'act', handles: 1, discX: '214' },
  ] as const)(
    'draws the $kind with its disc at x $discX and $handles magnifier handles',
    ({ kind, handles, discX }) => {
      const { container } = render(
        <BookFace kind={kind} picture={undefined} threshold={3} set={undefined} />,
      );

      expect(container.querySelector('[data-part="disc"]')?.getAttribute('cx')).toBe(discX);
      expect(container.querySelectorAll('[data-part="handle"]')).toHaveLength(handles);
    },
  );

  it.each([
    { set: encounterSetCode('torch'), icon: 'torch', rings: 0 },
    { set: undefined, icon: undefined, rings: 1 },
  ] as const)(
    "prints the set icon $icon between the title's brackets, a plain ring without one",
    ({ set, icon, rings }) => {
      const { container } = render(
        <BookFace kind="agenda" picture={undefined} threshold={3} set={set} />,
      );

      expect(
        container.querySelector('[data-encounter-set]')?.getAttribute('data-encounter-set'),
      ).toBe(icon);
      expect(container.querySelectorAll('[data-part="set-mark"]')).toHaveLength(rings);
    },
  );
});
