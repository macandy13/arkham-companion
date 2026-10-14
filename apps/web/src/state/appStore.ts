import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameId, GameState, GameStore, GameSummary } from '@arkham/engine';
import { emptyState } from '@arkham/engine';
import { parseGameExport, serialiseGameExport } from '../storage/gameExport';

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
  /** Renames a saved game and reloads the list. */
  renameGame(gameId: GameId, title: string): Promise<void>;
  /** Copies a saved game under `title` and reloads the list; returns the copy's id. */
  duplicateGame(gameId: GameId, title: string): Promise<GameId>;
  /** Deletes a saved game and reloads the list; closes it if it is the open one. */
  deleteGame(gameId: GameId): Promise<void>;
  /** JSON export text of a saved game (metadata, events, `stateVersion`). Rejects for unknown games. */
  exportGame(gameId: GameId): Promise<string>;
  /**
   * Creates a saved game from export text under a new id and reloads the list.
   * Rejects with a `GameImportError` if the text is not a valid export of this or an older version.
   */
  importGame(text: string): Promise<GameId>;
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
    async renameGame(gameId, title) {
      await gameStore.renameGame(gameId, title);
      await get().refresh();
    },
    async duplicateGame(gameId, title) {
      const copyId = await gameStore.duplicateGame(gameId, title);
      await get().refresh();
      return copyId;
    },
    async deleteGame(gameId) {
      await gameStore.deleteGame(gameId);
      if (get().current?.gameId === gameId) set({ current: undefined });
      await get().refresh();
    },
    async exportGame(gameId) {
      const loaded = await gameStore.loadGame(gameId);
      if (!loaded) throw new Error(`Unknown game ${gameId}`);
      const { title, createdAt } = loaded.summary;
      return serialiseGameExport(title, createdAt, await gameStore.loadEvents(gameId));
    },
    async importGame(text) {
      const gameId = await gameStore.importGame(parseGameExport(text));
      await get().refresh();
      return gameId;
    },
  }));
}
