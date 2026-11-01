// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardStrip } from './CardStrip';

/** A strip of `names` showing `shown` cards side by side. */
const renderStrip = (names: readonly string[], shown: number) =>
  render(
    <CardStrip label="Pile" shown={shown} earlierLabel="Earlier cards" laterLabel="Later cards">
      {names.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </CardStrip>,
  );

describe('CardStrip', () => {
  afterEach(cleanup);

  it('lists its cards under its label', () => {
    renderStrip(['Ghoul Minion', 'Rotting Remains'], 3);

    const strip = screen.getByRole('list', { name: 'Pile' });
    expect(
      within(strip)
        .getAllByRole('listitem')
        .map((card) => card.textContent),
    ).toEqual(['Ghoul Minion', 'Rotting Remains']);
  });

  it.each([
    { cards: ['Ghoul Minion', 'Rotting Remains', 'Grasping Hands'], arrows: [] },
    {
      cards: ['Ghoul Minion', 'Rotting Remains', 'Grasping Hands', 'Frozen in Fear'],
      arrows: ['Earlier cards', 'Later cards'],
    },
  ])('shows arrows with $cards.length cards only past three', ({ cards, arrows }) => {
    renderStrip(cards, 3);

    expect(
      screen.queryAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(arrows);
  });

  it.each([
    { arrow: 'Earlier cards', left: -80 },
    { arrow: 'Later cards', left: 80 },
  ])('scrolls by one card width with $arrow', ({ arrow, left }) => {
    renderStrip(['Ghoul Minion', 'Rotting Remains', 'Grasping Hands', 'Frozen in Fear'], 3);
    const strip = screen.getByRole('list', { name: 'Pile' });
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;
    Object.defineProperty(strip.firstElementChild, 'offsetWidth', { value: 80 });

    fireEvent.click(screen.getByRole('button', { name: arrow }));

    expect(scrollBy).toHaveBeenCalledWith({ left, behavior: 'smooth' });
  });
});
