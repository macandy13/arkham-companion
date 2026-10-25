// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
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
const renderGhoulDetails = (table: PlayTable, onTurn: boolean, onClose = vi.fn()) => {
  const enemy = table.board.enemiesEngagedWith(alder).find(({ id }) => id === ghoul);
  if (!enemy) throw new Error('the ghoul is engaged with alder');
  render(
    <EnemyDetails
      board={table.board}
      enemy={enemy}
      actions={actionsOn(table)}
      onTurn={onTurn}
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

  it("shows the ghoul's fight, evade, health left and attack", () => {
    renderGhoulDetails(PlayTable.start(ghoulOnAlder), false);

    const numbers = screen
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(numbers).toEqual([
      ['Fight', '3'],
      ['Evade', '2'],
      ['Health', '2/3'],
      ['Attack', '1 damage, 2 horror'],
    ]);
  });

  it.each([
    { group: 'Actions', button: 'Fight · 1 action', prompt: 'decision.fight', left: 2 },
    { group: 'Actions', button: 'Evade · 1 action', prompt: 'decision.evade', left: 2 },
    {
      group: 'Without an action (a card allows it)',
      button: 'Fight, no action',
      prompt: 'decision.fight',
      left: 3,
    },
    {
      group: 'Without an action (a card allows it)',
      button: 'Evade, no action',
      prompt: 'decision.evade',
      left: 3,
    },
  ])(
    '"$button" on alder\'s turn closes, leaves the test open and leaves $left actions',
    ({ group: name, button, prompt, left }) => {
      const table = PlayTable.start(ghoulOnAlder.withTurnOf(alder));
      const onClose = renderGhoulDetails(table, true);

      fireEvent.click(within(group(name)).getByRole('button', { name: button }));

      expect(onClose).toHaveBeenCalled();
      expect(table.board.decisions).toMatchObject([{ prompt, about: 'ghoul', for: alder }]);
      expect(table.board.investigator(alder)).toMatchObject({ actions: left });
    },
  );

  it("offers only the card effects outside alder's turn", () => {
    renderGhoulDetails(PlayTable.start(ghoulOnAlder.withTurnOf(brook)), false);

    const groups = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(groups).toEqual(['Card effects']);
  });

  it('deals 1 damage and stays open for the next point', () => {
    const table = PlayTable.start(ghoulOnAlder);
    const onClose = renderGhoulDetails(table, false);

    fireEvent.click(screen.getByRole('button', { name: 'Deal 1 damage' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(table.board.enemiesEngagedWith(alder)).toMatchObject([{ damage: 2 }]);
  });

  it.each([
    { button: 'Disengage', enemies: [{ name: 'ghoul', at: 'study' }] },
    { button: 'Defeat', enemies: [] },
  ])('"$button" closes and leaves the enemies $enemies', ({ button, enemies }) => {
    const table = PlayTable.start(ghoulOnAlder);
    const onClose = renderGhoulDetails(table, false);

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(onClose).toHaveBeenCalled();
    expect(table.board.enemies).toMatchObject(enemies);
    expect(table.board.enemiesEngagedWith(alder)).toEqual([]);
  });
});
