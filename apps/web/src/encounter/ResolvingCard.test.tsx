// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  skillTest,
  whenRevealed,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { ResolvingCard } from './ResolvingCard';

const study = instanceId('study');
const alder = investigatorId('alder');

describe('ResolvingCard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('names the card being resolved, whom it was drawn for and its keywords as badges', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study, name: 'Alder' })
        .withCard(
          instanceId('crypt_chill'),
          blankTreachery('Crypt Chill', {
            keywords: [{ name: 'peril' }, { name: 'surge' }],
            abilities: [whenRevealed(skillTest('willpower', 4))],
          }),
          { kind: 'encounterDeck' },
        )
        .withCard(instanceId('next_card'), blankTreachery('Rotting Remains'), {
          kind: 'encounterDeck',
        }),
    );
    table.play({ type: 'DrawEncounter', investigatorId: alder });
    const resolving = table.board.resolving;
    if (!resolving) throw new Error('Crypt Chill is resolving');

    render(<ResolvingCard board={table.board} card={resolving} />);

    expect(screen.getByText('Crypt Chill, drawn for Alder')).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Keywords' }))
        .getAllByRole('listitem')
        .map((badge) => badge.textContent),
    ).toEqual(['Peril', 'Surge']);
  });
});
