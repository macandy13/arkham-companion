// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../i18n';
import { Startup, type StartupTasks } from './Startup';

/** A start-up step that finishes when the test says so. */
function pending() {
  let finish: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { task: () => promise, finish, fail };
}

function renderStartup(tasks: StartupTasks) {
  render(
    <Startup tasks={tasks}>
      <p>The home screen</p>
    </Startup>,
  );
}

const doneSteps = () =>
  screen
    .getAllByRole('listitem')
    .filter((step) => step.hasAttribute('data-done'))
    .map((step) => step.textContent);

describe('Startup', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('shows the loading screen with no step done while both run', () => {
    renderStartup({ games: pending().task, cards: pending().task });

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      'Your games',
      'Card data',
    ]);
    expect(screen.queryByText('The home screen')).toBeNull();
  });

  it('ticks off a finished step and lights half the ring', async () => {
    const games = pending();
    renderStartup({ games: games.task, cards: pending().task });

    await act(async () => games.finish());

    expect(doneSteps()).toEqual(['Your games']);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(document.querySelectorAll('line[data-lit]')).toHaveLength(18);
  });

  it('opens the app once every step has finished', async () => {
    const games = pending();
    const cards = pending();
    renderStartup({ games: games.task, cards: cards.task });

    await act(async () => {
      games.finish();
      cards.finish();
    });

    expect(screen.getByText('The home screen')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('opens the app when the card data fails, as on a first start offline', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const games = pending();
    const cards = pending();
    renderStartup({ games: games.task, cards: cards.task });

    await act(async () => {
      games.finish();
      cards.fail(new Error('offline'));
    });

    expect(screen.getByText('The home screen')).toBeTruthy();
    expect(warn).toHaveBeenCalledWith('Start-up step "cards" failed.', new Error('offline'));
    warn.mockRestore();
  });
});
