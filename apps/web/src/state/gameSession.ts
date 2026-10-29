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
  takenAsAction,
} from '@arkham/engine';
import { runsBy } from '@arkham/util';
import { drawnCards, type DrawnCard } from '../encounter/drawnCards';

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
      /** The printed name of the card whose ability asked for it (`CommandSource`), if a card did. */
      readonly card?: string;
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
        if (takenAsAction(command)) return [];
        const investigator = state.investigators.find((inv) => inv.id === command.investigatorId);
        const source = command.source && state.cards[command.source.cardId];
        return [
          {
            kind: 'deferred',
            ...(source ? { card: nameOf(source.code) } : {}),
            investigator: investigator?.name ?? command.investigatorId,
            command,
          },
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
    /** The rules the game is played with, whose cards name what the log tells (`history`). */
    readonly ctx: ScenarioContext,
    private table: PlayTable,
    private lastSeq: number,
    private times: Map<string, number>,
  ) {}

  private skipped: readonly SkippedEffect[] = [];
  private drawn: readonly DrawnCard[] = [];

  /**
   * While the players adjust the board: the log the adjustment started from and the taps played on
   * the table since, in memory only, so "Done" can store them as one step.
   */
  private adjustment?: { base: readonly LoggedEvent[]; taps: PlayStep[] };

  /** The game `gameId` from its stored log, played with the rules of `ctx`. */
  static async open(store: GameStore, gameId: GameId, ctx: ScenarioContext): Promise<GameSession> {
    const { table, lastSeq, times } = await loadTable(store, gameId, ctx);
    return new GameSession(store, gameId, ctx, table, lastSeq, times);
  }

  /** The state after the last stored step, and while adjusting, after the adjustment's taps. */
  get state(): GameState {
    return this.table.state;
  }

  /** `state` read in game language (`BoardView`), with the names and thresholds of its cards. */
  get board(): BoardView {
    return this.table.board;
  }

  /**
   * Every event so far with its undo group, the scenario start included, for the game log
   * (`gameLog`); while adjusting, with the adjustment's taps.
   */
  get entries(): readonly LoggedEvent[] {
    return this.table.entries;
  }

  /**
   * When each stored step was stored (its first event's `StoredEvent.timestamp`), by `commandId`,
   * for the game log. A tap while adjusting has none until "Done" stores it.
   */
  get stepTimes(): ReadonlyMap<string, number> {
    return this.times;
  }

  /** What the last step played skipped for the players to do by hand; none after an undo. */
  get skippedEffects(): readonly SkippedEffect[] {
    return this.skipped;
  }

  /** The encounter cards the last step played drew or placed (`drawnCards`); none after an undo. */
  get drawnCards(): readonly DrawnCard[] {
    return this.drawn;
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
    const boardBefore = this.table.board;
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
      const [firstStored] = stored;
      if (firstStored) this.times.set(first.commandId, firstStored.timestamp);
    });
    // Only a step that counts replaces them: a refused tap leaves an unread notice in place.
    const events = added.map((entry) => entry.event);
    this.skipped = skippedEffects(this.ctx, this.state, events);
    this.drawn = drawnCards(boardBefore, this.board, events);
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
    this.drawn = [];
    this.table.undo();
    await this.storing(before, async () => {
      const loaded = await this.store.undoLast(this.gameId, this.lastSeq);
      this.lastSeq = loaded?.summary.lastSeq ?? 0;
    });
  }

  /**
   * Takes back every step after the step `stepId` (a `LoggedEvent.commandId`), one undo group at a
   * time like `undo`, so the game is as it was right after that step, in memory and in storage.
   * Does nothing for a step the log doesn't hold, and while adjusting, whose taps aren't steps of
   * the log yet. Not all or nothing: a failed write stops it part-way, at what is stored (`undo`).
   */
  async undoTo(stepId: string): Promise<void> {
    if (this.adjustment) return;
    const steps = runsBy(this.table.entries, (entry) => entry.commandId);
    const index = steps.findIndex((step) => step.key === stepId);
    if (index === -1) return;
    for (let later = steps.length - 1 - index; later > 0; later -= 1) await this.undo();
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
        ({
          table: this.table,
          lastSeq: this.lastSeq,
          times: this.times,
        } = await loadTable(this.store, this.gameId, this.ctx));
      } catch (reloadError) {
        console.warn(`Could not reload game ${this.gameId}; showing it as it was.`, reloadError);
      }
      throw error;
    }
  }
}

/**
 * The table for a stored game, the `seq` its next write expects and when each of its steps was
 * stored (`GameSession.stepTimes`).
 */
async function loadTable(
  store: GameStore,
  gameId: GameId,
  ctx: ScenarioContext,
): Promise<{ table: PlayTable; lastSeq: number; times: Map<string, number> }> {
  const stored = await store.loadEvents(gameId);
  const times = new Map<string, number>();
  for (const { commandId, timestamp } of stored)
    if (!times.has(commandId)) times.set(commandId, timestamp);
  return {
    table: PlayTable.resume(ctx, stored),
    lastSeq: stored.at(-1)?.seq ?? 0,
    times,
  };
}
