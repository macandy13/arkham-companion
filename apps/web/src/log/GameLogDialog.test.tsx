// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  byName,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { GameLogDialog } from './GameLogDialog';

describe('GameLogDialog', () => {
  const study = instanceId('study');
  const roland = investigatorId('roland');
  beforeAll(() => initI18n('en'));
  afterEach(cleanup);

  /** Roland Banks in the Study, his turn begun. */
  const rolandsTurn = newGame()
    .withLocation(study, blankLocation('Study'), { revealed: true })
    .withInvestigator(roland, { name: 'Roland Banks', locationId: study })
    .withTurnOf(roland);

  it('lists each step with its lines, in the order they were played', () => {
    const table = PlayTable.start(rolandsTurn);
    table.takeDamage(byName('Roland Banks'), 2);
    table.endTurn(byName('Roland Banks'));

    render(
      <GameLogDialog
        history={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onClose={() => {}}
      />,
    );

    const steps = within(screen.getByRole('dialog', { name: 'Game log' }))
      .getAllByRole('listitem')
      .filter((item) => item.parentElement?.tagName === 'OL')
      .map((step) => step.textContent);
    expect(steps.slice(-2)).toEqual(['Roland Banks takes 2 damage', "Roland Banks's turn ends"]);
  });

  it('closes from its × button', () => {
    const table = PlayTable.start(rolandsTurn);
    const onClose = vi.fn();
    render(
      <GameLogDialog
        history={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close the game log' }));

    expect(onClose).toHaveBeenCalled();
  });
});
