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

  it('heads the steps by round and phase, the newest first, each with whose turn it was', () => {
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
    ).toEqual(['Round 1 · Investigation', 'Setup']);
    const investigation = within(log).getByRole('listitem', { name: 'Round 1 · Investigation' });
    const steps = [...investigation.querySelectorAll('ol > li')];
    expect(steps.map((step) => step.querySelector('p')?.textContent)).toEqual([
      'Roland Banks',
      'Roland Banks',
      'Roland Banks',
      undefined,
    ]);
    expect(steps.map((step) => step.querySelector('ul')?.textContent)).toEqual([
      "Roland Banks's turn ends",
      'Roland Banks takes 2 damage',
      "Roland Banks's turn begins",
      'Investigation phase begins',
    ]);
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

    fireEvent.click(screen.getByRole('button', { name: 'Close the game log' }));

    expect(onClose).toHaveBeenCalled();
  });
});
