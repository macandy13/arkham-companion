// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cardCode,
  cardDbWith,
  cardImagePath,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  instanceId,
  type CardStats,
  type InvestigatorCard,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { initI18n } from '../i18n';
import { findScenario } from '../scenarios/scenarioCatalog';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import type { CatalogSource } from '../catalog/useCatalog';
import { GameScreen } from './GameScreen';

const alder: InvestigatorCard = {
  code: investigatorCode('alder'),
  name: 'Alder',
  health: 6,
  sanity: 8,
  skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
};

/** A card catalog that is still loading, as on a first start: the scenario card has no texts. */
const loadingCatalog: CatalogSource = () => new Promise(() => undefined);

/**
 * Renders the play screen on a new game of The Gathering with Alder as the only investigator;
 * `replacedCards` stand in for the scenario's cards of the same code, and the scenario card's
 * texts come from `catalog`.
 */
async function renderTheGathering(
  db: string,
  replacedCards: readonly CardStats[] = [],
  catalog: CatalogSource = loadingCatalog,
) {
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
        <Route path="game/:id" element={<GameScreen store={store} catalog={catalog} />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Setup' });
  return store;
}

/** The Study, where Alder starts, with Trapped's 2 clues for one investigator. */
const study = instanceId('01111#1');

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

  it("shows the clues Alder holds against the act's cost", async () => {
    const store = await renderTheGathering('game-screen-act-clues-test');
    const { actions } = store.getState();
    await actions.nextPhase();
    await actions.startTurn(investigatorId('alder'));

    await actions.takeClue(study);

    expect(await screen.findByRole('img', { name: 'Clues 1 / 2' })).toBeTruthy();
  });

  it("advances the act in Alder's turn once he holds the clues it needs, spending them", async () => {
    const store = await renderTheGathering('game-screen-act-advance-test');
    // Trapped needs 2 clues for one investigator.
    const { actions } = store.getState();
    await actions.nextPhase();
    await actions.startTurn(investigatorId('alder'));
    await actions.takeClue(study);
    const advanceAtOneClue = button('Advance').disabled;
    await actions.takeClue(study);
    await screen.findByRole('img', { name: 'Clues 2 / 2' });

    fireEvent.click(button('Advance'));

    expect(advanceAtOneClue).toBe(true);
    expect(await screen.findByText('The Barrier')).toBeTruthy();
    expect(store.getState().current?.board?.investigator(investigatorId('alder')).clues).toBe(0);
  });

  it('opens the agenda as a full card from its name, with its doom, and closes it again', async () => {
    await renderTheGathering('game-screen-agenda-details-test');

    fireEvent.click(button("What's Going On?!"));
    const card = await screen.findByRole('dialog', { name: "What's Going On?!" });
    const doom = within(card).getByRole('img', { name: 'Doom 0 / 3' });
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }));

    expect(doom).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("shows the agenda's doom in play on its page, and its steppers only while adjusting", async () => {
    await renderTheGathering('game-screen-agenda-page-test');
    fireEvent.click(button("What's Going On?!"));
    const card = await screen.findByRole('dialog', { name: "What's Going On?!" });
    const stepperBeforeAdjusting = within(card).queryByRole('region', { name: 'On the agenda' });

    fireEvent.click(button('Adjust board'));
    const onAgenda = await within(card).findByRole('region', { name: 'On the agenda' });
    fireEvent.click(within(onAgenda).getByRole('button', { name: 'Add doom' }));

    expect(stepperBeforeAdjusting).toBeNull();
    expect(within(card).getByText('Agenda')).toBeTruthy();
    expect(await within(card).findByText('1 of 3')).toBeTruthy();
  });

  it("offers the act's Advance as its full card's one primary, with the clues alder holds", async () => {
    const store = await renderTheGathering('game-screen-act-page-test');
    // Trapped needs 2 clues for one investigator.
    const { actions } = store.getState();
    await actions.nextPhase();
    await actions.startTurn(investigatorId('alder'));
    await actions.takeClue(study);

    fireEvent.click(button('Trapped'));
    const card = await screen.findByRole('dialog', { name: 'Trapped' });

    expect(within(card).getByText('1 of 2')).toBeTruthy();
    expect(within(card).queryByRole('region', { name: 'On the act' })).toBeNull();
    const advance = within(card).getByRole('button', { name: 'Advance' });
    expect(advance.hasAttribute('data-primary')).toBe(true);
    expect((advance as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens the act on a tap on its card but not on its plate's Advance button", async () => {
    const store = await renderTheGathering('game-screen-act-tap-test');
    const { actions } = store.getState();
    await actions.nextPhase();
    await actions.startTurn(investigatorId('alder'));
    await actions.takeClue(study);
    await actions.takeClue(study);
    const act = screen.getByRole('region', { name: 'Act' });
    const face = act.querySelector('[data-card]');
    if (!face) throw new Error('the act has no card');

    fireEvent.click(await within(act).findByRole('button', { name: 'Advance' }));
    await within(act).findByText('The Barrier');
    const openAfterAdvancing = screen.queryByRole('dialog');
    fireEvent.click(face);

    expect(openAfterAdvancing).toBeNull();
    expect(await screen.findByRole('dialog', { name: 'The Barrier' })).toBeTruthy();
  });

  it('advances the act from its full card and closes the card', async () => {
    const store = await renderTheGathering('game-screen-act-details-advance-test');
    // Trapped needs 2 clues for one investigator.
    const { actions } = store.getState();
    await actions.nextPhase();
    await actions.startTurn(investigatorId('alder'));
    await actions.takeClue(study);
    await actions.takeClue(study);
    fireEvent.click(button('Trapped'));
    const card = await screen.findByRole('dialog', { name: 'Trapped' });

    fireEvent.click(within(card).getByRole('button', { name: 'Advance' }));

    expect(await screen.findByText('The Barrier')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    { card: "What's Going On?!", code: '01105' },
    { card: 'Trapped', code: '01108' },
  ])(
    "takes an action $card prints from its full card on alder's turn, which stays open",
    async ({ card, code }) => {
      const printed = theGatheringCards.get(cardCode(code));
      if (!printed) throw new Error(`The Gathering has ${card}`);
      const store = await renderTheGathering(`game-screen-card-action-test-${code}`, [
        { ...printed, actions: [{ effects: [] }] },
      ]);
      fireEvent.click(button('Next'));
      fireEvent.click(await screen.findByRole('button', { name: 'Start turn' }));
      await screen.findByRole('button', { name: 'End turn' });
      fireEvent.click(button(card));
      const details = await screen.findByRole('dialog', { name: card });

      fireEvent.click(
        within(within(details).getByRole('region', { name: 'Card actions' })).getByRole('button', {
          name: `Action · ${card}`,
        }),
      );

      await waitFor(() =>
        expect(
          store.getState().current?.board?.investigator(investigatorId('alder')),
        ).toMatchObject({
          actions: 2,
        }),
      );
      expect(screen.getByRole('dialog', { name: card })).toBeTruthy();
    },
  );

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

  it.each([
    { scan: 'lying, 419 by 300', width: 419, height: 300, shown: true },
    { scan: 'turned upright, 300 by 419', width: 300, height: 419, shown: false },
  ])(
    "shows the agenda's picture only when its scan lies: $scan",
    async ({ width, height, shown }) => {
      const whatsGoingOn = theGatheringCards.get(cardCode('01105'));
      if (!whatsGoingOn) throw new Error("The Gathering has the agenda What's Going On?!");
      await renderTheGathering('game-screen-agenda-shape-test', [
        { ...whatsGoingOn, imageSrc: cardImagePath('/bundles/cards/whats_going_on.jpg') },
      ]);
      const agenda = screen.getByRole('region', { name: 'Agenda' }).querySelector('[data-card]');
      const picture = agenda?.querySelector('img');
      if (!agenda || !picture) throw new Error('the agenda has no card with a picture');
      Object.defineProperty(picture, 'naturalWidth', { value: width });
      Object.defineProperty(picture, 'naturalHeight', { value: height });

      fireEvent.load(picture);

      expect(agenda.hasAttribute('data-picture')).toBe(shown);
    },
  );

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

  it("opens the scenario card from its name, its page a row per chaos token with the easy side's text", async () => {
    // Invented texts under The Gathering's reference card code: the catalog's, not the card's.
    const catalog: CatalogSource = async () => ({
      investigators: [],
      packs: [],
      references: {
        '01104': {
          easyStandard: { skull: '-X. Count the [[Ghoul]] enemies.', cultist: '-1. Easy cultist.' },
          hardExpert: { skull: '-9. Hard skull.' },
        },
      },
    });
    await renderTheGathering('game-screen-scenario-details-test', [], catalog);

    fireEvent.click(button('The Gathering'));
    const card = await screen.findByRole('dialog', { name: 'The Gathering' });
    const list = within(card).getByRole('list', { name: 'Chaos tokens' });
    const rows = within(list)
      .getAllByRole('listitem')
      .map((row) => [within(row).getByRole('img').getAttribute('aria-label'), row.textContent]);

    expect(within(card).getByText('Scenario · Easy / Standard')).toBeTruthy();
    expect(rows).toEqual([
      ['Skull', '-X. Count the Ghoul enemies.'],
      ['Cultist', '-1. Easy cultist.'],
      ['Tablet', ''],
    ]);
    expect(within(list).getByText('Ghoul').tagName).toBe('EM');
  });

  it("shows the scenario's set-aside cards and its victory points on its page", async () => {
    // The Gathering's setup sets aside 6 cards: Hallway, Attic, Cellar, Parlor, the Ghoul Priest, Lita.
    await renderTheGathering('game-screen-scenario-piles-test');

    fireEvent.click(button('The Gathering'));
    const card = await screen.findByRole('dialog', { name: 'The Gathering' });
    const values = within(card)
      .getAllByRole('definition')
      .map((value) => value.textContent);

    expect(values).toEqual(['6', '0']);
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

  it('lays the encounter deck with its discard pile, agenda, act, scenario with the set-aside cards and victory display out under their labels', async () => {
    await renderTheGathering('game-screen-encounter-test');

    // The investigator cards have headers too, so the board's header is the one holding the deck.
    const deckPlace = screen.getByRole('region', { name: 'Encounter deck' });
    const boardHeader = deckPlace.closest('header');
    if (!boardHeader) throw new Error('the encounter deck is not in the board header');
    const labels = within(boardHeader)
      .getAllByRole('region')
      .map((place) => place.firstChild?.textContent);
    const deck = within(deckPlace);

    expect(labels).toEqual(['Encounter deck', 'Agenda', 'Act', 'Scenario', 'Victory']);
    expect(deck.getByRole('button', { name: 'Encounter discard pile' })).toBeTruthy();
    const scenario = within(within(boardHeader).getByRole('region', { name: 'Scenario' }));
    expect(scenario.getByRole('button', { name: /^Set aside, \d+ cards?$/ })).toBeTruthy();
    const victory = within(within(boardHeader).getByRole('region', { name: 'Victory' }));
    expect(victory.getByRole('button', { name: 'Victory display, 0 victory points' })).toBeTruthy();
  });

  it('warns instead of showing a board for a game it cannot play', async () => {
    const store = createAppStore(new IndexedDbStore('game-screen-unplayable-test'));
    // An empty game has no scenario, so the catalog has no rules to play it with.
    const gameWithoutScenario = await store.getState().newGame();
    render(
      <MemoryRouter initialEntries={[`/game/${gameWithoutScenario}`]}>
        <Routes>
          <Route path="game/:id" element={<GameScreen store={store} catalog={loadingCatalog} />} />
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

  it("investigates the Study from its details in the same dialog, then shows the Study's page again", async () => {
    const store = await renderTheGathering('screen-map-investigate');
    const { actions } = store.getState();
    await actions.nextPhase();
    await actions.startTurn(investigatorId('alder'));
    fireEvent.click(screen.getByRole('group', { name: 'Study' }));
    const details = screen.getByRole('dialog', { name: 'Study' });

    fireEvent.click(within(details).getByRole('button', { name: 'Investigate · 1 action' }));
    const investigation = await screen.findByRole('dialog', { name: 'Investigate Study' });
    const cardDuringTest = within(investigation).queryByRole('img', { name: 'The card of Study' });
    fireEvent.click(within(investigation).getByRole('button', { name: /Failed/ }));
    const afterTest = await screen.findByRole('dialog', { name: 'Study' });

    expect(investigation).toBe(details);
    expect(cardDuringTest).not.toBeNull();
    expect(afterTest).toBe(details);
    expect(screen.getAllByRole('dialog')).toEqual([details]);
  });
});

describe('GameScreen on a phone held upright', () => {
  /** The elements the screen scrolled into view, in order, as the detail view opened on them. */
  let scrolledTo: Element[];

  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => {
    scrolledTo = [];
    // jsdom has neither media queries nor scrolling, so the screen is told it is a phone.
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this);
    };
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    // @ts-expect-error jsdom has no scrollIntoView; the stub above is removed again.
    delete Element.prototype.scrollIntoView;
  });

  const board = () => document.getElementById('board');

  it('opens the detail view on the act from a tap on it, instead of its full card', async () => {
    await renderTheGathering('phone-act-test');

    fireEvent.click(screen.getByRole('button', { name: 'Trapped' }));

    expect(board()?.getAttribute('data-view')).toBe('detail');
    expect(scrolledTo).toEqual([
      board()?.querySelector('header'),
      screen.getByRole('region', { name: 'Act' }),
    ]);
    expect(screen.queryByRole('dialog', { name: 'Trapped' })).toBeNull();
  });

  it('shows the act in full in the detail view, where a tap on it opens no second card', async () => {
    await renderTheGathering('phone-act-full-test');
    fireEvent.click(screen.getByRole('button', { name: 'Trapped' }));
    const face = screen.getByRole('region', { name: 'Act' }).querySelector('[data-card]');
    if (!face) throw new Error('the act has no card');

    fireEvent.click(face);

    expect(board()?.getAttribute('data-view')).toBe('detail');
    expect(screen.queryByRole('button', { name: 'Trapped' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Trapped' })).toBeNull();
  });

  it.each([
    { card: "What's Going On?!", code: '01105', place: 'Agenda' },
    { card: 'Trapped', code: '01108', place: 'Act' },
  ])(
    "takes an action $card prints from under it in the detail view on alder's turn",
    async ({ card, code, place }) => {
      const printed = theGatheringCards.get(cardCode(code));
      if (!printed) throw new Error(`The Gathering has ${card}`);
      const store = await renderTheGathering(`phone-card-action-test-${code}`, [
        { ...printed, actions: [{ effects: [] }] },
      ]);
      fireEvent.click(button('Next'));
      fireEvent.click(await screen.findByRole('button', { name: 'Start turn' }));
      await screen.findByRole('button', { name: 'End turn' });
      fireEvent.click(button(card));

      fireEvent.click(
        within(screen.getByRole('region', { name: place })).getByRole('button', {
          name: `Action · ${card}`,
        }),
      );

      await waitFor(() =>
        expect(
          store.getState().current?.board?.investigator(investigatorId('alder')),
        ).toMatchObject({ actions: 2 }),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );

  it("opens the detail view on Alder's panel from the name on it", async () => {
    await renderTheGathering('phone-investigator-test');

    fireEvent.click(screen.getByRole('button', { name: 'Alder' }));

    expect(board()?.getAttribute('data-view')).toBe('detail');
    expect(scrolledTo).toEqual([
      document.getElementById('investigators'),
      screen.getByRole('region', { name: 'Alder' }),
    ]);
  });

  it('opens the detail view on the map from its expand button', async () => {
    await renderTheGathering('phone-map-test');

    fireEvent.click(screen.getByRole('button', { name: 'Show the map on the whole screen' }));

    expect(board()?.getAttribute('data-view')).toBe('detail');
    expect(scrolledTo).toEqual([document.getElementById('map')]);
  });

  it('shows the Study in the map row from a tap on its tile, instead of its details', async () => {
    await renderTheGathering('phone-location-test');

    fireEvent.click(screen.getByRole('button', { name: 'Details of Study' }));

    expect(board()?.getAttribute('data-view')).toBe('detail');
    expect(scrolledTo).toEqual([document.getElementById('map')]);
    const study = screen.getByRole('region', { name: 'Study' });
    expect(within(study).getByRole('img', { name: 'The card of Study' })).toBeTruthy();
    expect(document.activeElement).toBe(study);
    expect(screen.queryByRole('dialog', { name: 'Study' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Study' })).toBeNull();
  });

  it('brings the whole map back from the Map button of a location', async () => {
    await renderTheGathering('phone-location-map-test');
    fireEvent.click(screen.getByRole('button', { name: 'Details of Study' }));

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));

    expect(screen.queryByRole('region', { name: 'Study' })).toBeNull();
    expect(screen.getByRole('figure', { name: 'Study' })).toBeTruthy();
    expect(board()?.getAttribute('data-view')).toBe('detail');
  });

  it.each([
    {
      strip: 'the cards',
      db: 'phone-cards-strip-test',
      name: 'Doom 0 / 3, Clues 0 / 2, 26 cards left in the encounter deck, Setup',
      row: () => board()?.querySelector('header'),
      item: () => screen.getByRole('region', { name: 'Agenda' }),
    },
    {
      strip: "Alder's panel",
      db: 'phone-investigator-strip-test',
      name: 'Alder, Health 6/6, Sanity 8/8, Clues 0, Resources 5, Willpower 3, Intellect 3, Combat 3, Agility 3',
      row: () => document.getElementById('investigators'),
      item: () => screen.getByRole('region', { name: 'Alder' }),
    },
  ])(
    'names the numbers of $strip on its strip over the map, and goes there from it',
    async ({ db, name, row, item }) => {
      await renderTheGathering(db);
      fireEvent.click(screen.getByRole('button', { name: 'Show the map on the whole screen' }));
      scrolledTo = [];

      fireEvent.click(screen.getByRole('button', { name }));

      expect(scrolledTo).toEqual([row(), item()]);
    },
  );

  it.each([
    {
      way: 'the ×',
      db: 'phone-close-button-test',
      close: () => fireEvent.click(screen.getByRole('button', { name: 'Back to the overview' })),
    },
    {
      way: 'Escape',
      db: 'phone-close-escape-test',
      close: () => fireEvent.keyDown(window, { key: 'Escape' }),
    },
    { way: 'the back gesture', db: 'phone-close-back-test', close: () => window.history.back() },
  ])('goes back to the overview with $way, through the history', async ({ db, close }) => {
    await renderTheGathering(db);
    fireEvent.click(screen.getByRole('button', { name: 'Trapped' }));

    close();

    await waitFor(() => expect(board()?.hasAttribute('data-view')).toBe(false));
  });
});
