import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  Difficulty,
  GameId,
  GameState,
  GameStore,
  GameSummary,
  InvestigatorSeat,
  Rejection,
  ScenarioContext,
  ScenarioId,
} from '@arkham/engine';
import { emptyState, execute, scenario } from '@arkham/engine';
import { gameActions, type GameActions } from './gameActions';
import { GameSession, type PlayStep } from './gameSession';
import { findScenario, type ScenarioEntry } from '../scenarios/scenarioCatalog';
import { parseGameExport, serialiseGameExport } from '../storage/gameExport';

/** Everything the new game wizard has decided; input to `AppState.startScenario`. */
export interface ScenarioStart {
  /** Name shown in the game list. */
  title: string;
  /**
   * The scenario to set up (`scenario`) and its card data. Its `CardDb` must hold the seated
   * investigators' cards, since `compileSetup` takes their stats from it. The same context runs
   * the game, so the definition is given once and its hooks and reference card come with it.
   */
  ctx: ScenarioContext;
  difficulty: Difficulty;
  /** Seeds the game's RNG; chosen by the caller because the engine never reads randomness itself. */
  seed: number;
  /** In seat order; the first one is the lead investigator. */
  investigators: readonly InvestigatorSeat[];
}

/** The game on the play screen, as `AppState.openGame` loaded it and `AppState.actions` keep it. */
export interface OpenGame {
  gameId: GameId;
  /** Always the result of replaying the game's stored event log. */
  state: GameState;
  /**
   * Whether the game can be played: its scenario is in the catalog, which rebuilds the rules its
   * steps run with. A game not set up yet, or one imported from a newer app, can only be shown.
   */
  playable: boolean;
  /** Why the last action was refused, until the next action or `dismissRejection`. */
  rejection?: Rejection;
}

/** Looks a scenario up by id; `findScenario` in the app, a stub in tests. */
export type ScenarioLookup = (id: ScenarioId) => ScenarioEntry | undefined;

/** UI-facing state: the persisted game list plus the currently open game. */
export interface AppState {
  games: GameSummary[];
  /** Open game, if any. */
  current?: OpenGame;
  /** Reloads the game list from the `GameStore`. */
  refresh(): Promise<void>;
  /** Creates an empty game, reloads the list and opens it. */
  newGame(): Promise<GameId>;
  /**
   * Sets a scenario up (`compileSetup` + `StartScenario`), stores the resulting events as a new
   * game and opens it. Rejects with `CommandRejected` for invalid scenario data before anything is stored.
   */
  startScenario(start: ScenarioStart): Promise<GameId>;
  openGame(gameId: GameId): Promise<void>;
  /**
   * What the play screen can do to the open game (`GameActions`). Each action is stored before
   * the new state shows; a refused one stores nothing and sets `current.rejection`. Actions run
   * one after another in the order they were sent, so two quick taps never both build on the
   * same state. They reject if the open game is not `playable`.
   */
  actions: GameActions;
  /** Clears `current.rejection` once the screen has shown it. */
  dismissRejection(): void;
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

/** The rules a game of `scenarioId` runs with: its catalog entry's definition and cards. */
function contextFor(
  scenarioId: ScenarioId,
  scenarios: ScenarioLookup,
): ScenarioContext | undefined {
  const entry = scenarios(scenarioId);
  // Investigator cards are not needed: after setup the engine reads investigators from the state.
  return entry && { cards: entry.cards, scenario: entry.definition };
}

/**
 * Builds the app store around a `GameStore`. It is a factory (not a singleton)
 * so tests can inject an in-memory database and their own scenarios; the app
 * never touches IndexedDB directly (CLAUDE.md ground rules). It is the only
 * place that runs engine commands (`execute`) and writes their events.
 */
export function createAppStore(
  gameStore: GameStore,
  scenarios: ScenarioLookup = findScenario,
): StoreApi<AppState> {
  return createStore<AppState>((set, get) => {
    // Each step must see the state its predecessor left, so they run strictly one at a time.
    let stepQueue = Promise.resolve();
    // The table behind `current`; mutable, so it stays out of the published state.
    let session: GameSession | undefined;

    async function open(gameId: GameId): Promise<void> {
      const loaded = await gameStore.loadGame(gameId);
      const state = loaded?.state ?? emptyState();
      const ctx = loaded && contextFor(state.meta.scenarioId, scenarios);
      session = ctx && (await GameSession.open(gameStore, gameId, ctx));
      set({ current: { gameId, state: session?.state ?? state, playable: session !== undefined } });
    }

    /** Publishes the session's state, unless the player left the game while a write was pending. */
    function publish(played: GameSession, rejection?: Rejection): void {
      const current = get().current;
      if (current?.gameId !== played.gameId) return;
      set({ current: { ...current, state: played.state, rejection } });
    }

    async function playStep(step: PlayStep): Promise<void> {
      const played = session;
      if (!played) throw new Error('No playable game is open');
      try {
        publish(played, await played.play(step));
      } catch (error) {
        // The session reloaded what is stored; show that instead of the lost step.
        publish(played);
        throw error;
      }
    }

    async function undoStep(): Promise<void> {
      const played = session;
      if (!played) return;
      try {
        await played.undo();
      } finally {
        publish(played);
      }
    }

    /** Puts `task` behind every step and undo sent before it; a failed one doesn't block the rest. */
    function enqueue(task: () => Promise<void>): Promise<void> {
      const run = stepQueue.then(task);
      stepQueue = run.catch((error: unknown) => {
        console.warn('A queued game task failed.', error);
      });
      return run;
    }

    return {
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
      async startScenario({ title, ctx, difficulty, seed, investigators }) {
        const command = scenario.compileSetup(ctx, { difficulty, seed, investigators });
        const { events } = execute(ctx, emptyState(), command);
        const gameId = await gameStore.createGame({ title });
        await gameStore.appendEvents(gameId, events);
        await get().refresh();
        await get().openGame(gameId);
        return gameId;
      },
      openGame(gameId) {
        return enqueue(() => open(gameId));
      },
      actions: gameActions(
        (step) => enqueue(() => playStep(step)),
        () => enqueue(undoStep),
      ),
      dismissRejection() {
        const open = get().current;
        if (open?.rejection) set({ current: { ...open, rejection: undefined } });
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
        if (get().current?.gameId === gameId) {
          session = undefined;
          set({ current: undefined });
        }
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
    };
  });
}
