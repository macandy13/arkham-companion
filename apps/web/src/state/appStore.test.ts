import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  cardCode,
  scenarioId,
  boardView,
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
      playable: false,
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

    describe('actions', () => {
      it("stores an action's events, so reopening the game shows the same state", async () => {
        const db = 'appstore-play-test';
        const store = createAppStore(new IndexedDbStore(db));
        const id = await store.getState().startScenario(start);

        await store.getState().actions.nextPhase();

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

        await reopened.getState().actions.nextPhase();

        expect(reopened.getState().current).toMatchObject({
          playable: true,
          state: { meta: { phase: 'investigation' } },
        });
      });

      it("keeps a refused action's reason and shows the state unchanged", async () => {
        const store = createAppStore(new IndexedDbStore('appstore-refused-test'));
        await store.getState().startScenario(start);
        const before = store.getState().current?.state;

        await store.getState().actions.endTurn(investigatorId('alder'));

        expect(store.getState().current?.rejection).toMatchObject({
          code: 'wrongPhase',
          actual: 'setup',
        });
        expect(store.getState().current?.state).toBe(before);
      });

      it('clears the refusal once the next action succeeds', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-refused-clear-test'));
        await store.getState().startScenario(start);
        await store.getState().actions.endTurn(investigatorId('alder'));

        await store.getState().actions.nextPhase();

        expect(store.getState().current?.rejection).toBeUndefined();
      });

      it('runs actions sent without waiting in the order they were sent', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-order-test'));
        await store.getState().startScenario(start);

        await Promise.all([
          store.getState().actions.nextPhase(),
          store.getState().actions.startTurn(investigatorId('alder')),
        ]);

        expect(store.getState().current?.state.meta).toMatchObject({
          phase: 'investigation',
          turn: { investigatorId: 'alder' },
        });
      });

      it('undoes the last action in memory and in storage', async () => {
        const db = new IndexedDbStore('appstore-undo-test');
        const store = createAppStore(db);
        const id = await store.getState().startScenario(start);
        const atSetup = store.getState().current?.state;
        await store.getState().actions.nextPhase();

        await store.getState().actions.undo();

        expect(store.getState().current?.state).toEqual(atSetup);
        expect((await db.loadGame(id))?.state).toEqual(atSetup);
      });

      it('never undoes the scenario start', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-undo-start-test'));
        await store.getState().startScenario(start);
        const atSetup = store.getState().current?.state;

        await store.getState().actions.undo();

        expect(store.getState().current?.state).toEqual(atSetup);
      });

      it('refuses to play a game whose scenario is not in the catalog', async () => {
        const store = createAppStore(
          new IndexedDbStore('appstore-unknown-scenario-test'),
          () => undefined,
        );
        await store.getState().startScenario(start);

        await expect(store.getState().actions.nextPhase()).rejects.toThrow(
          'No playable game is open',
        );
        expect(store.getState().current?.playable).toBe(false);
      });

      describe("during Alder's turn", () => {
        async function aldersTurn(db: string) {
          const store = createAppStore(new IndexedDbStore(db));
          await store.getState().startScenario(start);
          await store.getState().actions.nextPhase();
          await store.getState().actions.startTurn(investigatorId('alder'));
          return store;
        }
        const alderIn = (store: Awaited<ReturnType<typeof aldersTurn>>) =>
          boardView(start.ctx, store.getState().current!.state).investigator(
            investigatorId('alder'),
          );

        it("leaves an investigation's skill test open for the players to report", async () => {
          const store = await aldersTurn('actions-investigate-test');

          await store.getState().actions.investigate(investigatorId('alder'));

          expect(store.getState().current?.state.pending).toMatchObject([
            { kind: 'skillTestResult' },
          ]);
        });

        it('finds a clue once the players report the investigation passed', async () => {
          const store = await aldersTurn('actions-resolve-test');
          await store.getState().actions.investigate(investigatorId('alder'));

          await store.getState().actions.resolveTest(investigatorId('alder'), 'pass');

          expect(alderIn(store)).toMatchObject({ clues: 1 });
        });

        it('answers an open decision by its id', async () => {
          const store = await aldersTurn('actions-answer-test');
          await store.getState().actions.investigate(investigatorId('alder'));
          const [test] = store.getState().current!.state.pending;

          await store.getState().actions.answer(test!.id, 'fail');

          expect(store.getState().current?.state.pending).toEqual([]);
          expect(alderIn(store)).toMatchObject({ clues: 0 });
        });

        it.each([
          { stat: 'resources', delta: -2, expected: { resources: 3 } },
          { stat: 'damage', delta: 1, expected: { damage: 1 } },
          { stat: 'horror', delta: 2, expected: { horror: 2 } },
        ] as const)(
          'steps $stat by $delta (from 5 resources, no damage, no horror)',
          async ({ stat, delta, expected }) => {
            const store = await aldersTurn(`actions-adjust-${stat}-test`);

            await store.getState().actions.adjust(investigatorId('alder'), stat, delta);

            expect(alderIn(store)).toMatchObject(expected);
          },
        );

        it('places doom on the current agenda', async () => {
          const store = await aldersTurn('actions-doom-test');

          await store.getState().actions.placeDoom(1);

          expect(boardView(start.ctx, store.getState().current!.state).agenda).toMatchObject({
            doom: 1,
          });
        });
      });
    });
  });
});
