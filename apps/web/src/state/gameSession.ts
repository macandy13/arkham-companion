import {
  CommandRejected,
  PlayTable,
  undoLastGroup,
  type GameId,
  type GameState,
  type GameStore,
  type LoggedEvent,
  type Rejection,
  type ScenarioContext,
} from '@arkham/engine';
import { runsBy } from '@arkham/util';

/**
 * One step the players take, in the game language of `PlayTable` (`moveTo`, `investigate`,
 * `answer`, `nextPhase`, …). The screen's skill tests come from the physical chaos bag, so its
 * action steps pass `result: 'open'` and report the outcome with `resolveTest`.
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
   * Plays `step` and stores the events it added, one undo group per step. Returns the reason if
   * the engine refused it (nothing is stored then). If storing fails, for example because another
   * tab wrote first, the session reloads the stored game and rejects.
   */
  async play(step: PlayStep): Promise<Rejection | undefined> {
    const before = this.table.entries.length;
    try {
      step(this.table);
    } catch (error) {
      if (error instanceof CommandRejected) return error.rejection;
      throw error;
    }
    await this.storing(() => this.append(this.table.entries.slice(before)));
    return undefined;
  }

  /**
   * Takes back the last step (`GameStore.undoLast`, the same group `PlayTable.undo` removes).
   * Does nothing when only the scenario start is left, which would leave nothing to play.
   */
  async undo(): Promise<void> {
    if (undoLastGroup(this.table.entries).kept.length === 0) return;
    this.table.undo();
    await this.storing(async () => {
      const loaded = await this.store.undoLast(this.gameId, this.lastSeq);
      this.lastSeq = loaded?.summary.lastSeq ?? 0;
    });
  }

  /** Stores `added` one group at a time, each under the group id the table gave it. */
  private async append(added: readonly LoggedEvent[]): Promise<void> {
    for (const group of runsBy(added, (entry) => entry.commandId)) {
      const events = group.items.map((entry) => entry.event);
      const stored = await this.store.appendEvents(this.gameId, events, this.lastSeq, group.key);
      this.lastSeq = stored.at(-1)?.seq ?? this.lastSeq;
    }
  }

  /** Runs a write; on failure the table goes back to what is stored, so memory never runs ahead. */
  private async storing(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      console.warn(`Could not store a step of game ${this.gameId}; reloading it.`, error);
      ({ table: this.table, lastSeq: this.lastSeq } = await loadTable(
        this.store,
        this.gameId,
        this.ctx,
      ));
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
