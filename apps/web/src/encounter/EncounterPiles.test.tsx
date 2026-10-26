// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  instanceId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { EncounterPiles } from './EncounterPiles';

const study = instanceId('study');

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

    render(<EncounterPiles board={table.board} />);

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

    render(<EncounterPiles board={table.board} />);

    expect(screen.getByRole('button', { name: '0 cards left in the encounter deck' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Encounter discard pile' }).textContent).toBe('');
  });

  it('opens the encounter dialog from the discard pile with its list open, top card first', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('top_discard'), blankTreachery('Rotting Remains'), {
          kind: 'encounterDiscard',
        })
        .withCard(instanceId('lower_discard'), blankEnemy('Swarm of Rats'), {
          kind: 'encounterDiscard',
        })
        .withCard(instanceId('lita'), blankAsset('Lita Chantler'), { kind: 'setAside' })
        .withCard(instanceId('ghoul_priest'), blankEnemy('Ghoul Priest', { victory: 2 }), {
          kind: 'victoryDisplay',
        }),
    );
    render(<EncounterPiles board={table.board} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Encounter discard pile, 2 cards, Rotting Remains on top',
      }),
    );

    const dialog = within(screen.getByRole('dialog', { name: 'Encounter deck' }));
    const pile = (name: string) => {
      const details = dialog.getByText(name).closest('details');
      if (!details) throw new Error(`no pile ${name}`);
      return details;
    };
    expect(pile('Discard pile (2)').open).toBe(true);
    expect(pile('Set aside (1)').open).toBe(false);
    expect(pile('Victory display (1)').open).toBe(false);
    expect(
      within(pile('Discard pile (2)'))
        .getAllByRole('listitem')
        .map((card) => card.textContent),
    ).toEqual(['Rotting Remains', 'Swarm of Rats']);
    expect(within(pile('Set aside (1)')).getByRole('listitem').textContent).toBe('Lita Chantler');
    const ghoulPriest = within(pile('Victory display (1)')).getByRole('listitem');
    expect(within(ghoulPriest).getByText('2 victory points')).toBeTruthy();
  });

  it('opens the encounter dialog from the deck with its count and every list closed', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(instanceId('deck_card'), blankTreachery('Ancient Evils'), {
          kind: 'encounterDeck',
        }),
    );
    render(<EncounterPiles board={table.board} />);

    fireEvent.click(screen.getByRole('button', { name: '1 card left in the encounter deck' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Encounter deck' }));
    expect(dialog.getByText('1 card left in the encounter deck')).toBeTruthy();
    expect(dialog.getByText('Discard pile (0)').closest('details')?.open).toBe(false);
    expect(dialog.getAllByText('No cards')).toHaveLength(3);
  });
});
