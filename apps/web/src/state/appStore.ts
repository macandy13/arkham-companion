import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameId, GameState, GameStore, GameSummary } from '@arkham/engine';
import { emptyState } from '@arkham/engine';

/** UI-facing state: the persisted game list plus the currently open game. */
export interface AppState {
  games: GameSummary[];
  /** Open game, if any; `state` is always the result of replaying its event log. */
  current?: { gameId: GameId; state: GameState };
  /** Reloads the game list from the `GameStore`. */
  refresh(): Promise<void>;
  /** Creates an empty game, reloads the list and opens it. */
  newGame(): Promise<GameId>;
  openGame(gameId: GameId): Promise<void>;
}

/**
 * Builds the app store around a `GameStore`. It is a factory (not a singleton)
 * so tests can inject an in-memory database; the app never touches IndexedDB
 * directly (CLAUDE.md ground rules). Engine commands will be dispatched from
 * here via `execute` + `appendEvents` once scenarios exist.
 */
export function createAppStore(gameStore: GameStore): StoreApi<AppState> {
  return createStore<AppState>((set, get) => ({
    games: [],
    async refresh() {
      set({ games: await gameStore.listGames() });
    },
    async newGame() {
      const gameId = await gameStore.createGame({});
      await get().refresh();
      await get().openGame(gameId);
      return gameId;
    },
    async openGame(gameId) {
      const loaded = await gameStore.loadGame(gameId);
      set({ current: { gameId, state: loaded?.state ?? emptyState() } });
    },
  }));
}
