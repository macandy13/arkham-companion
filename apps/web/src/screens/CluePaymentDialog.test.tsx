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
import { CardActions, cardActionsOn } from './ActionRow';
import { evenClueSplit, offersClueSplit } from './CluePaymentDialog';
import { actionsOn } from '../state/gameActions.test_support';

const study = instanceId('study');
const alder = investigatorId('alder');
const bea = investigatorId('bea');

/** A payer named `name` holding `clues`, paying none yet. */
const payer = (name: string, clues: number): CluePayerView => ({
  id: investigatorId(name),
  name: name as CluePayerView['name'],
  clues,
  pays: 0,
});

describe('offersClueSplit', () => {
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

describe('evenClueSplit', () => {
  it.each([
    { alderClues: 3, beaClues: 3, required: 4, alderPays: 2, beaPays: 2 },
    { alderClues: 3, beaClues: 3, required: 3, alderPays: 2, beaPays: 1 },
    { alderClues: 3, beaClues: 1, required: 4, alderPays: 3, beaPays: 1 },
    { alderClues: 0, beaClues: 3, required: 2, alderPays: 0, beaPays: 2 },
  ])(
    'has alder pay $alderPays and bea $beaPays of $required from $alderClues and $beaClues',
    ({ alderClues, beaClues, required, alderPays, beaPays }) => {
      const split = evenClueSplit([payer('alder', alderClues), payer('bea', beaClues)], required);

      expect([split.get(alder), split.get(bea)]).toEqual([alderPays, beaPays]);
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

  /** Renders the study's card actions and opens the clue payment dialog of its action. */
  const openStudyPayment = (table: PlayTable) => {
    render(
      <CardActions
        board={table.board}
        offered={cardActionsOn(table.board, study)}
        actions={actionsOn(table)}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Action · Study' }));
    return screen.getByRole('dialog', { name: 'Who pays the clues?' });
  };

  /** Whether each of the clue tokens named `names` in `dialog` is pressed, in that order. */
  const pressed = (dialog: HTMLElement, names: string[]) =>
    names.map((name) => within(dialog).getByRole('button', { name }).ariaPressed);

  it('asks for the 4 clues beside the Study, each payer a row with what they pay', () => {
    const dialog = openStudyPayment(studyWithGroupCost(3, 3));

    expect(within(dialog).getByRole('button', { name: 'Read Study' })).toBeTruthy();
    expect(within(dialog).getByText('Study · 4 clues as a group')).toBeTruthy();
    expect(
      within(dialog)
        .getAllByText(/^pays/)
        .map((line) => line.textContent),
    ).toEqual(['pays 3 of 3 clues', 'pays 1 of 3 clues']);
  });

  it('starts at the engine’s split, alder’s 3 first, and keeps Pay off once a token is kept', () => {
    const dialog = openStudyPayment(studyWithGroupCost(3, 3));

    expect(
      pressed(dialog, [
        'clue 1 of alder',
        'clue 2 of alder',
        'clue 3 of alder',
        'clue 1 of bea',
        'clue 2 of bea',
      ]),
    ).toEqual(['true', 'true', 'true', 'true', 'false']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'clue 3 of alder' }));

    expect(within(dialog).getByText(/^3 of 4 clues chosen/)).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Pay' }).disabled).toBe(
      true,
    );
  });

  it('lets the players have bea pay 3 of the 4 clues by tapping tokens', async () => {
    const table = studyWithGroupCost(3, 3);
    const dialog = openStudyPayment(table);
    const tap = (name: string) => fireEvent.click(within(dialog).getByRole('button', { name }));
    tap('clue 3 of alder');
    tap('clue 2 of alder');
    tap('clue 2 of bea');
    tap('clue 3 of bea');
    tap('Pay');
    await Promise.resolve();

    expect(table.board.investigator(alder).clues).toBe(2);
    expect(table.board.investigator(bea).clues).toBe(0);
  });

  it('splits the 4 clues evenly, 2 each, when the players ask', async () => {
    const table = studyWithGroupCost(3, 3);
    const dialog = openStudyPayment(table);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Split evenly' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pay' }));
    await Promise.resolve();

    expect(table.board.investigator(alder).clues).toBe(1);
    expect(table.board.investigator(bea).clues).toBe(1);
  });

  it('takes nothing when the players close the dialog', () => {
    const table = studyWithGroupCost(3, 3);
    const dialog = openStudyPayment(table);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(table.board.investigator(alder).clues).toBe(3);
    expect(table.board.investigator(bea).clues).toBe(3);
  });

  it('pays at once, with no dialog, when the 4 clues are all alder and bea hold', async () => {
    const table = studyWithGroupCost(3, 1);
    render(
      <CardActions
        board={table.board}
        offered={cardActionsOn(table.board, study)}
        actions={actionsOn(table)}
        busy={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Action · Study' }));
    await Promise.resolve();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(table.board.investigator(alder).clues).toBe(0);
    expect(table.board.investigator(bea).clues).toBe(0);
  });
});
