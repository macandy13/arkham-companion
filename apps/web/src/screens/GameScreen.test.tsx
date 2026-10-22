// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cardDbWith,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  type InvestigatorCard,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { GameScreen } from './GameScreen';

const alder: InvestigatorCard = {
  code: investigatorCode('alder'),
  name: 'Alder',
  health: 6,
  sanity: 8,
  skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
};

/** Renders the play screen on a new game of The Gathering with Alder as the only investigator. */
async function renderTheGathering(db: string) {
  const store = createAppStore(new IndexedDbStore(db));
  const id = await store.getState().startScenario({
    title: 'Friday night',
    ctx: {
      cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]),
      scenario: theGathering,
    },
    difficulty: 'easy',
    seed: 3,
    investigators: [{ id: investigatorId('alder'), code: alder.code }],
  });
  render(
    <MemoryRouter initialEntries={[`/game/${id}`]}>
      <Routes>
        <Route path="game/:id" element={<GameScreen store={store} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Round 0, Setup');
  return store;
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('GameScreen header', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('moves on to the next phase with "Next"', async () => {
    await renderTheGathering('game-screen-next-test');

    fireEvent.click(button('Next'));

    expect(await screen.findByText('Round 1, Investigation')).toBeTruthy();
  });

  it('offers undo only once a step was played, and undo takes it back', async () => {
    await renderTheGathering('game-screen-undo-test');
    const undoAtStart = button('Undo').disabled;
    fireEvent.click(button('Next'));
    await screen.findByText('Round 1, Investigation');

    fireEvent.click(button('Undo'));

    expect(undoAtStart).toBe(true);
    expect(await screen.findByText('Round 0, Setup')).toBeTruthy();
  });

  it('says why "Next" was refused until the players dismiss it', async () => {
    await renderTheGathering('game-screen-refused-test');
    fireEvent.click(button('Next'));
    await screen.findByText('Round 1, Investigation');

    fireEvent.click(button('Next'));

    const toast = await screen.findByRole('alert', { name: 'Not possible' });
    expect(toast.textContent).toContain('Every investigator must take a turn first.');
    fireEvent.click(button('OK'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it("shows the agenda's doom against its threshold and the act's clues against its need", async () => {
    await renderTheGathering('game-screen-agenda-act-test');
    // For one investigator, What's Going On?! advances at 3 doom and Trapped needs 2 clues.

    const agenda = screen.getByRole('region', { name: 'Agenda' });
    const act = screen.getByRole('region', { name: 'Act' });
    expect(agenda.textContent).toContain("What's Going On?!");
    expect(agenda.textContent).toContain('Doom 0 / 3');
    expect(act.textContent).toContain('Trapped');
    expect(act.textContent).toContain('Clues 0 / 2');
  });

  it('adds doom to the agenda and takes it off again', async () => {
    await renderTheGathering('game-screen-doom-test');
    const removeAtZero = button('Remove doom').disabled;

    fireEvent.click(button('Add doom'));
    await screen.findByText('Doom 1 / 3');
    fireEvent.click(button('Remove doom'));

    expect(removeAtZero).toBe(true);
    expect(await screen.findByText('Doom 0 / 3')).toBeTruthy();
  });

  it('turns the buttons off while a step is still being stored', async () => {
    await renderTheGathering('game-screen-busy-test');

    fireEvent.click(button('Next'));

    expect(button('Next').disabled).toBe(true);
    expect(button('Undo').disabled).toBe(true);
    await screen.findByText('Round 1, Investigation');
    expect(button('Next').disabled).toBe(false);
  });

  it('heads the screen with the scenario card, which shows the round and phase', async () => {
    await renderTheGathering('game-screen-scenario-test');

    const scenario = screen.getByRole('region', { name: 'Scenario' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Gathering');
    expect(scenario.textContent).toBe('The GatheringRound 0, Setup');
  });

  it('lays the encounter deck and its discard pile out before the agenda', async () => {
    await renderTheGathering('game-screen-encounter-test');

    const header = screen.getByRole('banner');
    const cards = [...header.querySelectorAll(':scope > [aria-label]')].map((card) =>
      card.getAttribute('aria-label'),
    );
    expect(cards).toEqual([
      'Encounter deck',
      'Encounter discard pile',
      'Agenda',
      'Act',
      'Scenario',
    ]);
  });

  it('warns instead of showing a board for a game it cannot play', async () => {
    const store = createAppStore(new IndexedDbStore('game-screen-unplayable-test'));
    // An empty game has no scenario, so the catalog has no rules to play it with.
    const gameWithoutScenario = await store.getState().newGame();
    render(
      <MemoryRouter initialEntries={[`/game/${gameWithoutScenario}`]}>
        <Routes>
          <Route path="game/:id" element={<GameScreen store={store} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      "This game can't be played: this version of the app does not have its scenario.",
    );
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});

describe('GameScreen map', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('draws the map The Gathering starts on, with the Study as its one location', async () => {
    await renderTheGathering('screen-map');

    const studyMap = screen.getByRole('figure', { name: 'Study' });
    expect(
      within(studyMap)
        .getAllByRole('group')
        .map((tile) => tile.getAttribute('aria-label')),
    ).toEqual(['Study']);
  });
});
