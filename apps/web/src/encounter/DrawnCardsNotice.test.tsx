// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardName,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { DrawnCardsNotice } from './DrawnCardsNotice';

const study = instanceId('study');
const alder = investigatorId('alder');

/** Actions that play on `table`; undo and adjusting are never used here. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    { start: async () => {}, finish: async () => {}, cancel: async () => {} },
  );

describe('DrawnCardsNotice', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('says for whom each card was drawn and where it went', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('Study'))
        .withInvestigator(alder, { locationId: study, name: 'Alder' })
        .withCard(instanceId('crypt_chill'), blankTreachery('Crypt Chill'), {
          kind: 'encounterDiscard',
        })
        .withCard(instanceId('ghoul'), blankEnemy('Ghoul Minion'), {
          kind: 'atLocation',
          locationId: study,
        }),
    );
    const { board } = table;

    render(
      <DrawnCardsNotice
        board={board}
        drawn={[
          {
            card: board.encounterCard(instanceId('crypt_chill')),
            drawnFor: alder,
            place: { kind: 'encounterDiscard' },
          },
          {
            card: board.encounterCard(instanceId('ghoul')),
            place: { kind: 'atLocation', location: cardName('Study') },
          },
        ]}
        actions={actionsOn(table)}
        busy={false}
        onSpawn={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(
      within(screen.getByRole('status', { name: 'Encounter cards drawn' }))
        .getAllByRole('listitem')
        .map((line) => line.textContent),
    ).toEqual(['Crypt Chill for Alder: discard pile', 'Ghoul Minion: at Study']);
  });
});
