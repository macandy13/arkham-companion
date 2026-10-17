import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STATE_VERSION,
  emptyState,
  instanceId,
  investigatorCode,
  investigatorId,
  mapId,
  replay,
  type CardInstance,
  type Event,
  type ScenarioStarted,
} from '@arkham/engine';
import type { CardDef } from '@arkham/carddata';
import { IndexedDbStore, SeqConflictError } from './IndexedDbStore';

const card = (id: string): CardInstance => ({
  id: instanceId(id),
  code: '0001',
  zone: { kind: 'encounterDeck' },
  faceUp: false,
  exhausted: false,
  tokens: {},
  flags: {},
});

const started: ScenarioStarted = {
  type: 'ScenarioStarted',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 7,
  investigators: [
    {
      id: investigatorId('i1'),
      code: investigatorCode('inv'),
      name: 'Tester',
      seat: 0,
      health: { max: 8, damage: 0 },
      sanity: { max: 6, horror: 0 },
      clues: 0,
      resources: 5,
      doomOnPlayerCards: 0,
      actionsRemaining: 3,
      skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
      status: 'active',
    },
  ],
  maps: { [mapId('m')]: { name: 'Map', visible: true, connections: [] } },
  cards: [card('c1'), card('c2')],
  chaosBag: ['0', 'skull'],
};

const tokens = (delta: number): Event => ({
  type: 'TokensChanged',
  cardId: instanceId('c1'),
  token: 'doom',
  delta,
});

let n = 0;
let store: IndexedDbStore;
beforeEach(() => {
  store = new IndexedDbStore(`test-${n++}`);
});

