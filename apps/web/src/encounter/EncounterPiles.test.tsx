// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
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

    expect(screen.getByRole('img', { name: '1 card left in the encounter deck' }).textContent).toBe(
      '1',
    );
    expect(
      screen.getByRole('img', {
        name: 'Encounter discard pile, 2 cards, Rotting Remains on top',
      }).textContent,
    ).toBe('2');
  });

  it('shows an empty discard pile as its outline only', () => {
    const table = PlayTable.start(newGame().withLocation(study, blankLocation('study')));

    render(<EncounterPiles board={table.board} />);

    expect(screen.getByRole('img', { name: '0 cards left in the encounter deck' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Encounter discard pile' }).textContent).toBe('');
  });
});
