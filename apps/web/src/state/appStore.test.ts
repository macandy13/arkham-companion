import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { createAppStore } from './appStore';

describe('appStore', () => {
  it('creates a game that survives a "refresh" (new store, same database)', async () => {
    const db = 'appstore-test';
    const first = createAppStore(new IndexedDbStore(db));
    const id = await first.getState().newGame();
    expect(first.getState().current?.gameId).toBe(id);

    const second = createAppStore(new IndexedDbStore(db));
    await second.getState().refresh();
    expect(second.getState().games.map((g) => g.gameId)).toEqual([id]);
  });

  it('renames, duplicates and deletes games and keeps the list in sync', async () => {
    const store = createAppStore(new IndexedDbStore('appstore-manage-test'));
    const id = await store.getState().newGame();

    await store.getState().renameGame(id, 'Renamed');
    const copyId = await store.getState().duplicateGame(id, 'Renamed copy');
    expect(
      store
        .getState()
        .games.map((g) => g.title)
        .sort(),
    ).toEqual(['Renamed', 'Renamed copy']);

    await store.getState().deleteGame(id);
    expect(store.getState().games.map((g) => g.gameId)).toEqual([copyId]);
    expect(store.getState().current).toBeUndefined();
  });
});
