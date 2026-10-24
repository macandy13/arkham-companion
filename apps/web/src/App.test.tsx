// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { AppRoutes } from './App';
import { initI18n } from './i18n';
import { IndexedDbStore } from './storage/IndexedDbStore';
import { createAppStore } from './state/appStore';

function renderAt(path: string, store = createAppStore(new IndexedDbStore('app-routes-test'))) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes store={store} catalog={() => new Promise(() => undefined)} />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ['/', 'Games'],
    ['/new', 'New game'],
    ['/game/some-id', 'Arkham Companion'],
    ['/settings', 'Settings'],
  ])('shows the screen heading for %s', (path, heading) => {
    renderAt(path);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
  });

  it('offers main navigation on every screen', () => {
    renderAt('/settings');

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });

  it("offers the open game's export in the play screen's menu, under the game's title", async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const downloaded: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded.push(this.download);
    });
    const store = createAppStore(new IndexedDbStore('app-routes-export-test'));
    const id = await store.getState().startScenario({
      title: 'Friday night',
      ctx: { cards: theGatheringCards, scenario: theGathering },
      difficulty: 'easy',
      seed: 3,
      investigators: [],
    });
    renderAt(`/game/${id}`, store);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('navigation', { name: 'Main' });

    fireEvent.click(await within(menu).findByRole('button', { name: 'Export' }));

    await waitFor(() => expect(downloaded).toEqual(['Friday-night.arkham.json']));
    expect(screen.queryByRole('link', { name: 'Arkham Companion' })).toBeNull();
  });

  it('offers no export in the title bar away from a game', () => {
    renderAt('/settings');

    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