describe('IndexedDbStore', () => {
  it('creates games with UUIDs and lists them, newest update first', async () => {
    const a = await store.createGame({ title: 'A' });
    const b = await store.createGame({ title: 'B' });
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    await store.appendEvents(a, [started]);
    const list = await store.listGames();
    expect(list.map((g) => g.gameId)).toEqual([a, b]);
    expect(list[0]).toMatchObject({ title: 'A', lastSeq: 1 });
  });

  it('assigns gapless sequence numbers and timestamps', async () => {
    const id = await store.createGame();
    const first = await store.appendEvents(id, [started, tokens(1)]);
    const second = await store.appendEvents(id, [tokens(1)]);
    expect([...first, ...second].map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(first[0]?.timestamp).toBeGreaterThan(0);
    expect((await store.loadEvents(id, 1)).map((e) => e.seq)).toEqual([2, 3]);
  });

  it('loads by replaying the log', async () => {
    const id = await store.createGame();
    const events = [started, tokens(2), tokens(1)];
    await store.appendEvents(id, events);
    const loaded = await store.loadGame(id);
    expect(loaded?.state).toEqual(replay(events));
    expect(loaded?.summary.lastSeq).toBe(3);
  });

  it('loads from snapshot plus the events after it', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started, tokens(1)]);
    const atTwo = replay([started, tokens(1)]);
    await store.saveSnapshot(id, 2, atTwo);
    await store.appendEvents(id, [tokens(3)]);
    const loaded = await store.loadGame(id);
    expect(loaded?.state).toEqual(replay([started, tokens(1), tokens(3)]));
  });

  it('ignores snapshots with another state version', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started, tokens(1)]);
    // A bogus snapshot that would produce a wrong state if used.
    await store.saveSnapshot(id, 2, emptyState());
    const db = (
      store as unknown as { db: { snapshots: { update(k: string, c: object): Promise<number> } } }
    ).db;
    await db.snapshots.update(id, { stateVersion: STATE_VERSION + 1 });
    expect((await store.loadGame(id))?.state).toEqual(replay([started, tokens(1)]));
  });

  it('rejects appends with a stale expectedSeq and writes nothing', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started], 0);
    await expect(store.appendEvents(id, [tokens(1)], 0)).rejects.toBeInstanceOf(SeqConflictError);
    expect((await store.loadEvents(id)).length).toBe(1);
  });

  it('returns undefined for unknown games and rejects appends to them', async () => {
    expect(await store.loadGame('nope')).toBeUndefined();
    await expect(store.appendEvents('nope', [started])).rejects.toThrow(/Unknown game/);
  });

  it('keeps games isolated from each other', async () => {
    const a = await store.createGame();
    const b = await store.createGame();
    await store.appendEvents(a, [started, tokens(1)]);
    await store.appendEvents(b, [started]);
    expect((await store.loadEvents(a)).length).toBe(2);
    expect((await store.loadEvents(b)).length).toBe(1);
  });

  it('summarises scenario, round, phase and investigators from the replayed state', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started]);
    const [summary] = await store.listGames();
    expect(summary).toMatchObject({
      scenarioId: 'test',
      round: 0,
      phase: 'setup',
      investigators: [{ code: 'inv', name: 'Tester' }],
    });
  });

  it('renames a game without counting it as play', async () => {
    const id = await store.createGame({ title: 'Old' });
    const before = (await store.listGames())[0]!.updatedAt;
    await store.renameGame(id, 'New');
    expect((await store.listGames())[0]).toMatchObject({ title: 'New', updatedAt: before });
    await expect(store.renameGame('nope', 'x')).rejects.toThrow(/Unknown game/);
  });

  it('duplicates a game with its log, independent of the original', async () => {
    const id = await store.createGame({ title: 'Orig' });
    await store.appendEvents(id, [started, tokens(1)]);
    await store.saveSnapshot(id, 2, replay([started, tokens(1)]));
    const copy = await store.duplicateGame(id, 'Copy');
    await store.appendEvents(copy, [tokens(5)]);
    expect((await store.loadGame(copy))?.state).toEqual(replay([started, tokens(1), tokens(5)]));
    expect((await store.loadGame(id))?.state).toEqual(replay([started, tokens(1)]));
    expect((await store.loadGame(copy))?.summary).toMatchObject({ title: 'Copy', lastSeq: 3 });
    await expect(store.duplicateGame('nope')).rejects.toThrow(/Unknown game/);
  });

  it('deletes a game with its events and snapshot, leaving others alone', async () => {
    const a = await store.createGame();
    const b = await store.createGame();
    await store.appendEvents(a, [started]);
    await store.appendEvents(b, [started]);
    await store.saveSnapshot(a, 1, replay([started]));
    await store.deleteGame(a);
    expect(await store.loadGame(a)).toBeUndefined();
    expect(await store.loadEvents(a)).toEqual([]);
    expect((await store.listGames()).map((g) => g.gameId)).toEqual([b]);
    expect((await store.loadEvents(b)).length).toBe(1);
  });

  it('groups the events of one append under one commandId', async () => {
    const id = await store.createGame();
    const first = await store.appendEvents(id, [started, tokens(1)]);
    const second = await store.appendEvents(id, [tokens(1)], undefined, 'given');
    expect(first[0]?.commandId).toBe(first[1]?.commandId);
    expect(second[0]?.commandId).toBe('given');
    expect(first[0]?.commandId).not.toBe('given');
  });

  it('undoes the last command group and replays the rest', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started]);
    await store.appendEvents(id, [tokens(1), tokens(2)]);

    const undone = await store.undoLast(id);

    expect(undone?.state).toEqual(replay([started]));
    expect(undone?.summary.lastSeq).toBe(1);
    expect((await store.loadEvents(id)).map((e) => e.seq)).toEqual([1]);
    const next = await store.appendEvents(id, [tokens(3)]);
    expect(next[0]?.seq).toBe(2);
  });

  it('undoes everything down to an empty log and then does nothing', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started]);

    expect((await store.undoLast(id))?.state).toEqual(emptyState());
    expect((await store.undoLast(id))?.summary.lastSeq).toBe(0);
  });

  it('drops a snapshot beyond the new end but keeps one before it', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started]);
    await store.appendEvents(id, [tokens(1)]);
    await store.saveSnapshot(id, 2, replay([started, tokens(1)]));
    await store.appendEvents(id, [tokens(5)]);

    await store.undoLast(id);
    expect((await store.loadGame(id))?.state).toEqual(replay([started, tokens(1)]));

    await store.undoLast(id);
    // A leftover snapshot at seq 2 would make this state wrong.
    expect((await store.loadGame(id))?.state).toEqual(replay([started]));
  });

  it('rejects undo with a stale expectedSeq and removes nothing', async () => {
    const id = await store.createGame();
    await store.appendEvents(id, [started]);
    await expect(store.undoLast(id, 0)).rejects.toBeInstanceOf(SeqConflictError);
    expect((await store.loadEvents(id)).length).toBe(1);
  });

  it('returns undefined when undoing an unknown game', async () => {
    expect(await store.undoLast('nope')).toBeUndefined();
  });

  it('caches cards per language and pack', async () => {
    const def = { code: '1', name: 'Fake' } as CardDef; // partial fixture is enough for storage
    await store.putCards('en', 'core_2026', [def]);
    await store.putCards('de', 'core_2026', [{ ...def, name: 'Falsch' }]);
    expect((await store.getCards('en', 'core_2026'))[0]?.name).toBe('Fake');
    await store.putCards('en', 'core_2026', []);
    expect(await store.getCards('en', 'core_2026')).toEqual([]);
    expect(await store.getCards('de', 'core_2026')).toHaveLength(1);
  });
});

describe('IndexedDbStore.importGame', () => {
  it('creates a new game from exported events, keeping their timestamps and command ids', async () => {
    const source = await store.createGame({ title: 'Night' });
    const id = await store.importGame({
      title: 'Imported',
      events: [
        { timestamp: 1000, commandId: 'start', event: started },
        { timestamp: 2000, commandId: 'add_doom', event: tokens(1) },
      ],
    });

    expect(id).not.toBe(source);
    expect((await store.loadEvents(id)).map((e) => [e.seq, e.timestamp, e.commandId])).toEqual([
      [1, 1000, 'start'],
      [2, 2000, 'add_doom'],
    ]);
    const loaded = await store.loadGame(id);
    expect(loaded?.state).toEqual(replay([started, tokens(1)]));
    expect(loaded?.summary).toMatchObject({ title: 'Imported', lastSeq: 2, updatedAt: 2000 });
    expect((await store.appendEvents(id, [tokens(1)]))[0]?.seq).toBe(3);
  });
});
