import type { CampaignId, GameId, ScenarioId } from './ids';
import type { Event } from './events';
import type { GameState, Phase } from './state';

/** Version of the persisted `GameState` shape; bump together with a migration when `GameState` changes. */
export const STATE_VERSION = 1;

/** Optional metadata given to `GameStore.createGame`. */
export interface NewGame {
  /** Human-readable name shown in the game list. */
  title?: string;
  /** Campaign this game belongs to; absent in standalone play. */
  campaignId?: CampaignId;
}

/** Row of `GameStore.listGames`: enough to render a game list without loading events. */
export interface GameSummary {
  gameId: GameId;
  title: string;
  campaignId?: CampaignId;
  /** Epoch ms of creation, set by the store. */
  createdAt: number;
  /** Epoch ms of the last appended event (or creation). */
  updatedAt: number;
  /** Sequence number of the last event, 0 if the log is empty. */
  lastSeq: number;
  /** Scenario being played; empty until the scenario has started. Derived from the replayed state. */
  scenarioId: ScenarioId;
  /** Current round and phase of the replayed state, so the list can show progress. */
  round: number;
  phase: Phase;
  /** Seated investigators in seat order (`code` is the ArkhamDB card code, used to look up portraits). */
  investigators: { code: string; name: string }[];
}

/**
 * An `Event` as persisted in the append-only log. `seq` is 1-based and gapless
 * per game; `timestamp` is assigned by the store (the engine itself never reads clocks).
 * `commandId` groups the events of one player command (including its trigger
 * chain), which is the unit `GameStore.undoLast` removes.
 */
export interface StoredEvent {
  gameId: GameId;
  seq: number;
  /** Epoch ms. */
  timestamp: number;
  /** Shared by all events returned by one `execute` call; assigned by the store unless the caller passes one. */
  commandId: string;
  event: Event;
}

/** Cached `GameState` after applying all events up to and including `seq`. */
export interface Snapshot {
  gameId: GameId;
  seq: number;
  stateVersion: number;
  state: GameState;
}

/** Result of `GameStore.loadGame`: the state after replaying the whole log. */
export interface LoadedGame {
  summary: GameSummary;
  state: GameState;
}

/** A game to be restored by `GameStore.importGame`: an event log without ids, as found in an export file. */
export interface ImportedGame {
  title: string;
  /**
   * Original timestamps are kept so an imported game still shows when it was last played;
   * command ids are kept so undo still steps back one player command at a time.
   */
  events: readonly Pick<StoredEvent, 'timestamp' | 'commandId' | 'event'>[];
}

/**
 * Persistence boundary (architecture "Persistence"). The app only talks to this
 * interface; `IndexedDbStore` implements it now, a cloud store may later.
 * The event log is the source of truth, snapshots are only a speed-up.
 */
export interface GameStore {
  /** Creates an empty game (no events) and returns its new UUID. */
  createGame(init?: NewGame): Promise<GameId>;
  /**
   * Appends events to the log and returns them with assigned `seq`/`timestamp`.
   * If `expectedSeq` is given and differs from the current last seq, rejects
   * (optimistic concurrency for multiple tabs/devices) and writes nothing.
   * One call is one undo group: pass the events of exactly one command. The
   * store generates the `commandId` unless the caller supplies one (the engine
   * never generates IDs itself).
   */
  appendEvents(
    gameId: GameId,
    events: readonly Event[],
    expectedSeq?: number,
    commandId?: string,
  ): Promise<StoredEvent[]>;
  /**
   * Removes the last command group from the log, drops snapshots beyond the
   * new end and returns the game replayed to that point (unchanged if the log
   * is empty). Rejects like `appendEvents` if `expectedSeq` is stale; `undefined`
   * if the game doesn't exist. The RNG state is part of the replayed state, so
   * redoing a command after an undo reproduces the same shuffle.
   */
  undoLast(gameId: GameId, expectedSeq?: number): Promise<LoadedGame | undefined>;
  /** Latest snapshot + replay of the events after it; `undefined` if the game doesn't exist. */
  loadGame(gameId: GameId): Promise<LoadedGame | undefined>;
  /** All games, most recently updated first. */
  listGames(): Promise<GameSummary[]>;
  /** Changes the title of a game; does not count as play, so `updatedAt` stays. Rejects for unknown games. */
  renameGame(gameId: GameId, title: string): Promise<void>;
  /**
   * Copies a game including its event log under a new UUID, so both continue independently.
   * `title` defaults to the original's. Rejects for unknown games.
   */
  duplicateGame(gameId: GameId, title?: string): Promise<GameId>;
  /** Permanently removes a game with its events and snapshot; unknown games are ignored. */
  deleteGame(gameId: GameId): Promise<void>;
  /** Stored events of a game with `seq` greater than `afterSeq`, oldest first (for export and sync). */
  loadEvents(gameId: GameId, afterSeq?: number): Promise<StoredEvent[]>;
  /**
   * Creates a game under a new UUID from an exported log. Keeps the events' timestamps and
   * links no campaign (the original campaign does not exist on this device).
   */
  importGame(game: ImportedGame): Promise<GameId>;
  /** Stores a snapshot, replacing older ones of the same game. */
  saveSnapshot(gameId: GameId, seq: number, state: GameState): Promise<void>;
}
