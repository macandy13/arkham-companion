// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { scenarioId } from '@arkham/engine';
import { CoverArt } from './CoverArt';

describe('CoverArt', () => {
  afterEach(cleanup);

  it.each([
    {
      scenario: 'the-gathering',
      agenda: 'What’s Going On?!',
      href: 'https://arkhamdb.com/bundles/cards/01105.png',
    },
    {
      scenario: 'the-midnight-masks',
      agenda: 'Predator or Prey?',
      href: 'https://arkhamdb.com/bundles/cards/01121a.png',
    },
  ])('cuts the art of $scenario from its first agenda, $agenda', ({ scenario, href }) => {
    const { container } = render(<CoverArt scenarioId={scenarioId(scenario)} />);

    expect(container.querySelector('image')?.getAttribute('href')).toBe(href);
  });

  it('keeps a plain band for a scenario it does not know', () => {
    const { container } = render(<CoverArt scenarioId={scenarioId('lost-in-time')} />);

    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('image')).toBeNull();
  });
});
