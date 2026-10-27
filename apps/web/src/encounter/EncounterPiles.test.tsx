// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { EncounterPiles, HeaderPile } from './EncounterPiles';

const study = instanceId('study');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

/**
 * Actions that play on `table`, as the store's play on the open game; undo and adjusting are never
 * used here.
 */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    { start: async () => {}, finish: async () => {}, cancel: async () => {} },
  );

describe('EncounterPiles', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('counts the cards left in the deck and shows the discard pile with its top card and count', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('deck_card'), blankTreachery('Ancient Evils'), {
          kind: 'encounterDeck',
        })
        .withCard(instanceId('top_discard'), blankTreachery('Rotting Remains'), {
          kind: 'encounterDiscard',
        })
        .withCard(instanceId('lower_discard'), blankEnemy('Swarm of Rats'), {
          kind: 'encounterDiscard',
        }),
    );

    render(
      <EncounterPiles
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: '1 card left in the encounter deck' }).textContent,
    ).toBe('1');
    expect(
      screen.getByRole('button', {
        name: 'Encounter discard pile, 2 cards, Rotting Remains on top',
      }).textContent,
    ).toBe('2');
  });

  it('shows an empty discard pile as its outline only', () => {
    const table = PlayTable.start(newGame().withLocation(study, blankLocation('study')));

    render(
      <EncounterPiles
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '0 cards left in the encounter deck' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Encounter discard pile' }).textContent).toBe('');
  });

  it('opens the discard pile as a row of its cards, top card first and chosen', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('top_discard'), blankTreachery('Rotting Remains'), {
          kind: 'encounterDiscard',
        })
        .withCard(instanceId('lower_discard'), blankEnemy('Swarm of Rats'), {
          kind: 'encounterDiscard',
        }),
    );
    render(
      <EncounterPiles
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Encounter discard pile, 2 cards, Rotting Remains on top',
      }),
    );

    const dialog = within(screen.getByRole('dialog', { name: 'Discard pile (2)' }));
    const row = within(dialog.getByRole('list', { name: 'Discard pile' }));
    expect(row.getAllByRole('button').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Rotting Remains',
      'Swarm of Rats',
    ]);
    expect(row.getByRole('button', { name: 'Rotting Remains', pressed: true })).toBeTruthy();
    expect(dialog.getByRole('region', { name: 'Rotting Remains' })).toBeTruthy();
  });

  it('opens the deck with its count and none of the piles', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('deck_card'), blankTreachery('Ancient Evils'), {
          kind: 'encounterDeck',
        })
        .withCard(instanceId('discarded'), blankTreachery('Rotting Remains'), {
          kind: 'encounterDiscard',
        }),
    );
    render(
      <EncounterPiles
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '1 card left in the encounter deck' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Encounter deck' }));
    expect(dialog.getByText('1 card left in the encounter deck')).toBeTruthy();
    expect(dialog.queryByRole('list')).toBeNull();
  });

  describe("on Brook's turn, with Alder and Brook in the Study", () => {
    const brooksTurn = newGame()
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withInvestigator(alder, { locationId: study, name: 'Alder' })
      .withInvestigator(brook, { locationId: study, name: 'Brook' });

    it('offers a draw for each investigator, Brook first, and draws the top card for the one tapped', async () => {
      const table = PlayTable.start(
        brooksTurn
          .withCard(instanceId('top_card'), blankTreachery('Rotting Remains'), {
            kind: 'encounterDeck',
          })
          .withCard(instanceId('next_card'), blankTreachery('Ancient Evils'), {
            kind: 'encounterDeck',
          })
          .withTurnOf(brook),
      );
      const { rerender } = render(
        <EncounterPiles
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
          onSpawn={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: '2 cards left in the encounter deck' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Encounter deck' }));
      expect(
        dialog.getAllByRole('button', { name: /^Draw for/ }).map((draw) => draw.textContent),
      ).toEqual(['Draw for Brook', 'Draw for Alder']);

      fireEvent.click(dialog.getByRole('button', { name: 'Draw for Alder' }));
      await waitFor(() => expect(table.board.encounter.deckCount).toBe(1));
      rerender(
        <EncounterPiles
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
          onSpawn={() => {}}
        />,
      );

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        screen.getByRole('button', {
          name: 'Encounter discard pile, 1 card, Rotting Remains on top',
        }),
      ).toBeTruthy();
    });

    it.each<{ situation: string; deck: boolean; busy: boolean; adjusting: boolean }>([
      { situation: 'deck and discard pile are empty', deck: false, busy: false, adjusting: false },
      { situation: 'a step is queued', deck: true, busy: true, adjusting: false },
      { situation: 'the players adjust the board', deck: true, busy: false, adjusting: true },
    ])('draws nothing while $situation', ({ deck, busy, adjusting }) => {
      const game = deck
        ? brooksTurn.withCard(instanceId('top_card'), blankTreachery('Rotting Remains'), {
            kind: 'encounterDeck',
          })
        : brooksTurn;
      const table = PlayTable.start(game.withTurnOf(brook));
      render(
        <EncounterPiles
          board={table.board}
          actions={actionsOn(table)}
          busy={busy}
          adjusting={adjusting}
          onSpawn={() => {}}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /left in the encounter deck$/ }));

      const draws = within(screen.getByRole('dialog', { name: 'Encounter deck' })).getAllByRole(
        'button',
        { name: /^Draw for/ },
      );
      expect(draws.map((draw) => (draw as HTMLButtonElement).disabled)).toEqual([true, true]);
    });
  });

  it('puts a card from the discard pile into a threat area as one step', async () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study, name: 'Alder' })
        .withCard(instanceId('frozen_in_fear'), blankTreachery('Frozen in Fear'), {
          kind: 'encounterDiscard',
        }),
    );
    render(
      <EncounterPiles
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Encounter discard pile, 1 card, Frozen in Fear on top' }),
    );
    const frozenInFear = within(screen.getByRole('region', { name: 'Frozen in Fear' }));

    fireEvent.click(frozenInFear.getByRole('button', { name: "Into Alder's threat area" }));

    await waitFor(() =>
      expect(table.board.investigator(alder).threatArea).toEqual(['Frozen in Fear']),
    );
  });
});

