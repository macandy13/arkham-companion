// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankLocation,
  byName,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { ChangesNotice } from './ChangesNotice';

const study = instanceId('study');
const roland = investigatorId('roland');

/** The notice for what `table` holds now: its log, as the app store hands it over, and its state. */
const noticeFor = (table: PlayTable) => (
  <ChangesNotice
    log={{ ctx: table.ctx, entries: [...table.entries], stepTimes: new Map() }}
    state={table.state}
  />
);

describe('ChangesNotice', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /**
   * Roland Banks in the Study, his turn ended and the enemy phase begun: the next step is the
   * upkeep, which gives him 1 resource.
   */
  const beforeUpkeep = () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('Study'), { revealed: true })
        .withAgenda(instanceId('agenda'), blankAgenda('What Lurks Below', fixed(5)))
        .withInvestigator(roland, { name: 'Roland Banks', locationId: study })
        .withTurnOf(roland),
    );
    table.endTurn(byName('Roland Banks'));
    table.nextPhase();
    return table;
  };

  it('tells what the game did in a step played while it shows', () => {
    const table = beforeUpkeep();
    const { rerender } = render(noticeFor(table));

    table.nextPhase();
    rerender(noticeFor(table));

    const notice = screen.getByRole('status', { name: 'What the game did' });
    expect(within(notice).getByRole('listitem').textContent).toBe(
      'Roland Banks gains 1 resource (upkeep phase)',
    );
  });

  it('tells how to set a wrong change right', () => {
    const table = beforeUpkeep();
    const { rerender } = render(noticeFor(table));

    table.nextPhase();
    rerender(noticeFor(table));

    expect(
      within(screen.getByRole('status')).getByText(
        'Not right? Undo the step, or adjust it by hand.',
      ),
    ).toBeTruthy();
  });

  it('starts afresh for a step played while the last notice still shows', () => {
    const table = beforeUpkeep();
    const { rerender } = render(noticeFor(table));
    table.nextPhase();
    rerender(noticeFor(table));
    const upkeepNotice = screen.getByRole('status', { name: 'What the game did' });

    table.nextPhase();
    rerender(noticeFor(table));

    const mythosNotice = screen.getByRole('status', { name: 'What the game did' });
    expect(within(mythosNotice).getByRole('listitem').textContent).toBe(
      '1 doom on What Lurks Below (mythos phase)',
    );
    expect(mythosNotice).not.toBe(upkeepNotice);
  });

  it('goes once its fade has ended', () => {
    const table = beforeUpkeep();
    const { rerender } = render(noticeFor(table));
    table.nextPhase();
    rerender(noticeFor(table));

    // jsdom has no CSS animations, so React listens for the prefixed event there.
    fireEvent(
      screen.getByRole('status', { name: 'What the game did' }),
      new Event('webkitAnimationEnd', { bubbles: true }),
    );

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays quiet about the step the game opened at', () => {
    const table = beforeUpkeep();
    table.nextPhase();

    render(noticeFor(table));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays quiet about the earlier step that Undo goes back to', () => {
    const table = beforeUpkeep();
    table.nextPhase();
    table.nextPhase();
    const { rerender } = render(noticeFor(table));

    table.undo();
    rerender(noticeFor(table));

    expect(screen.queryByRole('status')).toBeNull();
  });
});
