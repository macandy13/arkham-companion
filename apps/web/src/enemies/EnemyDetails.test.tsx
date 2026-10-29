// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  cardImagePath,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  trait,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { EnemyDetails } from './EnemyDetails';

const study = instanceId('study');
const ghoul = instanceId('ghoul');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

/** Actions that play on `table`, as the store's play on the open game; undo and adjusting do nothing. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    {
      start: async () => {},
      finish: async () => {},
      cancel: async () => {},
    },
  );

/** The ghoul's details on `table`, as Alder's threat area opens them; `onClose` is a spy. */
const renderGhoulDetails = (table: PlayTable, onClose = vi.fn()) => {
  const enemy = table.board.enemiesEngagedWith(alder).find(({ id }) => id === ghoul);
  if (!enemy) throw new Error('the ghoul is engaged with alder');
  render(
    <EnemyDetails
      board={table.board}
      enemy={enemy}
      actions={actionsOn(table)}
      busy={false}
      onClose={onClose}
    />,
  );
  return onClose;
};

const group = (name: string) => screen.getByRole('region', { name });

describe('EnemyDetails', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /** A ghoul (fight 3, evade 2, 3 health with 1 damage, attack 1 damage and 2 horror) engaged with Alder. */
  const ghoulOnAlder = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withInvestigator(alder, { locationId: study })
    .withInvestigator(brook, { locationId: study })
    .withCard(
      ghoul,
      blankEnemy('ghoul', { fight: 3, evade: 2, health: fixed(3), damage: 1, horror: 2 }),
      engagedWith(alder),
      { tokens: { damage: 1 } },
    );

  it("shows the ghoul's card named after it, with its fight, health left, evade and attack", () => {
    renderGhoulDetails(PlayTable.start(ghoulOnAlder));

    expect(screen.getByRole('dialog', { hidden: true, name: 'ghoul' })).toBeDefined();
    expect(screen.getByText('Engaged with alder')).toBeDefined();
    expect(screen.getByRole('img', { hidden: true, name: 'Fight 3' })).toBeDefined();
    expect(screen.getByRole('img', { hidden: true, name: 'Health 2 of 3' })).toBeDefined();
    expect(screen.getByRole('img', { hidden: true, name: 'Evade 2' })).toBeDefined();
    expect(
      screen.getByRole('img', { hidden: true, name: 'Attack: 1 damage, 2 horror' }),
    ).toBeDefined();
  });

  it("writes the ghoul's traits, keywords and victory points on its card", () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, { locationId: study })
        .withCard(
          ghoul,
          blankEnemy('ghoul', {
            traits: [trait('Monster'), trait('Ghoul')],
            keywords: [
              { name: 'hunter' },
              { name: 'retaliate' },
              { name: 'prey', detail: 'Highest [combat]' },
            ],
            victory: 1,
          }),
          engagedWith(alder),
        ),
    );
    renderGhoulDetails(table);

    // The card's lines are paragraphs, which have no role to find them by; the combat icon in
    // the prey line has no text, so it is checked by its name below.
    const text = screen
      .getByRole('dialog', { hidden: true })
      .querySelectorAll('[data-card="enemy"] foreignObject p');
    expect(Array.from(text, (line) => line.textContent)).toEqual([
      'Monster. Ghoul.',
      'Hunter. Retaliate.',
      'Prey – Highest .',
      'Victory 1.',
    ]);
    expect(screen.getByRole('img', { hidden: true, name: 'Combat' })).toBeDefined();
  });

  it("shows the art of the ghoul's card once its picture has loaded", () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, { locationId: study })
        .withCard(
          ghoul,
          blankEnemy('ghoul', { imageSrc: cardImagePath('/bundles/cards/ghoul.png') }),
          engagedWith(alder),
        ),
    );
    renderGhoulDetails(table);
    // The art is decoration, so it has no role to find it by.
    const card = screen.getByRole('dialog', { hidden: true }).querySelector('[data-card="enemy"]');
    const picture = card?.querySelector('image');
    if (!card || !picture) throw new Error("the ghoul's card has no picture");
    const beforeLoading = card.hasAttribute('data-picture');

    // jsdom loads no images, so the test fires the load itself.
    fireEvent.load(picture);

    expect(picture.getAttribute('href')).toBe('https://arkhamdb.com/bundles/cards/ghoul.png');
    expect(beforeLoading).toBe(false);
    expect(card.getAttribute('data-picture')).toBe('shown');
  });

  it.each([
    { group: 'Action', button: 'Fight · 1 action', prompt: 'decision.fight', left: 2 },
    { group: 'Action', button: 'Evade · 1 action', prompt: 'decision.evade', left: 2 },
    {
      group: 'Free',
      button: 'Fight, no action',
      prompt: 'decision.fight',
      left: 3,
    },
    {
      group: 'Free',
      button: 'Evade, no action',
      prompt: 'decision.evade',
      left: 3,
    },
  ])(
    '"$button" on alder\'s turn closes, leaves the test open and leaves $left actions',
    ({ group: name, button, prompt, left }) => {
      const table = PlayTable.start(ghoulOnAlder.withTurnOf(alder));
      const onClose = renderGhoulDetails(table);

      fireEvent.click(within(group(name)).getByRole('button', { name: button }));

      expect(onClose).toHaveBeenCalled();
      expect(table.board.decisions).toMatchObject([{ prompt, about: 'ghoul', for: alder }]);
      expect(table.board.investigator(alder)).toMatchObject({ actions: left });
    },
  );

  it("parleys with the cultist through its card's action on alder's turn, closing first", async () => {
    const cultist = instanceId('cultist');
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withCard(
          cultist,
          blankEnemy('cultist', { actions: [{ designator: 'parley', effects: [] }] }),
          engagedWith(alder),
        )
        .withTurnOf(alder),
    );
    const onClose = vi.fn();
    const enemy = table.board.enemiesEngagedWith(alder)[0];
    if (!enemy) throw new Error('the cultist is engaged with alder');
    render(
      <EnemyDetails
        board={table.board}
        enemy={enemy}
        actions={actionsOn(table)}
        busy={false}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      within(group('Card actions')).getByRole('button', { name: 'Parley · cultist' }),
    );
    await act(async () => {});

    expect(onClose).toHaveBeenCalled();
    expect(table.board.investigator(alder)).toMatchObject({ actions: 2 });
  });

  it('offers only the card effects outside an investigator turn', () => {
    renderGhoulDetails(PlayTable.start(ghoulOnAlder));

    const groups = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(groups).toEqual(['Card effect']);
  });

  it("offers brook, at the same location on their turn, fight and engage but no evade of alder's ghoul", () => {
    renderGhoulDetails(PlayTable.start(ghoulOnAlder.withTurnOf(brook)));

    expect(
      within(group('Action'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Fight · 1 action', 'Engage · 1 action']);
    expect(
      within(group('Free'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Fight, no action']);
  });

  it('closes from its × button', () => {
    const onClose = renderGhoulDetails(PlayTable.start(ghoulOnAlder));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('deals 1 damage and stays open for the next point', () => {
    const table = PlayTable.start(ghoulOnAlder);
    const onClose = renderGhoulDetails(table);

    fireEvent.click(screen.getByRole('button', { name: 'Deal 1 damage' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(table.board.enemiesEngagedWith(alder)).toMatchObject([{ damage: 2 }]);
  });

  it.each([
    { button: 'Disengage', enemies: [{ name: 'ghoul', at: 'study' }] },
    { button: 'Defeat', enemies: [] },
  ])('"$button" closes and leaves the enemies $enemies', ({ button, enemies }) => {
    const table = PlayTable.start(ghoulOnAlder);
    const onClose = renderGhoulDetails(table);

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(onClose).toHaveBeenCalled();
    expect(table.board.enemies).toMatchObject(enemies);
    expect(table.board.enemiesEngagedWith(alder)).toEqual([]);
  });
});
