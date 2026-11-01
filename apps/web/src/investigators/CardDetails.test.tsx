// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  blankTreachery,
  decisionId,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  skillTest,
  threatAreaOf,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { DecisionHostContext, type OpenDecision } from '../screens/DetailsDialog';
import { actionsOn } from '../state/gameActions.test_support';
import { CardDetails } from './CardDetails';

const study = instanceId('study');
const fear = instanceId('fear');
const alder = investigatorId('alder');

describe('CardDetails', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /**
   * Frozen in Fear in alder's threat area, on alder's turn, with an action that tests willpower
   * (3), as a test to discard it would.
   */
  const fearOnAlder = () =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withCard(
          fear,
          blankTreachery('frozen_in_fear', { actions: [{ effects: [skillTest('willpower', 3)] }] }),
          threatAreaOf(alder),
        )
        .withTurnOf(alder),
    );

  /** Frozen in Fear's details under a game screen whose open decision is `decision`. */
  const fearDetailsWith = (
    table: PlayTable,
    setHosted: (hosted: boolean) => void,
    decision?: OpenDecision,
  ) => {
    const card = table.board.cardFace(fear);
    return (
      <DecisionHostContext.Provider value={{ decision, adjusting: false, setHosted }}>
        <CardDetails
          board={table.board}
          card={card}
          owner={table.board.investigator(alder)}
          heldIn="threatArea"
          actions={actionsOn(table)}
          busy={false}
          onClose={() => {}}
        />
      </DecisionHostContext.Provider>
    );
  };

  it("names alder's threat area in the kicker and offers the card's action", () => {
    render(fearDetailsWith(fearOnAlder(), vi.fn()));

    const details = screen.getByRole('dialog', { hidden: true, name: 'frozen_in_fear' });
    expect(within(details).getByText("In alder's threat area")).toBeDefined();
    expect(
      within(details).getByRole('button', { hidden: true, name: 'Action · frozen_in_fear' }),
    ).toBeDefined();
  });

  it('shows the test its action starts in the same dialog, the card still beside it', () => {
    const table = fearOnAlder();
    const setHosted = vi.fn();
    const { rerender } = render(fearDetailsWith(table, setHosted));
    const details = screen.getByRole('dialog', { hidden: true, name: 'frozen_in_fear' });

    fireEvent.click(
      within(details).getByRole('button', { hidden: true, name: 'Action · frozen_in_fear' }),
    );
    const [test] = table.board.decisions;
    if (!test) throw new Error('the willpower test waits to be drawn');
    rerender(fearDetailsWith(table, setHosted, { view: test, id: decisionId('the_test') }));

    expect(setHosted).toHaveBeenCalledWith(true);
    expect(
      within(details).getByRole('button', { hidden: true, name: 'Read frozen_in_fear' }),
    ).toBeDefined();
    expect(within(details).queryByText("In alder's threat area")).toBeNull();
  });
});
