// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameToken } from './GameToken';

describe('GameToken', () => {
  afterEach(cleanup);

  it.each([
    { kind: 'clue', count: 2, label: '2 clues' },
    { kind: 'damage', count: 3, label: '3 damage' },
    { kind: 'horror', count: 1, label: '1 horror' },
    { kind: 'resource', count: 5, label: '5 resources' },
  ] as const)(
    'draws a $kind token named "$label" with $count in its disc',
    ({ kind, count, label }) => {
      render(<GameToken kind={kind} count={count} label={label} />);

      const token = screen.getByRole('img', { name: label });
      expect(token.getAttribute('data-game-token')).toBe(kind);
      expect(token.querySelector('[data-part="count"]')?.textContent).toBe(String(count));
    },
  );

  it('leaves the disc out without a count', () => {
    render(<GameToken kind="clue" label="Clue" />);

    expect(
      screen.getByRole('img', { name: 'Clue' }).querySelector('[data-part="count"]'),
    ).toBeNull();
  });

  it('gives each token gradients of its own, so two on a screen do not share their colours', () => {
    render(
      <>
        <GameToken kind="damage" label="Damage" />
        <GameToken kind="horror" label="Horror" />
      </>,
    );

    const fieldOf = (name: string) =>
      screen.getByRole('img', { name }).querySelector('[data-part="field"]')?.id;
    expect(fieldOf('Damage')).not.toBe(fieldOf('Horror'));
  });
});
