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
        log={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onClose={() => {}}
      />,
    );

    const [steps] = within(screen.getByRole('dialog', { name: 'Game log' })).getAllByRole('list');
    expect([...(steps?.children ?? [])].map((step) => step.textContent)).toEqual([
      'The scenario begins',
      'Round 1: Investigation phase',
      "Roland Banks's turn begins",
      'Roland Banks takes 2 damage',
      "Roland Banks's turn ends",
    ]);
  });

  it('closes from its × button', () => {
    const table = PlayTable.start(rolandsTurn);
    const onClose = vi.fn();
    render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close the game log' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('goes back to a step after a confirm that counts the steps taken back, then closes', () => {
    const table = PlayTable.start(rolandsTurn);
    table.takeDamage(byName('Roland Banks'), 2);
    const damageStep = table.entries.at(-1)?.commandId;
    table.takeHorror(byName('Roland Banks'), 1);
    table.endTurn(byName('Roland Banks'));
    const onGoBack = vi.fn();
    const onClose = vi.fn();
    render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onGoBack={onGoBack}
        onClose={onClose}
      />,
    );
    const damage = screen.getByText('Roland Banks takes 2 damage').closest('ol > li');
    fireEvent.click(within(damage as HTMLElement).getByRole('button', { name: 'Go back here' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Go back to this step?' });
    expect(confirm.textContent).toContain('The 2 steps after it are taken back.');

    fireEvent.click(within(confirm).getByRole('button', { name: 'Go back here' }));

    expect(onGoBack).toHaveBeenCalledWith(damageStep);
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no way back from the newest step, nor while the screen cannot go back', () => {
    const table = PlayTable.start(rolandsTurn);
    table.takeDamage(byName('Roland Banks'), 2);
    const { rerender } = render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onGoBack={() => {}}
        onClose={() => {}}
      />,
    );
    const newest = screen.getByText('Roland Banks takes 2 damage').closest('ol > li');
    expect(within(newest as HTMLElement).queryByRole('button')).toBeNull();

    rerender(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries }}
        state={table.state}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Go back here' })).toBeNull();
  });
});
