import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  cardCode,
  scenarioId,
  cardDbWith,
  instanceId,
  investigatorCode,
  investigatorCardStats,
  investigatorId,
  replay,
  type Event,
  type InvestigatorCard,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { GameImportError } from '../storage/gameExport';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { createAppStore } from './appStore';

const started: Event = {
  type: 'ScenarioStarted',
  scenarioId: scenarioId('test'),
  difficulty: 'standard',
  seed: 7,
  investigators: [],
  maps: {},
  cards: [
    {
      id: instanceId('c1'),
      code: cardCode('0001'),
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

    expect(reopened.getState().current).toMatchObject({
      gameId: id,
      state: replay([started, doom]),
      lastSeq: 2,
    });
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

  describe('with The Gathering', () => {
    const alder: InvestigatorCard = {
      code: investigatorCode('alder'),
      name: 'Alder',
      health: 6,
      sanity: 8,
      skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    };
    const start = {
      title: 'The Gathering',
      ctx: {
        cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]),
        scenario: theGathering,
      },
      difficulty: 'easy' as const,
      seed: 3,
      investigators: [{ id: investigatorId('alder'), code: alder.code }],
    };

    describe('startScenario', () => {
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
        const broken = {
          ...start,
          ctx: { ...start.ctx, scenario: { ...theGathering, actDeck: [cardCode('missing')] } },
        };

        await expect(store.getState().startScenario(broken)).rejects.toThrow();
        expect(store.getState().games).toEqual([]);
      });
    });

    describe('dispatch and undo', () => {
      it('stores a command\'s events, so reopening the game shows the same state', async () => {
        const db = 'appstore-dispatch-test';
        const store = createAppStore(new IndexedDbStore(db));
        const id = await store.getState().startScenario(start);

        await store.getState().dispatch({ type: 'NextPhase' });

        expect(store.getState().current?.state.meta.phase).toBe('investigation');
        const reopened = createAppStore(new IndexedDbStore(db));
        await reopened.getState().openGame(id);
        expect(reopened.getState().current?.state).toEqual(store.getState().current?.state);
      });

      it('rebuilds the scenario rules when a saved game is opened, so it can be played on', async () => {
        const db = 'appstore-reopen-play-test';
        const id = await createAppStore(new IndexedDbStore(db)).getState().startScenario(start);
        const reopened = createAppStore(new IndexedDbStore(db));
        await reopened.getState().openGame(id);

        await reopened.getState().dispatch({ type: 'NextPhase' });

        expect(reopened.getState().current?.ctx?.scenario).toBe(theGathering);
        expect(reopened.getState().current?.state.meta.phase).toBe('investigation');
      });

      it("keeps a refused command's reason and stores nothing", async () => {
        const store = createAppStore(new IndexedDbStore('appstore-refused-test'));
        await store.getState().startScenario(start);
        const before = store.getState().current;

        await store
          .getState()
          .dispatch({ type: 'EndTurn', investigatorId: investigatorId('alder') });

        expect(store.getState().current?.rejection).toMatchObject({
          code: 'wrongPhase',
          actual: 'setup',
        });
        expect(store.getState().current?.state).toBe(before?.state);
        expect(store.getState().current?.lastSeq).toBe(before?.lastSeq);
      });

      it('clears the refusal once the next command succeeds', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-refused-clear-test'));
        await store.getState().startScenario(start);
        await store
          .getState()
          .dispatch({ type: 'EndTurn', investigatorId: investigatorId('alder') });

        await store.getState().dispatch({ type: 'NextPhase' });

        expect(store.getState().current?.rejection).toBeUndefined();
      });

      it('runs commands sent without waiting in the order they were sent', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-order-test'));
        await store.getState().startScenario(start);

        await Promise.all([
          store.getState().dispatch({ type: 'NextPhase' }),
          store.getState().dispatch({ type: 'StartTurn', investigatorId: investigatorId('alder') }),
        ]);

        expect(store.getState().current?.state.meta).toMatchObject({
          phase: 'investigation',
          turn: { investigatorId: 'alder' },
        });
      });

      it('undoes the last command in memory and in storage', async () => {
        const db = new IndexedDbStore('appstore-undo-test');
        const store = createAppStore(db);
        const id = await store.getState().startScenario(start);
        const atSetup = store.getState().current?.state;
        await store.getState().dispatch({ type: 'NextPhase' });

        await store.getState().undo();

        expect(store.getState().current?.state).toEqual(atSetup);
        expect((await db.loadGame(id))?.state).toEqual(atSetup);
      });

      it('never undoes the scenario start', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-undo-start-test'));
        await store.getState().startScenario(start);
        const atSetup = store.getState().current?.state;

        await store.getState().undo();

        expect(store.getState().current?.state).toBe(atSetup);
      });

      it('refuses to play a game whose scenario is not in the catalog', async () => {
        const store = createAppStore(
          new IndexedDbStore('appstore-unknown-scenario-test'),
          () => undefined,
        );
        await store.getState().startScenario(start);

        await expect(store.getState().dispatch({ type: 'NextPhase' })).rejects.toThrow(
          'No playable game is open',
        );
        expect(store.getState().current?.ctx).toBeUndefined();
      });
    });
  });
});
