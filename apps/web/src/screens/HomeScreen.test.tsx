// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { STATE_VERSION } from '@arkham/engine';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { HomeScreen } from './HomeScreen';

let n = 0;
async function renderHome(titles: string[]) {
  const gameStore = new IndexedDbStore(`home-test-${n++}`);
  for (const title of titles) await gameStore.createGame({ title });
  const store = createAppStore(gameStore);
  render(
    <MemoryRouter>
      <HomeScreen store={store} />
    </MemoryRouter>,
  );
  return store;
}

describe('HomeScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('offers new campaign and quick game when there are no games', async () => {
    await renderHome([]);

    const campaign = await screen.findByRole('link', { name: 'New campaign' });
    expect(campaign.getAttribute('href')).toBe('/new?mode=campaign');
    expect(screen.getByRole('link', { name: 'Quick game' }).getAttribute('href')).toBe(
      '/new?mode=quick',
    );
  });

  it('lists games with progress and a resume link', async () => {
    await renderHome(['Night']);

    const resume = await screen.findByRole('link', { name: 'Resume' });
    expect(resume.getAttribute('href')).toMatch(/^\/game\/.+/);
    expect(screen.getByText('Round 0, Setup')).toBeTruthy();
  });

  it('renames a game', async () => {
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Dawn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: 'Dawn' })).toBeTruthy();
  });

  it('duplicates a game', async () => {
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

    expect(await screen.findByRole('link', { name: 'Night (copy)' })).toBeTruthy();
  });

  it('keeps the game when deleting is cancelled and removes it when confirmed', async () => {
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete "Night"?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'Night' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByRole('link', { name: 'New campaign' })).toBeTruthy();
  });

  it('downloads an export of a game', async () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'Export' }));

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('imports an export file as a new game', async () => {
    await renderHome([]);
    const exported = {
      format: 'arkham-companion-game',
      stateVersion: STATE_VERSION,
      game: { title: 'Imported', createdAt: 1 },
      events: [],
    };
    const file = new File([JSON.stringify(exported)], 'game.json');

    fireEvent.change(await screen.findByLabelText('Import game'), { target: { files: [file] } });

    expect(await screen.findByRole('link', { name: 'Imported' })).toBeTruthy();
  });

  it('explains why a file from a newer version cannot be imported', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await renderHome([]);
    const file = new File([JSON.stringify({ stateVersion: STATE_VERSION + 1 })], 'game.json');

    fireEvent.change(await screen.findByLabelText('Import game'), { target: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toMatch(/newer version/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('import'), expect.any(Error));
  });
});