describe('HeaderPile', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('fans the top three set-aside cards with the count on its disc', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('lita'), blankAsset('Lita Chantler'), { kind: 'setAside' })
        .withCard(instanceId('ghoul_priest'), blankEnemy('Ghoul Priest'), { kind: 'setAside' })
        .withCard(instanceId('cellar'), blankLocation('Cellar'), { kind: 'setAside' })
        .withCard(instanceId('attic'), blankLocation('Attic'), { kind: 'setAside' }),
    );

    render(
      <HeaderPile
        pile="setAside"
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    const pile = screen.getByRole('button', { name: 'Set aside, 4 cards' });
    expect(within(pile).getAllByRole('listitem')).toHaveLength(3);
    expect(pile.querySelector('data')?.value).toBe('4');
  });

  it('shows the victory points earned on the victory display, cleared locations included', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withLocation(instanceId('parlor'), blankLocation('Parlor', { victory: 1 }), {
          revealed: true,
          clues: 0,
        })
        .withCard(instanceId('ghoul_priest'), blankEnemy('Ghoul Priest', { victory: 2 }), {
          kind: 'victoryDisplay',
        }),
    );

    render(
      <HeaderPile
        pile="victoryDisplay"
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    const pile = screen.getByRole('button', { name: 'Victory display, 3 victory points' });
    expect(pile.querySelector('data')?.value).toBe('3');
  });

  it('opens the tapped pile in the encounter dialog', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('lita'), blankAsset('Lita Chantler'), { kind: 'setAside' }),
    );
    render(
      <HeaderPile
        pile="setAside"
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set aside, 1 card' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Set aside (1)' }));
    expect(
      within(dialog.getByRole('list', { name: 'Set aside' })).getByRole('button').ariaLabel,
    ).toBe('Lita Chantler');
  });

  it('shows the card tapped in the row with its victory points', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('lita'), blankAsset('Lita Chantler'), { kind: 'setAside' })
        .withCard(instanceId('ghoul_priest'), blankEnemy('Ghoul Priest', { victory: 2 }), {
          kind: 'setAside',
        }),
    );
    render(
      <HeaderPile
        pile="setAside"
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set aside, 2 cards' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Set aside (2)' }));

    fireEvent.click(dialog.getByRole('button', { name: 'Ghoul Priest' }));

    expect(dialog.getByRole('button', { name: 'Ghoul Priest', pressed: true })).toBeTruthy();
    const chosen = dialog.getByRole('region', { name: 'Ghoul Priest' });
    expect(chosen.querySelector('h3')?.textContent).toBe('Ghoul Priest2 victory points');
  });

  it.each([
    ['five cards fit, without arrows', 5, false],
    ['six cards scroll, with arrows', 6, true],
  ])('shows a pile of %s', (_, count, arrows) => {
    const game = ['Attic', 'Cellar', 'Parlor', 'Hallway', 'Lodge', 'Barn']
      .slice(0, count)
      .reduce(
        (pile, name) =>
          pile.withCard(instanceId(name.toLowerCase()), blankLocation(name), { kind: 'setAside' }),
        newGame().withLocation(study, blankLocation('study')),
      );
    const table = PlayTable.start(game);
    render(
      <HeaderPile
        pile="setAside"
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onSpawn={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: `Set aside, ${count} cards` }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('button', { name: 'Earlier cards' }) !== null).toBe(arrows);
    expect(dialog.queryByRole('button', { name: 'Later cards' }) !== null).toBe(arrows);
  });
});
