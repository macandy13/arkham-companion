import type { PlayTable } from '@arkham/engine';
import { gameActions, type GameActions } from './gameActions';

/**
 * Actions that play on `table`, as the store's play on the open game; undo and adjusting do
 * nothing. Shared by the web tests that hand components a `GameActions` over a table they built,
 * so a change to `gameActions`' parameters is made here once.
 */
export const actionsOn = (table: PlayTable): GameActions =>
  gameActions(
    async (step) => step(table),
    async () => {},
    { start: async () => {}, finish: async () => {}, cancel: async () => {} },
  );
