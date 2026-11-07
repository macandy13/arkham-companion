// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { campaignDefinitionId, scenarioId } from '@arkham/engine';
import { campaignKeyArt } from '../catalog/campaignKeyArt';
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
  it('lays the key art of Night of the Zealot’s box over the agenda art', () => {
    const keyArt = campaignKeyArt(campaignDefinitionId('night-of-the-zealot'));
    const { container } = render(
      <CoverArt scenarioId={scenarioId('the-gathering')} keyArt={keyArt} />,
    );

    expect(
      [...container.querySelectorAll('image')].map((image) => image.getAttribute('href')),
    ).toEqual([
      'https://arkhamdb.com/bundles/cards/01105.png',
      'https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/image-converter/2026/09/FFG_AHC60_Hero-Slider.webp',
    ]);
  });

  it.each([
    { event: 'load', band: 'shown' },
    { event: 'error', band: null },
  ] as const)('shows the band once the key art fires $event: $band', ({ event, band }) => {
    const { container } = render(
      <CoverArt
        scenarioId={scenarioId('lost-in-time')}
        keyArt="https://example.com/key_art.webp"
      />,
    );
    const keyArt = container.querySelector('image')!;

    fireEvent[event](keyArt);

    expect(container.firstElementChild?.getAttribute('data-picture')).toBe(band);
  });
});
