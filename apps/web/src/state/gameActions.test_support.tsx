import type { ReactNode } from 'react';
import type { PlayTable } from '@arkham/engine';
import { PlayProvider } from '../screens/PlayContext';
import { gameActions, type GameActions } from './gameActions';

/**
 * Actions that play on `table`, as the store's play on the open game; undo does nothing. Shared by the web tests that hand components a `GameActions` over a table they built,
 * so a change to `gameActions`' parameters is made here once.
 */
export const actionsOn = (table: PlayTable): GameActions =>
  gameActions(
    async (step) => step(table),
    async () => {},
  );

/**
 * The play screen's `PlayProvider` for a part drawn alone in a test: its actions play on `table`
 * (`actionsOn`) unless the test gives its own `actions`, and while `busy` they are disabled. The
 * one provider the web tests wrap a part of the play screen in.
 */
export function PlayingOn({
  table,
  actions = actionsOn(table),
  busy = false,
  children,
}: {
  table: PlayTable;
  actions?: GameActions;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <PlayProvider actions={actions} busy={busy}>
      {children}
    </PlayProvider>
  );
}
