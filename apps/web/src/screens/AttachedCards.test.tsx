// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  instanceId,
  newGame,
  PlayTable,
  type AttachmentHost,
  type InstanceId,
} from '@arkham/engine';
import { barricade, handcuffs, hidingSpot } from '@arkham/scenarios';
import { initI18n } from '../i18n';
import { actionsOn } from '../state/gameActions.test_support';
import { AttachedCards } from './AttachedCards';

const study = instanceId('study');
const ghoul = instanceId('ghoul');

/** The attached cards of `host` on `table`, as its details show them. */
const renderAttachedCards = (table: PlayTable, host: InstanceId, type: AttachmentHost) =>
  render(
    <AttachedCards
      board={table.board}
      host={host}
      type={type}
      actions={actionsOn(table)}
      busy={false}
    />,
  );

const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('AttachedCards', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /** A ghoul in the study, with the player cards the app attaches in the card data. */
  const ghoulInStudy = () =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withCard(ghoul, blankEnemy('ghoul'), atLocation(study))
        .withCardData(barricade)
        .withCardData(handcuffs)
        .withCardData(hidingSpot),
    );

  it.each([
    { host: ghoul, type: 'enemy' as const, cards: ['Handcuffs'] },
    { host: study, type: 'location' as const, cards: ['Barricade', 'Hiding Spot'] },
  ])('offers the cards that attach to an $type', ({ host, type, cards }) => {
    renderAttachedCards(ghoulInStudy(), host, type);

    tap('Attach a card');

    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(
      within(dialog)
        .getAllByRole('listitem', { hidden: true })
        .map((item) => item.textContent),
    ).toEqual(cards);
  });

  it('attaches the picked card to the ghoul and closes', async () => {
    const table = ghoulInStudy();
    renderAttachedCards(table, ghoul, 'enemy');

    tap('Attach a card');
    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Handcuffs' }));
    await act(async () => {});

    expect(table.board.enemy(ghoul)).toMatchObject({ attachments: ['Handcuffs'] });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('attaches nothing on Cancel', () => {
    const table = ghoulInStudy();
    renderAttachedCards(table, ghoul, 'enemy');

    tap('Attach a card');
    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Cancel' }));

    expect(table.board.enemy(ghoul).attachments).toBeUndefined();
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('discards an attached card', async () => {
    const table = ghoulInStudy();
    table.play({ type: 'AttachPlayerCard', hostId: study, code: barricade.code });
    renderAttachedCards(table, study, 'location');

    tap('Discard Barricade');
    await act(async () => {});

    expect(table.board.location(study).attachments).toBeUndefined();
  });
});
