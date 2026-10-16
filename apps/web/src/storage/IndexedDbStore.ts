import Dexie, { type EntityTable } from 'dexie';
import {
  STATE_VERSION,
  undoLastGroup,
  replay,
  type Event,
  type GameId,
  type GameState,
  type GameStore,
  type GameSummary,
  type LoadedGame,
  type NewGame,
  type Snapshot,
  type StoredEvent,
} from '@arkham/engine';
import type { CardCatalog, CardDef } from '@arkham/carddata';

/** Row of the `games` table: a `GameSummary` is derived from it. */
interface GameRow {
  gameId: GameId;
  title: string;
  campaignId?: string;
  createdAt: number;
  updatedAt: number;
  lastSeq: number;
}

/** Row of the `campaigns` table; campaign mode is not implemented yet (architecture §8). */
interface CampaignRow {
  campaignId: string;
  title: string;
  createdAt: number;
}

/** Row of the `cards` table: one normalised card of one language, keyed by `key`. */
interface CardRow {
  /** `${lang}:${code}` – a compound string key keeps the schema simple. */
  key: string;
  lang: string;
  packCode: string;
  card: CardDef;
}

/** Row of the `catalog` table: the investigator catalog of one language, cached as a unit. */
interface CatalogRow {
  lang: string;
  catalog: CardCatalog;
}

/** Thrown by `appendEvents` when `expectedSeq` doesn't match the stored log. */
export class SeqConflictError extends Error {
  constructor(
    readonly gameId: GameId,
    readonly expectedSeq: number,
    readonly actualSeq: number,
  ) {
    super(`Game ${gameId}: expected last seq ${expectedSeq}, found ${actualSeq}`);
    this.name = 'SeqConflictError';
  }
}

/** Dexie schema (architecture §10). Bump `version()` and add `upgrade` when it changes. */
class ArkhamDb extends Dexie {
  campaigns!: EntityTable<CampaignRow, 'campaignId'>;
  games!: EntityTable<GameRow, 'gameId'>;
  /** Append-only event log, primary key `[gameId+seq]`. */
  events!: EntityTable<StoredEvent, 'seq'>;
  /** At most one snapshot per game. */
  snapshots!: EntityTable<Snapshot, 'gameId'>;
  cards!: EntityTable<CardRow, 'key'>;
  /** Separate from `cards`: the catalog is one derived document with its own `Last-Modified`. */
  catalog!: EntityTable<CatalogRow, 'lang'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      campaigns: 'campaignId',
      games: 'gameId, updatedAt',
      events: '[gameId+seq]',
      snapshots: 'gameId',
      cards: 'key, [lang+packCode]',
    });
    this.version(2).stores({ catalog: 'lang' });
  }
}

/** Write a snapshot automatically once this many events lie beyond the last one. */
const SNAPSHOT_INTERVAL = 50;

/**
 * `GameStore` backed by IndexedDB via Dexie. This is the only place in the app
 * that talks to IndexedDB. It may use clocks and UUIDs because it lives outside the engine.
 */
export class IndexedDbStore implements GameStore {
  private readonly db: ArkhamDb;

  constructor(dbName = 'arkham-companion') {
    this.db = new ArkhamDb(dbName);
  }

  async createGame(init: NewGame = {}): Promise<GameId> {
    const gameId = crypto.randomUUID();
    const now = Date.now();
    await this.db.games.add({
      gameId,
      title: init.title ?? 'New game',
      campaignId: init.campaignId,
      createdAt: now,
      updatedAt: now,
      lastSeq: 0,
    });
    return gameId;
  }

  async appendEvents(
    gameId: GameId,
    events: readonly Event[],
    expectedSeq?: number,
    commandId: string = crypto.randomUUID(),
  ): Promise<StoredEvent[]> {
    return this.db.transaction('rw', this.db.games, this.db.events, this.db.snapshots, async () => {
      const game = await this.db.games.get(gameId);
      if (!game) throw new Error(`Unknown game ${gameId}`);
      if (expectedSeq !== undefined && expectedSeq !== game.lastSeq) {
        throw new SeqConflictError(gameId, expectedSeq, game.lastSeq);
      }
      if (events.length === 0) return [];
      const timestamp = Date.now();
      const stored = events.map((event, i): StoredEvent => ({
        gameId,
        seq: game.lastSeq + i + 1,
        timestamp,
        commandId,
        event,
      }));
      await this.db.events.bulkAdd(stored);
      await this.db.games.update(gameId, {
        lastSeq: game.lastSeq + stored.length,
        updatedAt: timestamp,
      });
      return stored;
    });
  }

