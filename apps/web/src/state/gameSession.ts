import {
  CommandRejected,
  type AbilityEffectSkipped,
  type CardCode,
  type BoardView,
  type PlayerCardCommand,
  type Event,
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
 * A card effect the players resolve by hand, in their words: one the engine skipped because a card
 * it names is not in the game exactly once (`AbilityEffectSkipped`), or a card effect on an
 * investigator's own cards, which the game doesn't hold (`CommandDeferred` without `asAction`).
 */
export type SkippedEffect =
  | {
      readonly kind: 'missingCard';
      /** The printed name of the card whose ability it is. */
      readonly card: string;
      /** What the effect would have done. */
      readonly effect: AbilityEffectSkipped['effect'];
      /** The printed names of the cards it could not find. */
      readonly missing: readonly string[];
    }
  | {
      readonly kind: 'deferred';
      /** The name of the investigator whose cards it is about. */
      readonly investigator: string;
      readonly command: PlayerCardCommand;
    };

/** The effects `events` leave to the players, named with the cards of `ctx`; `state` holds the cards they name. */
export function skippedEffects(
  ctx: ScenarioContext,
  state: GameState,
  events: readonly Event[],
): SkippedEffect[] {
  // A code the cards don't know (a typo in the scenario data) has no name; the code is all there is.
  const nameOf = (code: CardCode) => ctx.cards.get(code)?.name ?? code;
  return events.flatMap((event): SkippedEffect[] => {
    switch (event.type) {
      case 'AbilityEffectSkipped': {
        const card = state.cards[event.cardId];
        return [
          {
            kind: 'missingCard',
            card: card ? nameOf(card.code) : event.cardId,
            effect: event.effect,
            missing: event.missing.map(nameOf),
          },
        ];
      }
      case 'CommandDeferred': {
        const { command } = event;
        // The players took it as an action at the table themselves, so there is nothing to remind them of.
        if ('asAction' in command && command.asAction) return [];
        const investigator = state.investigators.find((inv) => inv.id === command.investigatorId);
        return [
          { kind: 'deferred', investigator: investigator?.name ?? command.investigatorId, command },
        ];
      }
      default:
        return [];
    }
  });
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

  private skipped: readonly SkippedEffect[] = [];

  /**
   * While the players adjust the board: the log the adjustment started from and the taps played on
   * the table since, in memory only, so "Done" can store them as one step.
   */
  private adjustment?: { base: readonly LoggedEvent[]; taps: PlayStep[] };

  /** The game `gameId` from its stored log, played with the rules of `ctx`. */
  static async open(store: GameStore, gameId: GameId, ctx: ScenarioContext): Promise<GameSession> {
    const { table, lastSeq } = await loadTable(store, gameId, ctx);
    return new GameSession(store, gameId, ctx, table, lastSeq);
  }

  /** The state after the last stored step, and while adjusting, after the adjustment's taps. */
  get state(): GameState {
    return this.table.state;
  }

  /** `state` read in game language (`BoardView`), with the names and thresholds of its cards. */
  get board(): BoardView {
    return this.table.board;
  }

  /** What the last step played skipped for the players to do by hand; none after an undo. */
  get skippedEffects(): readonly SkippedEffect[] {
    return this.skipped;
  }

  /**
   * Whether `undo` has a step to take back; the scenario start never counts. While adjusting, only
   * the adjustment's own taps count.
   */
  get canUndo(): boolean {
    return this.adjustment ? this.adjustment.taps.length > 0 : this.table.canUndo;
  }

  /** Whether the players are adjusting the board (`startAdjusting`). */
  get adjusting(): boolean {
    return this.adjustment !== undefined;
  }

  /**
   * Starts an adjustment: from now on `play` changes the table in memory only, until
   * `finishAdjusting` stores every tap as one step or `cancelAdjusting` drops them. One undo then
   * takes a whole correction back, however many counters it changed. Every step joins it, not only
   * corrections, so the screen offers only corrections meanwhile; effects a tap skipped show once
   * the adjustment is stored.
   */
  startAdjusting(): void {
    this.adjustment ??= { base: this.table.entries, taps: [] };
  }

  /**
   * Stores the adjustment's taps as one step (one undo group) and ends it. The taps are played
   * again from where the adjustment started, so they land in the log as if played in one go. Like
   * any step, a refused replay or a failed write keeps nothing of it: the whole correction is lost
   * then, and the board shows what is stored.
   */
  async finishAdjusting(): Promise<Rejection | undefined> {
    const adjustment = this.adjustment;
    if (!adjustment) return undefined;
    this.adjustment = undefined;
    this.table = PlayTable.resume(this.ctx, adjustment.base);
    return this.play((table) => adjustment.taps.forEach((tap) => tap(table)));
  }

  /** Ends the adjustment and drops its taps; nothing was stored. */
  cancelAdjusting(): void {
    const adjustment = this.adjustment;
    if (!adjustment) return;
    this.adjustment = undefined;
    this.table = PlayTable.resume(this.ctx, adjustment.base);
  }

  /**
   * Plays `step` as one step (`PlayTable.step`: one undo group, nothing kept if any verb fails)
   * and stores the events it added. Returns the reason if the engine refused it (nothing is
   * stored then). If storing fails, for example because another tab wrote first, the session
   * reloads the stored game and rejects. While adjusting, the step only changes the table in
   * memory and joins the adjustment.
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
    if (this.adjustment) {
      // A tap that changed nothing has no undo group of its own, so undo must not count it.
      if (added.length > 0) this.adjustment.taps.push(step);
      return undefined;
    }
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
    // Only a step that counts replaces them: a refused tap leaves an unread notice in place.
    this.skipped = skippedEffects(
      this.ctx,
      this.state,
      added.map((entry) => entry.event),
    );
    return undefined;
  }

  /**
   * Takes back the last step (`GameStore.undoLast`, the same group `PlayTable.undo` removes).
   * Does nothing when only the scenario start is left, which would leave nothing to play. While
   * adjusting, it takes back the adjustment's last tap, in memory like the tap itself.
   */
  async undo(): Promise<void> {
    if (this.adjustment) {
      // Before the first tap there is nothing of the adjustment's own to take back.
      if (this.adjustment.taps.pop()) this.table.undo();
      return;
    }
    if (!this.table.canUndo) return;
    const before = this.table.entries;
    this.skipped = [];
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
