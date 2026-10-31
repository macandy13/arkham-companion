// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  atLocation,
  blankEnemy,
  fixed,
  blankLocation,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  zoneOf,
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

/** The answers' buttons, leaving out the skill toggles, whose list sits in a section. */
const optionButtons = () =>
  screen
    .getAllByRole('listitem')
    .filter((item) => item.closest('section') === null)
    .map((item) => item.querySelector(':scope > button > span:last-child')?.textContent);

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

  it('asks for the result of an investigation with the test and who is tested, the Study beside it', () => {
    const table = aldersTurnInTheStudy();
    table.investigate(alder, { result: 'open' });

    renderFirstDecision(table);

    expect(screen.getByRole('button', { name: 'Read Study' })).toBeDefined();
    expect(screen.getByRole('heading').textContent).toBe('Investigate Study');
    expect(screen.getByText('Alder decides')).toBeDefined();
    expect(screen.getByText('Intellect test (2)')).toBeDefined();
    expect(optionButtons()).toEqual(['Passed', 'Failed']);
  });

  it.each([
    { answer: 'Passed', taps: ['Passed', 'Done'], clues: 1 },
    { answer: 'Failed', taps: ['Failed'], clues: 0 },
  ])(
    'answering the investigation "$answer" (tapping $taps) finds $clues clues',
    ({ taps, clues }) => {
      const table = aldersTurnInTheStudy();
      table.investigate(alder, { result: 'open' });
      renderFirstDecision(table);

      for (const tap of taps) fireEvent.click(screen.getByRole('button', { name: tap }));

      expect(table.board.decisions).toEqual([]);
      expect(table.board.investigator(alder)).toMatchObject({ clues });
    },
  );

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

  it('names the action that provoked an attack of opportunity', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study', { name: 'Study' }), { revealed: true })
        .withInvestigator(alder, { name: 'Alder', locationId: study })
        .withCard(ghoul, blankEnemy('ghoul', { name: 'Ghoul' }), engagedWith(alder))
        .withTurnOf(alder),
    );
    table.investigate(alder, { result: 'open' });

    renderFirstDecision(table);

    expect(screen.getByText('Alder investigates Study: Ghoul attacks first')).toBeDefined();
  });

  it('tells two copies of one enemy apart by their location', () => {
    const hallway = instanceId('hallway');
    const attic = instanceId('attic');
    const studyGhoul = instanceId('study_ghoul');
    const hallwayGhoul = instanceId('hallway_ghoul');
    const ghoulMinion = blankEnemy('ghoul_minion', {
      name: 'Ghoul Minion',
      keywords: [{ name: 'hunter' }],
    });
    /** Study - Hallway - Attic with Alder in the Attic: both hunting ghouls have a step to take. */
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study', { name: 'Study' }), { revealed: true })
        .withLocation(hallway, blankLocation('hallway', { name: 'Hallway' }), { revealed: true })
        .withLocation(attic, blankLocation('attic', { name: 'Attic' }), { revealed: true })
        .withConnection(study, hallway)
        .withConnection(hallway, attic)
        .withInvestigator(alder, { locationId: attic })
        .withCard(studyGhoul, ghoulMinion, atLocation(study))
        .withCard(hallwayGhoul, ghoulMinion, atLocation(hallway)),
    );
    table.play({ type: 'MoveHunters' });
    renderFirstDecision(table);
    expect(optionButtons()).toEqual(['Ghoul Minion (Study)', 'Ghoul Minion (Hallway)']);

    fireEvent.click(screen.getByRole('button', { name: 'Ghoul Minion (Hallway)' }));

    expect(zoneOf(table.state, hallwayGhoul)).toEqual(engagedWith(alder));
    expect(zoneOf(table.state, studyGhoul)).toEqual(atLocation(hallway));
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
      screen.getAllByRole('listitem').flatMap((item) => {
        const suggested = item.querySelector(':scope > button[data-suggested] > span:last-child');
        return suggested ? [suggested.textContent] : [];
      });

    it('marks the answer the calculation works out after the draw', () => {
      renderFirstDecision(aldersInvestigationWithAMinusTwo());
      expect(suggestedOptions()).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));

      const result = screen.getByRole('region', { name: 'Result' });
      expect(within(result).getByRole('status').textContent).toBe('Fail 1 < 2 by 1');
      expect(suggestedOptions()).toEqual(['Failed']);
    });

    it("counts the players' modifier in", () => {
      renderFirstDecision(aldersInvestigationWithAMinusTwo());

      fireEvent.click(screen.getByRole('button', { name: 'Raise the Modifier' }));
      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));

      expect(suggestedOptions()).toEqual(['Passed']);
    });

    it("tests the decision's skill until the players switch to another, adding it, then dropping the first", () => {
      const table = aldersInvestigationWithAMinusTwo();
      const answered = vi.fn(async () => {});
      renderFirstDecision(table, { ...actionsOn(table), answer: answered });
      const pressed = () =>
        within(screen.getByRole('region', { name: 'Skills' }))
          .getAllByRole('button', { pressed: true })
          .map((skill) => skill.getAttribute('aria-label'));
      expect(pressed()).toEqual(['Intellect 3']);

      fireEvent.click(screen.getByRole('button', { name: 'Willpower 1' }));
      expect(pressed()).toEqual(['Willpower 1', 'Intellect 3']);
      fireEvent.click(screen.getByRole('button', { name: 'Intellect 3' }));
      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));

      expect(pressed()).toEqual(['Willpower 1']);
      // Willpower 1 with the -2 is 0 against the shroud of 2, where intellect would fail by 1.
      fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
      expect(answered).toHaveBeenCalledWith('fail', { margin: 2 });
    });

    it.each([
      { answer: 'Failed', taps: ['Failed'], sends: ['fail', { margin: 1 }] },
      { answer: 'Passed', taps: ['Passed', 'Done'], sends: ['pass', { amount: 1 }] },
    ])('answering "$answer" after the draw sends $sends', ({ taps, sends }) => {
      const table = aldersInvestigationWithAMinusTwo();
      const answered = vi.fn(async () => {});
      renderFirstDecision(table, { ...actionsOn(table), answer: answered });

      fireEvent.click(screen.getByRole('button', { name: 'Draw a token' }));
      for (const tap of taps) fireEvent.click(screen.getByRole('button', { name: tap }));

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

  describe('with counts', () => {
    it('picks a row with counts on tap and waits for Done, the attack picked from the start', () => {
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
      const attack = screen.getByRole('button', { name: 'Take the attack' });
      expect(attack.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(attack);

      expect(table.board.decisions).toMatchObject([{ prompt: 'decision.attackOfOpportunity' }]);
      expect(screen.getByText('from the game')).toBeDefined();
    });

    it('discovers as many clues as the players raise the count to, up to those on the location', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study', { name: 'Study', shroud: 2 }), {
            revealed: true,
            clues: 2,
          })
          .withInvestigator(alder, { name: 'Alder', locationId: study })
          .withTurnOf(alder),
      );
      table.investigate(alder, { result: 'open' });
      renderFirstDecision(table);

      fireEvent.click(screen.getByRole('button', { name: 'Raise the Clues discovered' }));
      const raise = screen.getByRole<HTMLButtonElement>('button', {
        name: 'Raise the Clues discovered',
      });
      expect(raise.disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(table.board.investigator(alder)).toMatchObject({ clues: 2 });
    });

    it('deals the damage the players set for a passed fight', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, { name: 'Alder', locationId: study })
          .withCard(
            ghoul,
            blankEnemy('ghoul', { name: 'Ghoul', health: fixed(3) }),
            engagedWith(alder),
          )
          .withTurnOf(alder),
      );
      table.fight(alder, ghoul, { result: 'open' });
      renderFirstDecision(table);

      fireEvent.click(screen.getByRole('button', { name: 'Raise the Damage dealt' }));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(table.board.enemy(ghoul)).toMatchObject({ damage: 2 });
    });

    it("takes an attack of opportunity's damage and horror as the players lower them", () => {
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

      fireEvent.click(screen.getByRole('button', { name: 'Lower the Damage' }));
      fireEvent.click(screen.getByRole('button', { name: 'Lower the Horror' }));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(table.board.investigator(alder)).toMatchObject({ damage: 0, horror: 1 });
    });
  });

  it('takes back the step that raised it with Undo, and offers no Adjust board of its own', () => {
    const table = aldersTurnInTheStudy();
    table.investigate(alder, { result: 'open' });
    const undone = vi.fn(async () => {});
    renderFirstDecision(table, { ...actionsOn(table), undo: undone });

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(undone).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Adjust board' })).toBeNull();
  });
});
