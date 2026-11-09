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
    ['/', 'Arkham Companion'],
    ['/new', 'New game'],
    ['/game/some-id', 'Arkham Companion'],
    ['/settings', 'Settings'],
  ])('shows the screen heading for %s', (path, heading) => {
    renderAt(path);

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('opens the next screen at its top, however far the last one was scrolled', async () => {
    const page = document.documentElement;
    let scrollTop = 0;
    // jsdom lays nothing out, so it keeps no scroll position of its own.
    vi.spyOn(page, 'scrollTop', 'get').mockImplementation(() => scrollTop);
    vi.spyOn(page, 'scrollTop', 'set').mockImplementation((top) => {
      scrollTop = top;
    });
    renderAt('/settings');
    scrollTop = 400;

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Arkham Companion' })).toBeTruthy(),
    );
    expect(scrollTop).toBe(0);
  });

  it('offers main navigation on every screen', () => {
    renderAt('/settings');

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });

  it.each([
    { path: '/', bar: [], up: false },
    { path: '/settings', bar: ['Settings', 'For this device'], up: true },
    { path: '/new', bar: ['New game', 'A campaign or one scenario'], up: true },
    { path: '/new?mode=quick', bar: ['Quick game', 'One scenario, no campaign log'], up: true },
  ])('names $path in the app bar', ({ path, bar, up }) => {
    renderAt(path);
    const appBar = screen.getByRole('banner');

    expect(
      within(appBar)
        .queryAllByRole('paragraph')
        .map((line) => line.textContent),
    ).toEqual(bar);
    expect(within(appBar).queryByRole('link', { name: 'Back' }) !== null).toBe(up);
  });

  it.each([
    { path: '/settings', above: 'Arkham Companion' },
    { path: '/new?mode=campaign', above: 'New game' },
  ])("leads up from $path to the screen above it, '$above'", ({ path, above }) => {
    renderAt(path);

    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Back' }));

    expect(screen.getByRole('heading', { level: 1, name: above })).toBeTruthy();
  });

  it("opens a place from the app bar's menu and closes the menu on the way", () => {
    renderAt('/');

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings');
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
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
  });

  it('hides the app bar on the play screen', async () => {
    const store = createAppStore(new IndexedDbStore('app-routes-title-test'));
    const id = await store.getState().startScenario({
      title: 'Friday night',
      ctx: { cards: theGatheringCards, scenario: theGathering },
      difficulty: 'easy',
      seed: 3,
      investigators: [],
    });
    renderAt(`/game/${id}`, store);

    await screen.findByRole('button', { name: 'Menu' });
    expect(document.querySelector('#app > header')).toBeNull();
  });

  it('offers no export in the title bar away from a game', () => {
    renderAt('/settings');

    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
