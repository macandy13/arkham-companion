// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

/** The answers' buttons, which list under the dialog itself (the skills list in their section). */
const optionButtons = () =>
  screen
    .getAllByRole('listitem')
    .filter((item) => item.closest('section') === null)
    .map((item) => item.querySelector('button')?.textContent);

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

  describe('with the chaos draw', () => {
    /** Alder (intellect 3) investigating the Study (shroud 2) with a bag of one -2 token. */
    const aldersInvestigationWithAMinusTwo = () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study', { name: 'Study', shroud: 2 }), {
            revealed: true,
            clues: 1,
          })
          .withInvestigator(alder, {
            name: 'Alder',
            locationId: study,
            skills: { willpower: 1, intellect: 3, combat: 1, agility: 1 },
          })
          .withChaosBag(['-2'])
          .withTurnOf(alder),
      );
      table.investigate(alder, { result: 'open' });
      return table;
    };
    const suggestedOptions = () =>
      screen
        .getAllByRole('listitem')
        .flatMap((item) =>
          item.querySelectorAll('button[data-suggested]').length > 0 ? [item.textContent] : [],
        );

    it('marks the answer the calculation works out after the draw', () => {
      renderFirstDecision(aldersInvestigationWithAMinusTwo());
      expect(suggestedOptions()).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));

      const result = screen.getByRole('region', { name: 'Result' });
      expect(within(result).getByRole('status').textContent).toBe('Fail: 1 against 2, by 1');
      expect(suggestedOptions()).toEqual(['Failed']);
    });

    it("counts the players' modifier in", () => {
      renderFirstDecision(aldersInvestigationWithAMinusTwo());

      fireEvent.click(screen.getByRole('button', { name: 'Raise the Modifier' }));
      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));

      expect(suggestedOptions()).toEqual(['Passed']);
    });

    it("tests the decision's skill until the players switch to another", () => {
      renderFirstDecision(aldersInvestigationWithAMinusTwo());
      const pressed = () =>
        within(screen.getByRole('region', { name: 'Skills' }))
          .getAllByRole('button', { pressed: true })
          .map((skill) => skill.getAttribute('aria-label'));
      expect(pressed()).toEqual(['Intellect 3']);

      fireEvent.click(screen.getByRole('button', { name: 'Willpower 1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));

      expect(pressed()).toEqual(['Willpower 1']);
      expect(suggestedOptions()).toEqual(['Failed']);
      const result = screen.getByRole('region', { name: 'Result' });
      expect(within(result).getByRole('status').textContent).toBe('Fail: 0 against 2, by 2');
    });

    it.each([
      { answer: 'Failed', sends: ['fail', { margin: 1 }] },
      { answer: 'Passed', sends: ['pass', {}] },
    ])('answering "$answer" after the draw sends $sends', ({ answer, sends }) => {
      const table = aldersInvestigationWithAMinusTwo();
      const answered = vi.fn(async () => {});
      renderFirstDecision(table, { ...actionsOn(table), answer: answered });

      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));
      fireEvent.click(screen.getByRole('button', { name: answer }));

      expect(answered).toHaveBeenCalledWith(...sends);
    });

    it('offers no draw for the attack of opportunity an investigation provokes first', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, { locationId: study })
          .withCard(ghoul, blankEnemy('ghoul', { name: 'Ghoul' }), engagedWith(alder))
          .withChaosBag(['-2'])
          .withTurnOf(alder),
      );
      table.investigate(alder, { result: 'open' });

      renderFirstDecision(table);

      expect(screen.getByRole('heading').textContent).toBe('Attack of opportunity by Ghoul');
      expect(screen.queryByRole('button', { name: 'Draw a token' })).toBeNull();
    });
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
