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

  it('heads the steps by round and phase in the order played, each with whose turn it was', () => {
    const table = PlayTable.start(rolandsTurn);
    table.takeDamage(byName('Roland Banks'), 2);
    table.endTurn(byName('Roland Banks'));

    render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
        state={table.state}
        onClose={() => {}}
      />,
    );

    const log = screen.getByRole('dialog', { name: 'Game log' });
    expect(
      within(log)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Setup', 'Round 1 · Investigation']);
    const investigation = within(log).getByRole('listitem', { name: 'Round 1 · Investigation' });
    const steps = [...investigation.querySelectorAll('ol > li')];
    expect(steps.map((step) => step.querySelector('p')?.textContent)).toEqual([
      undefined,
      'Roland Banks',
      'Roland Banks',
      'Roland Banks',
    ]);
    expect(steps.map((step) => step.querySelector('ul')?.textContent)).toEqual([
      'Investigation phase begins',
      "Roland Banks's turn begins",
      'Roland Banks takes 2 damage',
      "Roland Banks's turn ends",
    ]);
  });

  it('lets the players change how much they rely on the helpers, showing the level they chose', () => {
    const table = PlayTable.start(rolandsTurn);
    const onRelianceChange = vi.fn();
    render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
        state={table.state}
        reliance="assist"
        onRelianceChange={onRelianceChange}
        onClose={() => {}}
      />,
    );
    const choice = screen.getByRole('combobox', { name: 'What the app tells you' });

    fireEvent.change(choice, { target: { value: 'auto' } });

    expect(choice).toHaveProperty('value', 'assist');
    expect(onRelianceChange).toHaveBeenCalledWith('auto');
  });

  it("names the scenario over the title, as the page's kicker", () => {
    const table = PlayTable.start(rolandsTurn);
    render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
        state={table.state}
        scenario="The Gathering"
        onClose={() => {}}
      />,
    );

    const log = screen.getByRole('dialog', { name: 'Game log' });
    expect(within(log).getByText('The Gathering')).toBeTruthy();
  });

  it('closes from its × button', () => {
    const table = PlayTable.start(rolandsTurn);
    const onClose = vi.fn();
    render(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
        state={table.state}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

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
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
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
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
        state={table.state}
        onGoBack={() => {}}
        onClose={() => {}}
      />,
    );
    const newest = screen.getByText('Roland Banks takes 2 damage').closest('ol > li');
    expect(within(newest as HTMLElement).queryByRole('button')).toBeNull();

    rerender(
      <GameLogDialog
        log={{ ctx: table.ctx, entries: table.entries, stepTimes: new Map() }}
        state={table.state}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Go back here' })).toBeNull();
  });
});
