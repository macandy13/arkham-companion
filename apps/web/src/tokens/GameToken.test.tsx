// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameToken } from './GameToken';

describe('GameToken', () => {
  afterEach(cleanup);

  it('names the token for screen readers and writes its count in the disc', () => {
    render(<GameToken kind="doom" count={3} label="Doom 3" />);

    const token = screen.getByRole('img', { name: 'Doom 3' });
    expect(token.dataset.gameToken).toBe('doom');
    expect(token.querySelector('data')?.value).toBe('3');
  });

  it('has no count disc without a count', () => {
    render(<GameToken kind="clue" label="Clue" />);

    expect(screen.getByRole('img', { name: 'Clue' }).querySelector('data')).toBeNull();
  });

  it('is hidden from assistive technology without a label', () => {
    const { container } = render(<GameToken kind="resource" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(
      container.querySelector('[data-game-token="resource"]')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
