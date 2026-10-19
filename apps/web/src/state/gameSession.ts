import {
  CommandRejected,
  PlayTable,
  type GameId,
  type GameState,
  type GameStore,
  type LoggedEvent,
  type Rejection,
  type ScenarioContext,
  type SetupOptions,
} from '@arkham/engine';

/**
 * Sets `ctx.scenario` up as a new saved game called `title` (`PlayTable.setUp`) and stores the
 * setup as its first step, which undo never takes back. A refused setup stores nothing.
 */
export async function startGame(
  store: GameStore,
  title: string,
  ctx: ScenarioContext,
  options: SetupOptions,
): Promise<GameId> {
  const { entries } = PlayTable.setUp(ctx, options);
  const gameId = await store.createGame({ title });
  const events = entries.map((entry) => entry.event);
  await store.appendEvents(gameId, events, undefined, entries[0]?.commandId);
  return gameId;
}

/**
 * One step the players take, in the game language of `PlayTable` (`moveTo`, `investigate`,
 * `answer`, `nextPhase`, …). Only `GameActions` writes steps, so the table's test defaults never
 * reach the screen.
 */
export type PlayStep = (table: PlayTable) => void;

/**
 * A saved game being played: a `PlayTable` resumed from the game's stored log, which writes
 * every step's events through the `GameStore` before its state counts. It is the buffer between
 * the pure engine and the screen: the table keeps the game vocabulary and the rule checks, the
 * session adds storage, and the app store only publishes `state` to React.
 */
export class GameSession {
  private constructor(
    private readonly store: GameStore,
    readonly gameId: GameId,
    private readonly ctx: ScenarioContext,
    private table: PlayTable,
    private lastSeq: number,
  ) {}

  /** The game `gameId` from its stored log, played with the rules of `ctx`. */
  static async open(store: GameStore, gameId: GameId, ctx: ScenarioContext): Promise<GameSession> {
    const { table, lastSeq } = await loadTable(store, gameId, ctx);
    return new GameSession(store, gameId, ctx, table, lastSeq);
  }

  /** The state after the last stored step. */
  get state(): GameState {
    return this.table.state;
  }

  /**
   * Plays `step` as one step (`PlayTable.step`: one undo group, nothing kept if any verb fails)
   * and stores the events it added. Returns the reason if the engine refused it (nothing is
   * stored then). If storing fails, for example because another tab wrote first, the session
   * reloads the stored game and rejects.
   */
  async play(step: PlayStep): Promise<Rejection | undefined> {
    const before = this.table.entries;
    try {
      this.table.step(() => step(this.table));
    } catch (error) {
      if (error instanceof CommandRejected) return error.rejection;
      throw error;
    }
    const added = this.table.entries.slice(before.length);
    const [first] = added;
    if (first === undefined) return undefined;
    await this.storing(before, async () => {
      const events = added.map((entry) => entry.event);
      const stored = await this.store.appendEvents(
        this.gameId,
        events,
        this.lastSeq,
        first.commandId,
      );
      this.lastSeq = stored.at(-1)?.seq ?? this.lastSeq;
    });
    return undefined;
  }

  /**
   * Takes back the last step (`GameStore.undoLast`, the same group `PlayTable.undo` removes).
   * Does nothing when only the scenario start is left, which would leave nothing to play.
   */
  async undo(): Promise<void> {
    if (!this.table.canUndo) return;
    const before = this.table.entries;
    this.table.undo();
    await this.storing(before, async () => {
      const loaded = await this.store.undoLast(this.gameId, this.lastSeq);
      this.lastSeq = loaded?.summary.lastSeq ?? 0;
    });
  }

  /**
   * Runs a write of what changed since `before`. If it fails, the table first goes back to
   * `before`, so memory never shows what was not stored, then reloads what is stored, which may
   * include another tab's steps.
   */
  private async storing(before: readonly LoggedEvent[], write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      this.table = PlayTable.resume(this.ctx, before);
      try {
        ({ table: this.table, lastSeq: this.lastSeq } = await loadTable(
          this.store,
          this.gameId,
          this.ctx,
        ));
      } catch (reloadError) {
        console.warn(`Could not reload game ${this.gameId}; showing it as it was.`, reloadError);
      }
      throw error;
    }
  }
}

/** The table for a stored game and the `seq` its next write expects. */
async function loadTable(
  store: GameStore,
  gameId: GameId,
  ctx: ScenarioContext,
): Promise<{ table: PlayTable; lastSeq: number }> {
  const stored = await store.loadEvents(gameId);
  return {
    table: PlayTable.resume(ctx, stored),
    lastSeq: stored.at(-1)?.seq ?? 0,
  };
}
