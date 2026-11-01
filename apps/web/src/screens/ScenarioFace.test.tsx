// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { encounterSetCode } from '@arkham/engine';
import { ScenarioFace } from './ScenarioFace';

// The face is decoration without roles (aria-hidden), so its icon is found by its data attribute.
describe('ScenarioFace', () => {
  afterEach(cleanup);

  it.each([
    { set: encounterSetCode('torch'), icon: 'torch' },
    { set: undefined, icon: undefined },
  ] as const)('prints the set icon $icon on its medallion', ({ set, icon }) => {
    const { container } = render(<ScenarioFace set={set} />);

    expect(
      container.querySelector('[data-encounter-set]')?.getAttribute('data-encounter-set'),
    ).toBe(icon);
  });
});
