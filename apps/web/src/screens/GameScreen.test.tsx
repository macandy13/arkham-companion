// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cardCode,
  cardDbWith,
  cardImagePath,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  type CardStats,
  type InvestigatorCard,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { initI18n } from '../i18n';
import { findScenario } from '../scenarios/scenarioCatalog';
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

/**
 * Renders the play screen on a new game of The Gathering with Alder as the only investigator;
 * `replacedCards` stand in for the scenario's cards of the same code.
 */
async function renderTheGathering(db: string, replacedCards: readonly CardStats[] = []) {
  const cards = cardDbWith(theGatheringCards, replacedCards);
  const store = createAppStore(new IndexedDbStore(db), (id) => {
    const entry = findScenario(id);
    return entry && { ...entry, cards };
  });
  const id = await store.getState().startScenario({
    title: 'Friday night',
    ctx: {
      cards: cardDbWith(cards, [investigatorCardStats(alder)]),
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
  await screen.findByRole('heading', { name: 'Setup' });
  return store;
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

/** The phase the status row's phase track marks as the current one. */
const currentPhase = () =>
  screen.getByRole('list', { name: 'Phases' }).querySelector('[aria-current="step"]')?.textContent;

describe('GameScreen header', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('moves on to the next phase with "Next"', async () => {
    await renderTheGathering('game-screen-next-test');

    fireEvent.click(button('Next'));

    expect(await screen.findByRole('heading', { name: 'Round 1' })).toBeTruthy();
    expect(currentPhase()).toBe('Investigation');
  });

  it('offers undo only once a step was played, and undo takes it back', async () => {
    await renderTheGathering('game-screen-undo-test');
    const undoAtStart = button('Undo').disabled;
    fireEvent.click(button('Next'));
    await screen.findByRole('heading', { name: 'Round 1' });

    fireEvent.click(button('Undo'));

    expect(undoAtStart).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeTruthy();
  });

  it('says why "Next" was refused until the players dismiss it', async () => {
    await renderTheGathering('game-screen-refused-test');
    fireEvent.click(button('Next'));
    await screen.findByRole('heading', { name: 'Round 1' });

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
    const doom = within(agenda).getByRole('img', { name: 'Doom 0 / 3' });
    expect(within(doom).getByText('of 3')).toBeTruthy();
    expect(act.textContent).toContain('Trapped');
    const clues = within(act).getByRole('img', { name: 'Clues 0 / 2' });
    expect(within(clues).getByText('of 2')).toBeTruthy();
  });

  it('shows the steppers only while adjusting, with "Done" and "Cancel" in place of "Next"', async () => {
    await renderTheGathering('game-screen-adjust-mode-test');
    const before = screen.queryByRole('button', { name: 'Add doom' });

    fireEvent.click(button('Adjust board'));
    await screen.findByRole('button', { name: 'Done' });

    expect(before).toBeNull();
    expect(button('Add doom')).toBeTruthy();
    expect(button('Cancel')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('keeps an adjustment of several taps on "Done" and takes it all back with one undo', async () => {
    await renderTheGathering('game-screen-adjust-done-test');
    fireEvent.click(button('Adjust board'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add doom' }));
    await screen.findByRole('img', { name: 'Doom 1 / 3' });
    fireEvent.click(button('Add doom'));
    await screen.findByRole('img', { name: 'Doom 2 / 3' });

    fireEvent.click(button('Done'));
    await screen.findByRole('button', { name: 'Next' });
    const kept = screen.queryByRole('img', { name: 'Doom 2 / 3' });
    fireEvent.click(button('Undo'));

    expect(kept).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Doom 0 / 3' })).toBeTruthy();
  });

  it('drops the adjustment on "Cancel"', async () => {
    await renderTheGathering('game-screen-adjust-cancel-test');
    fireEvent.click(button('Adjust board'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add doom' }));
    await screen.findByRole('img', { name: 'Doom 1 / 3' });

    fireEvent.click(button('Cancel'));

    expect(await screen.findByRole('img', { name: 'Doom 0 / 3' })).toBeTruthy();
    expect(button('Undo').disabled).toBe(true);
  });

  it('adds doom to the agenda and takes it off again', async () => {
    await renderTheGathering('game-screen-doom-test');
    fireEvent.click(button('Adjust board'));
    await screen.findByRole('button', { name: 'Done' });
    const removeAtZero = button('Remove doom').disabled;

    fireEvent.click(button('Add doom'));
    await screen.findByRole('img', { name: 'Doom 1 / 3' });
    fireEvent.click(button('Remove doom'));

    expect(removeAtZero).toBe(true);
    expect(await screen.findByRole('img', { name: 'Doom 0 / 3' })).toBeTruthy();
  });

  it("puts a clue on the act and takes it off again, leaving Alder's clues alone", async () => {
    const store = await renderTheGathering('game-screen-act-clues-test');
    fireEvent.click(button('Adjust board'));
    await screen.findByRole('button', { name: 'Done' });
    const removeAtZero = button('Remove a clue').disabled;

    fireEvent.click(button('Add a clue'));
    await screen.findByRole('img', { name: 'Clues 1 / 2' });
    const alderAfterAdding = store.getState().current?.board?.investigator(investigatorId('alder'));
    fireEvent.click(button('Remove a clue'));

    expect(removeAtZero).toBe(true);
    expect(alderAfterAdding?.clues).toBe(0);
    expect(await screen.findByRole('img', { name: 'Clues 0 / 2' })).toBeTruthy();
  });

  it('advances the act once the clues on it reach what it needs', async () => {
    await renderTheGathering('game-screen-act-advance-test');
    // Trapped needs 2 clues for one investigator.
    fireEvent.click(button('Adjust board'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a clue' }));
    await screen.findByRole('img', { name: 'Clues 1 / 2' });
    fireEvent.click(button('Done'));
    await screen.findByRole('button', { name: 'Next' });
    const advanceAtOne = button('Advance').disabled;
    fireEvent.click(button('Adjust board'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add a clue' }));
    await screen.findByRole('img', { name: 'Clues 2 / 2' });
    const advanceWhileAdjusting = button('Advance').disabled;
    fireEvent.click(button('Done'));
    await screen.findByRole('button', { name: 'Next' });

    fireEvent.click(button('Advance'));

    expect(advanceAtOne).toBe(true);
    expect(advanceWhileAdjusting).toBe(true);
    expect(await screen.findByText('The Barrier')).toBeTruthy();
  });

  it('fills the agenda with its picture from ArkhamDB once it has loaded', async () => {
    const whatsGoingOn = theGatheringCards.get(cardCode('01105'));
    if (!whatsGoingOn) throw new Error("The Gathering has the agenda What's Going On?!");
    await renderTheGathering('game-screen-agenda-picture-test', [
      { ...whatsGoingOn, imageSrc: cardImagePath('/bundles/cards/whats_going_on.jpg') },
    ]);
    const agenda = screen.getByRole('region', { name: 'Agenda' }).querySelector('[data-card]');
    const act = screen.getByRole('region', { name: 'Act' }).querySelector('[data-card]');
    // The picture is decorative (`alt=""`), so it has no role to find it by.
    const picture = agenda?.querySelector('img');
    if (!agenda || !picture) throw new Error('the agenda has no card with a picture');

    expect(picture.getAttribute('src')).toBe(
      'https://arkhamdb.com/bundles/cards/whats_going_on.jpg',
    );
    expect(agenda.hasAttribute('data-picture')).toBe(false);
    // jsdom loads no images, so the test fires the load itself.
    fireEvent.load(picture);
    expect(agenda.getAttribute('data-picture')).toBe('shown');
    expect(act?.hasAttribute('data-picture')).toBe(false);
  });

  it('turns the buttons off while a step is still being stored', async () => {
    await renderTheGathering('game-screen-busy-test');

    fireEvent.click(button('Next'));

    expect(button('Next').disabled).toBe(true);
    expect(button('Undo').disabled).toBe(true);
    await screen.findByRole('heading', { name: 'Round 1' });
    expect(button('Next').disabled).toBe(false);
  });

  it('heads the screen with the scenario card', async () => {
    await renderTheGathering('game-screen-scenario-test');

    const scenario = screen.getByRole('region', { name: 'Scenario' });
    expect(within(scenario).getByRole('heading', { level: 1 }).textContent).toBe('The Gathering');
  });

  it('shows the round and the phases of a round in a status row, setup marking none', async () => {
    await renderTheGathering('game-screen-round-test');

    const phases = within(screen.getByRole('list', { name: 'Phases' }))
      .getAllByRole('listitem')
      .map((phase) => phase.textContent);
    expect(phases).toEqual(['Mythos', 'Investigation', 'Enemy', 'Upkeep']);
    expect(currentPhase()).toBeUndefined();
  });

  it('opens the menu with the way back to the game list and the settings', async () => {
    await renderTheGathering('game-screen-menu-test');

    fireEvent.click(button('Menu'));

    const menu = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(menu.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'All games',
      'Settings',
    ]);
  });

  it('lays the encounter deck with its discard pile, agenda, act and scenario out under their labels', async () => {
    await renderTheGathering('game-screen-encounter-test');

    // The investigator cards have headers too, so the board's header is the one holding the deck.
    const deckPlace = screen.getByRole('region', { name: 'Encounter deck' });
    const boardHeader = deckPlace.closest('header');
    if (!boardHeader) throw new Error('the encounter deck is not in the board header');
    const labels = within(boardHeader)
      .getAllByRole('region')
      .map((place) => place.firstChild?.textContent);
    const deck = within(deckPlace);

    expect(labels).toEqual(['Encounter deck', 'Agenda', 'Act', 'Scenario']);
    expect(deck.getByRole('button', { name: 'Encounter discard pile' })).toBeTruthy();
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
