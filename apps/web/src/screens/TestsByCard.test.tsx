// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  type BoardView,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { TestsByCard } from './TestsByCard';

const study = instanceId('study');
const hall = instanceId('hall');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const offered = () => screen.getAllByRole('button').map((button) => button.textContent);

describe('TestsByCard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  const renderTests = (board: BoardView, onTest = vi.fn()) => {
    render(<TestsByCard board={board} tests={['fight', 'evade']} busy={false} onTest={onTest} />);
    return onTest;
  };

  it('starts the fight for alder, the only investigator, on the first tap', () => {
    const alone = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study }),
    );
    const onTest = renderTests(alone.board);

    tap('Fight by card effect');

    expect(onTest).toHaveBeenCalledWith('fight', alder);
  });

  describe('with alder in the study and brook in the hall', () => {
    const apart = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: hall }),
      );

    it('asks who evades, then evades for brook', () => {
      const onTest = renderTests(apart().board);

      tap('Evade by card effect');

      expect(screen.getByRole('heading', { name: 'Who evades?' })).toBeDefined();
      expect(offered()).toEqual(['alder', 'brook', 'Cancel']);
      tap('Evade by card effect · brook');
      expect(onTest).toHaveBeenCalledWith('evade', brook);
    });

    it('goes back to the tests on cancel, without testing', () => {
      const onTest = renderTests(apart().board);

      tap('Fight by card effect');
      tap('Cancel');

      expect(offered()).toEqual(['Fight', 'Evade']);
      expect(onTest).not.toHaveBeenCalled();
    });
  });
});
