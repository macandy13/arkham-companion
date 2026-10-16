import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { createAppStore } from './appStore';

const neverLoads = () => new Promise<never>(() => {});

describe('appStore', () => {
  it('creates a game that survives a "refresh" (new store, same database)', async () => {
    const db = 'appstore-test';
    const first = createAppStore(new IndexedDbStore(db), neverLoads);
    const id = await first.getState().newGame();
    expect(first.getState().current?.gameId).toBe(id);

    const second = createAppStore(new IndexedDbStore(db), neverLoads);
    await second.getState().refresh();
    expect(second.getState().games.map((g) => g.gameId)).toEqual([id]);
  });
});