  async loadGame(gameId: GameId): Promise<LoadedGame | undefined> {
    const game = await this.db.games.get(gameId);
    if (!game) return undefined;
    let snapshot = await this.db.snapshots.get(gameId);
    if (snapshot && snapshot.stateVersion !== STATE_VERSION) snapshot = undefined; // no migrations yet: replay instead
    const fromSeq = snapshot?.seq ?? 0;
    const tail = await this.db.events
      .where('[gameId+seq]')
      .between([gameId, fromSeq], [gameId, Dexie.maxKey], false, true)
      .toArray();
    const state = replay(
      tail.map((e) => e.event),
      snapshot?.state,
    );
    // Opportunistic snapshot so long games don't replay from scratch on every refresh.
    if (tail.length >= SNAPSHOT_INTERVAL) await this.saveSnapshot(gameId, game.lastSeq, state);
    return { summary: toSummary(game), state };
  }

  async undoLast(gameId: GameId, expectedSeq?: number): Promise<LoadedGame | undefined> {
    await this.db.transaction('rw', this.db.games, this.db.events, this.db.snapshots, async () => {
      const game = await this.db.games.get(gameId);
      if (!game) return;
      if (expectedSeq !== undefined && expectedSeq !== game.lastSeq) {
        throw new SeqConflictError(gameId, expectedSeq, game.lastSeq);
      }
      const log = await this.loadEvents(gameId);
      const { kept, removed } = undoLastGroup(log);
      if (removed.length === 0) return;
      await this.db.events.bulkDelete(removed.map((e) => [gameId, e.seq] as unknown as number));
      const lastSeq = kept.at(-1)?.seq ?? 0;
      await this.db.games.update(gameId, { lastSeq, updatedAt: Date.now() });
      const snapshot = await this.db.snapshots.get(gameId);
      if (snapshot && snapshot.seq > lastSeq) await this.db.snapshots.delete(gameId);
    });
    return this.loadGame(gameId);
  }

  async listGames(): Promise<GameSummary[]> {
    const rows = await this.db.games.orderBy('updatedAt').reverse().toArray();
    return rows.map(toSummary);
  }

  async saveSnapshot(gameId: GameId, seq: number, state: GameState): Promise<void> {
    await this.db.snapshots.put({ gameId, seq, stateVersion: STATE_VERSION, state });
  }

  /** Returns the stored events of a game with `seq` greater than `afterSeq` (for export/sync). */
  async loadEvents(gameId: GameId, afterSeq = 0): Promise<StoredEvent[]> {
    return this.db.events
      .where('[gameId+seq]')
      .between([gameId, afterSeq], [gameId, Dexie.maxKey], false, true)
      .toArray();
  }

  /** Replaces the cached cards of one language/pack (output of `pnpm carddata:fetch`). */
  async putCards(lang: string, packCode: string, cards: readonly CardDef[]): Promise<void> {
    await this.db.transaction('rw', this.db.cards, async () => {
      await this.db.cards.where('[lang+packCode]').equals([lang, packCode]).delete();
      await this.db.cards.bulkPut(
        cards.map((card) => ({ key: `${lang}:${card.code}`, lang, packCode, card })),
      );
    });
  }

  /** Cached cards of one language/pack; empty if never stored. */
  async getCards(lang: string, packCode: string): Promise<CardDef[]> {
    const rows = await this.db.cards.where('[lang+packCode]').equals([lang, packCode]).toArray();
    return rows.map((r) => r.card);
  }

  /** Replaces the cached investigator catalog of one language. */
  async putCatalog(lang: string, catalog: CardCatalog): Promise<void> {
    await this.db.catalog.put({ lang, catalog });
  }

  /** Cached investigator catalog of one language; `undefined` if never stored. */
  async getCatalog(lang: string): Promise<CardCatalog | undefined> {
    return (await this.db.catalog.get(lang))?.catalog;
  }

  /** Closes the database connection (used by tests). */
  close(): void {
    this.db.close();
  }
}

function toSummary(row: GameRow): GameSummary {
  return { ...row };
}
