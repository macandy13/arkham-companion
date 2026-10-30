// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CardCatalog, InvestigatorDef } from '@arkham/carddata';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { NewGameScreen } from './NewGameScreen';

function makeInvestigator(code: string, name: string, health: number, sanity: number) {
  return {
    code,
    name,
    factionCode: 'seeker',
    health,
    sanity,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'pack1',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
  } satisfies InvestigatorDef;
}

const catalog: CardCatalog = {
  packs: [{ code: 'pack1', name: 'First Pack', position: 1, cyclePosition: 1, chapter: 1 }],
  investigators: [makeInvestigator('a1', 'Alder', 6, 8), makeInvestigator('b1', 'Birch', 9, 5)],
};

function Location() {
  const { pathname, search } = useLocation();
  return <output>{pathname + search}</output>;
}

let n = 0;
function renderWizard(path: string, source = () => Promise.resolve(catalog)) {
  const gameStore = new IndexedDbStore(`wizard-test-${n++}`);
  const store = createAppStore(gameStore);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="new" element={<NewGameScreen store={store} catalog={source} />} />
        <Route path="game/:id" element={<p>Game page</p>} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
  return { store, gameStore };
}

function selectInvestigator(name: string) {
  fireEvent.click(
    within(screen.getByRole('list', { name: 'Investigators' })).getByRole('button', {
      name: new RegExp(name),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
}

describe('NewGameScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('offers both entry points without a mode', () => {
    renderWizard('/new');

    expect(screen.getByRole('link', { name: 'New campaign' }).getAttribute('href')).toBe(
      '/new?mode=campaign',
    );
    expect(screen.getByRole('link', { name: 'Quick game' }).getAttribute('href')).toBe(
      '/new?mode=quick',
    );
  });

  it('starts a quick game and opens it', async () => {
    const { gameStore } = renderWizard('/new?mode=quick');

    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('list', { name: 'Investigators' });
    selectInvestigator('Birch');
    selectInvestigator('Alder');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Birch (health 9, sanity 5)', 'Alder (health 6, sanity 8)']);
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await screen.findByText('Game page');
    const [game] = await gameStore.listGames();
    expect(game).toMatchObject({
      scenarioId: 'the-gathering',
      title: 'The Gathering – Birch – Alder',
      investigators: [
        { code: 'b1', name: 'Birch' },
        { code: 'a1', name: 'Alder' },
      ],
    });
    expect((await gameStore.loadGame(game!.gameId))?.state.meta.difficulty).toBe('hard');
  });

  it("starts a campaign with its team and difficulty, and its first scenario as the campaign's game", async () => {
    const { gameStore } = renderWizard('/new?mode=campaign');

    expect(screen.getByRole('radio', { name: 'Night of the Zealot' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('list', { name: 'Investigators' });
    selectInvestigator('Alder');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await screen.findByText('Game page');
    const [campaign] = await gameStore.listCampaigns();
    expect(campaign).toMatchObject({
      title: 'Night of the Zealot – Alder',
      definitionId: 'night-of-the-zealot',
      difficulty: 'hard',
      position: 0,
      scenarioCount: 3,
      investigators: [{ code: 'a1', name: 'Alder' }],
    });
    const [game] = await gameStore.listGames();
    expect(game).toMatchObject({
      title: 'The Gathering – Alder',
      scenarioId: 'the-gathering',
      campaignId: campaign?.campaignId,
    });
    const state = (await gameStore.loadGame(game!.gameId))?.state;
    expect(state?.meta.difficulty).toBe('hard');
    expect(state?.campaign?.campaignId).toBe(campaign?.campaignId);
  });

  it('needs at least one investigator to continue', async () => {
    renderWizard('/new?mode=quick&step=investigators');

    await screen.findByRole('list', { name: 'Investigators' });

    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the choices when going back', async () => {
    renderWizard('/new?mode=quick&step=investigators');
    await screen.findByRole('list', { name: 'Investigators' });
    selectInvestigator('Alder');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('region', { name: 'Seats' }).textContent).toContain('Alder');
  });

  it('keeps the choices over a page refresh', async () => {
    renderWizard('/new?mode=quick');
    fireEvent.click(screen.getByRole('radio', { name: 'Expert' }));
    cleanup();

    renderWizard('/new?mode=quick');

    expect((screen.getByRole('radio', { name: 'Expert' }) as HTMLInputElement).checked).toBe(true);
  });

  it('shows an alert when the catalog cannot be loaded', async () => {
    renderWizard('/new?mode=quick&step=investigators', () => Promise.reject(new Error('offline')));

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
  });

  it('shows an alert and stays on the summary when the game cannot be started', async () => {
    const { store } = renderWizard('/new?mode=quick&step=investigators');
    await screen.findByRole('list', { name: 'Investigators' });
    selectInvestigator('Alder');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const failure = new Error('rejected');
    vi.spyOn(store.getState(), 'startScenario').mockRejectedValue(failure);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('could not be started'),
    );
    expect(screen.getByRole('button', { name: 'Start game' })).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('start the game'), failure);
  });
});
