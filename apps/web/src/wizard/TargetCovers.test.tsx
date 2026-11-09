// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../i18n';
import { TargetCovers } from './TargetCovers';
import { defaultChoices } from './wizardState';

describe('TargetCovers', () => {
  beforeAll(() => initI18n('en'));
  afterEach(cleanup);

  it.each([
    { name: 'The Gathering', kicker: 'Night of the Zealot' },
    { name: 'Spreading Flames', kicker: 'Standalone' },
  ])('names the cover of $name and describes it as $kicker', ({ name, kicker }) => {
    render(<TargetCovers choices={defaultChoices('quick')} onChange={() => {}} />);

    const radio = screen.getByRole('radio', { name });
    expect(document.getElementById(radio.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      kicker,
    );
  });

  it("describes a campaign's cover by its length", () => {
    render(<TargetCovers choices={defaultChoices('campaign')} onChange={() => {}} />);

    const radio = screen.getByRole('radio', { name: 'Night of the Zealot' });
    expect(document.getElementById(radio.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      '3 scenarios',
    );
  });

  it('hides the Night of the Zealot scenarios without its packs, keeps the standalone ones', () => {
    render(
      <TargetCovers
        choices={defaultChoices('quick')}
        ownedPacks={new Set(['dwl'])}
        onChange={() => {}}
      />,
    );

    expect(screen.getAllByRole('radio')).toEqual([
      screen.getByRole('radio', { name: 'Spreading Flames' }),
      screen.getByRole('radio', { name: 'Smoke and Mirrors' }),
    ]);
  });

  it('chooses the cover tapped', () => {
    const onChange = vi.fn();
    render(<TargetCovers choices={defaultChoices('quick')} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'The Midnight Masks' }));

    expect(onChange).toHaveBeenCalledWith({ targetId: 'the-midnight-masks' });
  });
});
