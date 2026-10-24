// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { DecisionDialog } from './DecisionDialog';

const study = instanceId('study');
const ghoul = instanceId('ghoul');
const alder = investigatorId('alder');

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

/** Shows the first open decision of `table` in the dialog. */
const renderFirstDecision = (table: PlayTable, actions = actionsOn(table)) => {
  const [decision] = table.board.decisions;
  if (!decision) throw new Error('a decision is open');
  render(<DecisionDialog board={table.board} decision={decision} actions={actions} busy={false} />);
};

const optionButtons = () =>
  screen.getAllByRole('listitem').map((item) => item.querySelector('button')?.textContent);

describe('DecisionDialog', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /** Alder at the Study (shroud 2, one clue), on their turn. */
  const aldersTurnInTheStudy = () =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study', { name: 'Study', shroud: 2 }), {
          revealed: true,
          clues: 1,
        })
        .withInvestigator(alder, { name: 'Alder', locationId: study })
        .withTurnOf(alder),
    );

  it('asks for the result of an investigation with the test and who is tested', () => {
    const table = aldersTurnInTheStudy();
    table.investigate(alder, { result: 'open' });

    renderFirstDecision(table);

    expect(screen.getByRole('heading').textContent).toBe('Investigate Study');
    expect(screen.getByText('Alder decides')).toBeDefined();
    expect(screen.getByText('Intellect test (2)')).toBeDefined();
    expect(optionButtons()).toEqual(['Passed', 'Failed']);
  });

  it.each([
    { answer: 'Passed', clues: 1 },
    { answer: 'Failed', clues: 0 },
  ])('answering the investigation "$answer" finds $clues clues', ({ answer, clues }) => {
    const table = aldersTurnInTheStudy();
    table.investigate(alder, { result: 'open' });
    renderFirstDecision(table);

    fireEvent.click(screen.getByRole('button', { name: answer }));

    expect(table.board.decisions).toEqual([]);
    expect(table.board.investigator(alder)).toMatchObject({ clues });
  });

  it('answers an option whose readable name differs from its id', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withCard(
          ghoul,
          blankEnemy('ghoul', { name: 'Ghoul', damage: 1, horror: 2 }),
          engagedWith(alder),
        )
        .withTurnOf(alder),
    );
    table.investigate(alder, { result: 'open' });
    renderFirstDecision(table);

    fireEvent.click(screen.getByRole('button', { name: 'Does not provoke' }));

    expect(table.board.investigator(alder)).toMatchObject({ damage: 0, horror: 0 });
    expect(table.board.decisions).toMatchObject([{ prompt: 'decision.investigate' }]);
    expect(screen.getByRole('heading').textContent).toBe('Attack of opportunity by Ghoul');
  });

  it.each([
    { button: 'Undo', calls: 'undo' },
    { button: 'Adjust board', calls: 'start adjusting' },
  ])('calls $calls from its $button button', ({ button, calls }) => {
    const table = aldersTurnInTheStudy();
    table.investigate(alder, { result: 'open' });
    const called: string[] = [];
    const actions = gameActions(
      async (step) => step(table),
      async () => void called.push('undo'),
      {
        start: async () => void called.push('start adjusting'),
        finish: async () => {},
        cancel: async () => {},
      },
    );
    renderFirstDecision(table, actions);

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(called).toEqual([calls]);
  });
});
