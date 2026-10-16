import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  instanceId,
  investigatorId,
  replay,
  type Event,
  type StartingInvestigator,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { GameImportError } from '../storage/gameExport';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { createAppStore } from './appStore';

const started: Event = {
  type: 'ScenarioStarted',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 7,
  investigators: [],
  maps: {},
  cards: [
    {
      id: instanceId('c1'),
      code: '0001',
      zone: { kind: 'encounterDeck' },
      faceUp: false,
      exhausted: false,
      tokens: {},
      flags: {},
    },
  ],
  chaosBag: ['0'],
};
const doom: Event = { type: 'TokensChanged', cardId: instanceId('c1'), token: 'doom', delta: 2 };

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

  it('resumes a game by replaying its log after a "refresh"', async () => {
    const db = 'appstore-resume-test';
    const gameStore = new IndexedDbStore(db);
    const id = await gameStore.createGame({ title: 'Night' });
    await gameStore.appendEvents(id, [started, doom]);

    const reopened = createAppStore(new IndexedDbStore(db));
    await reopened.getState().openGame(id);

    expect(reopened.getState().current).toEqual({ gameId: id, state: replay([started, doom]) });
  });

  it('exports a game and imports it as a new game with an identical state', async () => {
    const gameStore = new IndexedDbStore('appstore-roundtrip-test');
    const store = createAppStore(gameStore);
    const id = await gameStore.createGame({ title: 'Night' });
    await gameStore.appendEvents(id, [started, doom]);

    const importedId = await store.getState().importGame(await store.getState().exportGame(id));

    expect(importedId).not.toBe(id);
    await store.getState().openGame(id);
    const original = store.getState().current?.state;
    await store.getState().openGame(importedId);
    expect(store.getState().current?.state).toEqual(original);
    expect(store.getState().games.find((g) => g.gameId === importedId)).toMatchObject({
      title: 'Night',
      lastSeq: 2,
    });
  });

  it('refuses to import text that is not an export', async () => {
    const store = createAppStore(new IndexedDbStore('appstore-badimport-test'));
    await expect(store.getState().importGame('{}')).rejects.toBeInstanceOf(GameImportError);
    expect(store.getState().games).toEqual([]);
  });

  describe('startScenario', () => {
    const investigator: StartingInvestigator = {
      id: investigatorId('inv'),
      code: 'inv',
      name: 'Alder',
      seat: 0,
      health: { max: 6, damage: 0 },
      sanity: { max: 8, horror: 0 },
      clues: 0,
      resources: 5,
      doomOnPlayerCards: 0,
      skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
      status: 'active',
    };
    const start = {
      title: 'The Gathering',
      ctx: { cards: theGatheringCards },
      definition: theGathering,
      difficulty: 'easy' as const,
      seed: 3,
      investigators: [investigator],
    };

    it('stores the setup events as a new game and opens it', async () => {
      const db = new IndexedDbStore('appstore-start-test');
      const store = createAppStore(db);

      const id = await store.getState().startScenario(start);

      expect(store.getState().current?.state.meta).toMatchObject({
        scenarioId: 'the-gathering',
        difficulty: 'easy',
      });
      expect((await db.loadGame(id))?.state).toEqual(store.getState().current?.state);
      expect(store.getState().games.map((g) => g.title)).toEqual(['The Gathering']);
    });

    it('stores nothing when the setup is invalid', async () => {
      const store = createAppStore(new IndexedDbStore('appstore-start-invalid-test'));
      const broken = { ...start, definition: { ...theGathering, actDeck: ['missing'] } };

      await expect(store.getState().startScenario(broken)).rejects.toThrow();
      expect(store.getState().games).toEqual([]);
    });
  });
});
