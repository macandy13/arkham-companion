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
  type InstanceId,
} from '@arkham/engine';
import { barricade, handcuffs, hidingSpot } from '@arkham/scenarios';
import { initI18n } from '../i18n';
import { actionsOn } from '../state/gameActions.test_support';
import { AttachedCards } from './AttachedCards';
import { TuckedCardsContext } from './CardDialog';

const study = instanceId('study');
const ghoul = instanceId('ghoul');

/** The attached cards of `host` on `table`, as its details show them. */
const renderAttachedCards = (table: PlayTable, host: InstanceId) =>
  render(<AttachedCards board={table.board} host={host} actions={actionsOn(table)} busy={false} />);

const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('AttachedCards', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /**
   * A ghoul in the study, with the card data of the player cards the app attaches. The dialog
   * offers them from the app's own list (`attachableCards` over `playerCardDefs`): Handcuffs for an
   * enemy, Barricade and Hiding Spot for a location.
   */
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
    { name: 'an enemy', host: ghoul, cards: ['Handcuffs'] },
    { name: 'a location', host: study, cards: ['Barricade', 'Hiding Spot'] },
  ])('offers the cards that attach to $name', ({ host, cards }) => {
    renderAttachedCards(ghoulInStudy(), host);

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
    renderAttachedCards(table, ghoul);

    tap('Attach a card');
    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Handcuffs' }));
    await act(async () => {});

    expect(table.board.enemy(ghoul)).toMatchObject({ attachments: ['Handcuffs'] });
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('attaches nothing on Cancel', () => {
    const table = ghoulInStudy();
    renderAttachedCards(table, ghoul);

    tap('Attach a card');
    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Cancel' }));

    expect(table.board.enemy(ghoul).attachments).toBeUndefined();
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('discards an attached card from its large view, which then closes', async () => {
    const table = ghoulInStudy();
    table.play({ type: 'AttachPlayerCard', hostId: study, code: barricade.code });
    renderAttachedCards(table, study);

    tap('Read Barricade');
    tap('Discard Barricade');
    await act(async () => {});

    expect(table.board.location(study).attachments).toBeUndefined();
    expect(screen.queryByRole('dialog', { name: 'Barricade' })).toBeNull();
  });

  it('fans the cards into the slot of the card dialog around it', () => {
    const table = ghoulInStudy();
    table.play({ type: 'AttachPlayerCard', hostId: ghoul, code: handcuffs.code });
    const slot = document.createElement('div');
    document.body.append(slot);
    render(
      <TuckedCardsContext.Provider value={slot}>
        <AttachedCards board={table.board} host={ghoul} actions={actionsOn(table)} busy={false} />
      </TuckedCardsContext.Provider>,
    );

    expect(
      within(slot)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Read Handcuffs', 'Attach a card']);
    slot.remove();
  });
});
