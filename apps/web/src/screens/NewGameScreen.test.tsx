// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CardCatalog } from '@arkham/carddata';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { NewGameScreen } from './NewGameScreen';

const catalog: CardCatalog = {
  packs: [{ code: 'pack1', name: 'First Pack', position: 1, cyclePosition: 1, chapter: 1 }],
  investigators: [
    {
      code: 'a1',
      name: 'Alder',
      factionCode: 'seeker',
      health: 6,
      sanity: 8,
      skills: { willpower: 1, intellect: 4, combat: 2, agility: 3 },
      packCode: 'pack1',
      cyclePosition: 1,
      parallel: false,
      chapter: 1,
    },
  ],
};

function renderScreen(loadCatalog: () => Promise<CardCatalog>) {
  const store = createAppStore(new IndexedDbStore('new-game-screen-test'), loadCatalog);
  render(
    <MemoryRouter>
      <NewGameScreen store={store} />
    </MemoryRouter>,
  );
}

describe('NewGameScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('shows a loading message, then the picker', async () => {
    renderScreen(() => Promise.resolve(catalog));

    expect(screen.getByRole('status').textContent).toBe('Loading investigators…');
    expect(await screen.findByRole('heading', { name: 'Choose investigators' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Alder/ })).toBeTruthy();
  });

  it('shows an error with a retry button that loads the catalog again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(catalog);
    renderScreen(load);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Card data could not be loaded – check your connection.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Choose investigators' })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when the catalog has no investigators', async () => {
    renderScreen(() => Promise.resolve({ ...catalog, investigators: [] }));

    expect(await screen.findByText('No investigators are available.')).toBeTruthy();
  });

  it('keeps the empty game shortcut available while loading fails', async () => {
    renderScreen(() => Promise.reject(new Error('offline')));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Create empty game' })).toBeTruthy();
  });
});
