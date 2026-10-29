// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  perInvestigator,
  PlayTable,
  type CluePayerView,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { CardActions, cardActionsOn } from './ActionRow';
import { offersClueSplit } from './CluePaymentDialog';

const study = instanceId('study');
const alder = investigatorId('alder');
const bea = investigatorId('bea');

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

describe('offersClueSplit', () => {
  const payer = (name: string, clues: number): CluePayerView => ({
    id: investigatorId(name),
    name: name as CluePayerView['name'],
    clues,
    pays: 0,
  });

  it.each([
    { payers: [payer('alder', 3), payer('bea', 3)], required: 4, expected: true },
    { payers: [payer('alder', 3), payer('bea', 1)], required: 4, expected: false },
    { payers: [payer('alder', 5), payer('bea', 0)], required: 4, expected: false },
    { payers: [payer('alder', 5)], required: 4, expected: false },
  ])(
    'is $expected for $required clues from $payers.0.clues and $payers.1.clues',
    ({ payers, required, expected }) => {
      expect(offersClueSplit(payers, required)).toBe(expected);
    },
  );
});

describe('CardActions with a group clue cost', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /**
   * Alder (`alderClues`) and bea (`beaClues`) in the study on alder's turn; the study's action
   * costs 2 clues per investigator as a group: 4 for the two.
   */
  const studyWithGroupCost = (alderClues: number, beaClues: number) =>
    PlayTable.start(
      newGame()
        .withLocation(
          study,
          blankLocation('study', {
            name: 'Study',
            actions: [{ effects: [], cost: { spend: 'groupClues', amount: perInvestigator(2) } }],
          }),
          { revealed: true },
        )
        .withInvestigator(alder, { locationId: study, clues: alderClues })
        .withInvestigator(bea, { locationId: study, clues: beaClues })
        .withTurnOf(alder),
    );

  const renderStudyActions = (table: PlayTable) =>
    render(
      <CardActions
        board={table.board}
        offered={cardActionsOn(table.board, study)}
        actions={actionsOn(table)}
        busy={false}
      />,
    );

  it('lets the players have bea pay 3 of the 4 clues instead of alder’s 3 first', async () => {
    const table = studyWithGroupCost(3, 3);
    renderStudyActions(table);

    fireEvent.click(screen.getByRole('button', { name: 'Action · Study' }));
    const dialog = screen.getByRole('dialog', { name: 'Action · Study' });
    const startedAt = within(dialog).getByText('4 of 4 clues').textContent;
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lower the clues alder pays (holds 3)' }),
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lower the clues alder pays (holds 3)' }),
    );
    const payWhenShort = within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Pay' });
    const shortBy2 = payWhenShort.disabled;
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Raise the clues bea pays (holds 3)' }),
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Raise the clues bea pays (holds 3)' }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pay' }));
    await Promise.resolve();

    expect(startedAt).toBe('4 of 4 clues');
    expect(shortBy2).toBe(true);
    expect(table.board.investigator(alder).clues).toBe(2);
    expect(table.board.investigator(bea).clues).toBe(0);
  });

  it('takes nothing when the players cancel the split', () => {
    const table = studyWithGroupCost(3, 3);
    renderStudyActions(table);

    fireEvent.click(screen.getByRole('button', { name: 'Action · Study' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(table.board.investigator(alder).clues).toBe(3);
    expect(table.board.investigator(bea).clues).toBe(3);
  });

  it('pays at once, with no dialog, when the 4 clues are all alder and bea hold', async () => {
    const table = studyWithGroupCost(3, 1);
    renderStudyActions(table);

    fireEvent.click(screen.getByRole('button', { name: 'Action · Study' }));
    await Promise.resolve();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(table.board.investigator(alder).clues).toBe(0);
    expect(table.board.investigator(bea).clues).toBe(0);
  });
});
