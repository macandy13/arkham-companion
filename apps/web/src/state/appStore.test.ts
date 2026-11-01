import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  CampaignCommandRejected,
  campaignId,
  cardCode,
  cardStats,
  scenarioId,
  cardDbWith,
  instanceId,
  investigatorCode,
  investigatorCardStats,
  investigatorId,
  onlyCopy,
  replay,
  revealLocation,
  whenAdvanced,
  type Event,
  type InvestigatorCard,
} from '@arkham/engine';
import {
  GATHERING_CODES,
  nightOfTheZealot,
  theGathering,
  theGatheringCards,
} from '@arkham/scenarios';
import { GameImportError } from '../storage/gameExport';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { createAppStore } from './appStore';
import type { GameActions } from './gameActions';

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
    const campaignStart = {
      ...start,
      definition: nightOfTheZealot,
      campaignTitle: 'Night of the Zealot',
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

    describe('startCampaign', () => {
      it("stores the campaign log and its first scenario as the campaign's game", async () => {
        const db = new IndexedDbStore('appstore-campaign-test');
        const store = createAppStore(db);

        const gameId = await store.getState().startCampaign(campaignStart);

        const [stored] = store.getState().campaigns;
        expect(stored).toMatchObject({ title: 'Night of the Zealot', difficulty: 'easy' });
        expect(store.getState().games).toMatchObject([
          { gameId, title: 'The Gathering', campaignId: stored?.campaignId },
        ]);
        expect(store.getState().current?.state.campaign?.campaignId).toBe(stored?.campaignId);
      });

      it.each([
        [
          'a team with Alder twice',
          { ...campaignStart, investigators: [...start.investigators, ...start.investigators] },
        ],
        [
          'a scenario with a missing act card',
          {
            ...campaignStart,
            ctx: { ...start.ctx, scenario: { ...theGathering, actDeck: [cardCode('missing')] } },
          },
        ],
      ])('stores no campaign and no game for %s', async (_, invalid) => {
        const db = new IndexedDbStore(`appstore-campaign-invalid-${invalid.investigators.length}`);
        const store = createAppStore(db);

        await expect(store.getState().startCampaign(invalid)).rejects.toThrow();
        expect(await db.listCampaigns()).toEqual([]);
        expect(await db.listGames()).toEqual([]);
      });
    });

    describe('openCampaign', () => {
      it('loads the campaign log with the games of that campaign only', async () => {
        const db = new IndexedDbStore('appstore-open-campaign-test');
        const store = createAppStore(db);
        await store.getState().startScenario({ ...start, title: 'A quick game' });
        const gameId = await store.getState().startCampaign(campaignStart);
        const campaignId = store.getState().campaigns[0]!.campaignId;

        await store.getState().openCampaign(campaignId);

        expect(store.getState().campaign).toMatchObject({
          campaignId,
          title: 'Night of the Zealot',
          log: { difficulty: 'easy', investigators: [{ code: 'alder', name: 'Alder' }] },
          games: [{ gameId, title: 'The Gathering' }],
        });
      });

      it('marks a campaign that is not stored as missing', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-open-missing-campaign-test'));

        await store.getState().openCampaign(campaignId('gone'));

        expect(store.getState().campaign).toBeNull();
      });
    });

    describe('resolution', () => {
      const alderId = investigatorId('alder');
      const houseStillStanding = { kind: 'flag', value: true } as const;

      it('proposes nothing while the game goes on', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-resolution-running-test'));

        await store.getState().startCampaign(campaignStart);

        expect(store.getState().current?.resolution).toBeUndefined();
      });

      it("proposes the campaign's no-resolution changes once Alder is defeated by horror", async () => {
        const store = createAppStore(new IndexedDbStore('appstore-resolution-proposed-test'));
        await store.getState().startCampaign(campaignStart);
        const campaignId = store.getState().campaigns[0]!.campaignId;

        await store.getState().actions.adjust(alderId, 'horror', alder.sanity);

        const resolution = store.getState().current?.resolution;
        expect(resolution?.campaignId).toBe(campaignId);
        expect(resolution?.changes).toContainEqual({
          kind: 'command',
          command: { type: 'RecordStory', key: 'houseStillStanding', value: houseStillStanding },
        });
        expect(resolution?.changes.at(-1)).toEqual({
          kind: 'command',
          command: { type: 'AddTrauma', code: alder.code, kind: 'mental', amount: 1 },
        });
      });

      it('writes the confirmed changes into the campaign log and proposes nothing more', async () => {
        const db = new IndexedDbStore('appstore-resolution-write-test');
        const store = createAppStore(db);
        const gameId = await store.getState().startCampaign(campaignStart);
        const campaignId = store.getState().campaigns[0]!.campaignId;
        await store.getState().actions.adjust(alderId, 'horror', alder.sanity);
        const trauma = { type: 'AddTrauma', code: alder.code, kind: 'mental', amount: 1 } as const;

        await store.getState().writeResolution([trauma]);

        expect(store.getState().current?.resolution).toBeUndefined();
        const { log } = (await db.loadCampaign(campaignId))!;
        expect(log.playedScenarios).toEqual([
          { scenarioId: 'the-gathering', outcome: { kind: 'noResolution' } },
        ]);
        expect(log.investigators).toMatchObject([{ code: alder.code, mentalTrauma: 1 }]);
        await store.getState().openGame(gameId);
        expect(store.getState().current?.resolution).toBeUndefined();
      });

      it('proposes the resolution again when the ended game is reopened before it is written', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-resolution-reopen-test'));
        const gameId = await store.getState().startCampaign(campaignStart);
        await store.getState().actions.adjust(alderId, 'horror', alder.sanity);
        const proposed = store.getState().current?.resolution;

        await store.getState().openGame(gameId);

        expect(store.getState().current?.resolution).toEqual(proposed);
      });

      it('writes nothing and keeps the proposal when the log refuses a change', async () => {
        const db = new IndexedDbStore('appstore-resolution-refused-test');
        const store = createAppStore(db);
        await store.getState().startCampaign(campaignStart);
        const campaignId = store.getState().campaigns[0]!.campaignId;
        await store.getState().actions.adjust(alderId, 'horror', alder.sanity);
        const stranger = investigatorCode('stranger');

        await expect(
          store.getState().writeResolution([{ type: 'AwardXp', code: stranger, amount: 2 }]),
        ).rejects.toBeInstanceOf(CampaignCommandRejected);

        expect((await db.loadCampaign(campaignId))?.log.playedScenarios).toEqual([]);
        expect(store.getState().current?.resolution).toBeDefined();
      });

      it('proposes the resolution of a standalone game without a campaign to write', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-resolution-standalone-test'));
        await store.getState().startScenario(start);

        await store.getState().actions.adjust(alderId, 'horror', alder.sanity);

        const resolution = store.getState().current?.resolution;
        expect(resolution?.campaignId).toBeUndefined();
        expect(resolution?.changes.length).toBeGreaterThan(0);
        await expect(store.getState().writeResolution([])).rejects.toThrow(
          'No resolution to write',
        );
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

        await store.getState().actions.startTurn(investigatorId('alder'));

        expect(store.getState().current?.rejection).toMatchObject({
          code: 'wrongPhase',
          actual: 'setup',
        });
        expect(store.getState().current?.state).toBe(before);
      });

      it('clears the refusal once the next action succeeds', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-refused-clear-test'));
        await store.getState().startScenario(start);
        await store.getState().actions.startTurn(investigatorId('alder'));

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

      it('is busy from the moment an action is sent until it is stored', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-busy-test'));
        await store.getState().startScenario(start);

        const sent = store.getState().actions.nextPhase();
        const busyWhileSent = store.getState().current?.busy;
        await sent;

        expect(busyWhileSent).toBe(true);
        expect(store.getState().current?.busy).toBe(false);
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

      it('can undo once a step was played, never the scenario start', async () => {
        const store = createAppStore(new IndexedDbStore('appstore-can-undo-test'));
        await store.getState().startScenario(start);
        const atStart = store.getState().current?.canUndo;

        await store.getState().actions.nextPhase();

        expect(atStart).toBe(false);
        expect(store.getState().current?.canUndo).toBe(true);
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
        expect(store.getState().current).toMatchObject({ playable: false, board: undefined });
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
          store.getState().current?.board?.investigator(investigatorId('alder'));

        it("leaves an investigation's skill test open for the players to answer", async () => {
          const store = await aldersTurn('actions-investigate-test');

          await store.getState().actions.investigate();

          expect(store.getState().current?.state.pending).toMatchObject([
            { kind: 'skillTestResult', decider: { investigatorId: 'alder' } },
          ]);
        });

        it.each([
          [1, 'pass'],
          [0, 'fail'],
        ])(
          'finds %i clues once the players answer the investigation with %s',
          async (clues, option) => {
            const store = await aldersTurn(`actions-answer-${option}-test`);
            await store.getState().actions.investigate();

            await store.getState().actions.answer(option);

            expect(store.getState().current?.state.pending).toEqual([]);
            expect(alderIn(store)).toMatchObject({ clues });
          },
        );

        it('refuses an answer while no decision is open', async () => {
          const store = await aldersTurn('actions-answer-none-test');

          await store.getState().actions.answer('pass');

          expect(store.getState().current?.rejection).toEqual({ code: 'noPendingDecision' });
        });

        it('counts off one action for the investigation', async () => {
          const store = await aldersTurn('actions-investigate-spends-test');

          await store.getState().actions.investigate();

          expect(alderIn(store)).toMatchObject({ actions: 2 });
        });

        it('refuses an investigation with no action left and changes nothing', async () => {
          const store = await aldersTurn('actions-investigate-none-left-test');
          await store.getState().actions.adjustActions(-3);

          await store.getState().actions.investigate();

          expect(store.getState().current?.rejection).toMatchObject({
            code: 'invalidActionAdjustment',
          });
          expect(store.getState().current?.state.pending).toEqual([]);
          expect(alderIn(store)).toMatchObject({ actions: 0 });
        });

        it('changes the actions left of the investigator whose turn it is', async () => {
          const store = await aldersTurn('actions-adjust-actions-test');

          await store.getState().actions.adjustActions(-1);

          expect(alderIn(store)).toMatchObject({ actions: 2 });
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

        it('shows the board as adjusting from "Adjust board" until "Done"', async () => {
          const store = await aldersTurn('actions-adjusting-test');

          await store.getState().actions.startAdjusting();
          await store.getState().actions.adjust(investigatorId('alder'), 'damage', 1);
          const whileAdjusting = store.getState().current;
          await store.getState().actions.finishAdjusting();

          expect(whileAdjusting).toMatchObject({ adjusting: true, canUndo: true });
          expect(store.getState().current?.adjusting).toBe(false);
          expect(alderIn(store)).toMatchObject({ damage: 1 });
        });

        it('shows the board as it was once an adjustment is cancelled', async () => {
          const store = await aldersTurn('actions-adjust-cancel-test');
          await store.getState().actions.startAdjusting();
          await store.getState().actions.adjust(investigatorId('alder'), 'damage', 1);

          await store.getState().actions.cancelAdjusting();

          expect(store.getState().current?.adjusting).toBe(false);
          expect(alderIn(store)).toMatchObject({ damage: 0 });
        });

        it('places doom on the current agenda', async () => {
          const store = await aldersTurn('actions-doom-test');

          await store.getState().actions.placeDoom(1);

          expect(store.getState().current?.board).toMatchObject({
            agenda: { name: "What's Going On?!", doom: 1, threshold: 3 },
            doomInPlay: 1,
          });
        });

        // Seed 3 puts Dissonant Voices on top of the encounter deck.
        it('shows the encounter card a draw put in a threat area until the players dismiss it', async () => {
          const store = await aldersTurn('actions-drawn-cards-test');
          await store.getState().actions.drawEncounter(investigatorId('alder'));
          const shown = store.getState().current?.drawnCards;

          store.getState().dismissNotice('drawnCards');

          expect(shown?.map(({ card, place }) => [card.name, place.kind])).toEqual([
            ['Dissonant Voices', 'threatArea'],
          ]);
          expect(store.getState().current?.drawnCards).toBeUndefined();
        });

        it('remembers the enemy whose spawn location the players choose until they cancel', async () => {
          const store = await aldersTurn('actions-spawning-test');
          const ghoulPriest = store
            .getState()
            .current?.board?.encounter.setAside.find(({ name }) => name === 'Ghoul Priest');
          if (!ghoulPriest) throw new Error('the Ghoul Priest is set aside at setup');

          store.getState().startSpawn(ghoulPriest);
          const chosen = store.getState().current?.spawning?.name;
          store.getState().cancelSpawn();

          expect(chosen).toBe('Ghoul Priest');
          expect(store.getState().current?.spawning).toBeUndefined();
        });

        it('takes doom off the current agenda', async () => {
          const store = await aldersTurn('actions-remove-doom-test');
          await store.getState().actions.placeDoom(2);

          await store.getState().actions.removeDoom(1);

          expect(store.getState().current?.board?.agenda).toMatchObject({ doom: 1 });
        });
      });

      describe('with an act whose reverse side names a card the game lacks', () => {
        // Trapped's reverse side also reveals a Secret Room, which The Gathering has no copy of.
        const trappedWithSecretRoom = {
          ...cardStats(theGatheringCards, GATHERING_CODES.trapped),
          abilities: [whenAdvanced(revealLocation(onlyCopy(cardCode('secret_room'))))],
        };
        const cards = cardDbWith(start.ctx.cards, [trappedWithSecretRoom]);
        const secretRoomGathering = { ...start, ctx: { ...start.ctx, cards } };

        /** Alder finds Trapped's 2 clues in the Study and spends them, which skips the reveal. */
        async function advancedTrapped(db: string) {
          const store = createAppStore(new IndexedDbStore(db), () => ({
            id: 'secret-room',
            nameKey: 'scenario.theGathering.name',
            definition: theGathering,
            cards,
          }));
          await store.getState().startScenario(secretRoomGathering);
          await store.getState().actions.nextPhase();
          await store.getState().actions.startTurn(investigatorId('alder'));
          await store.getState().actions.investigate();
          await store.getState().actions.answer('pass');
          await store.getState().actions.investigate();
          await store.getState().actions.answer('pass');
          await store
            .getState()
            .actions.advanceAct([{ investigator: investigatorId('alder'), clues: 2 }]);
          return store;
        }

        it('shows the skipped effect until the players dismiss it', async () => {
          const store = await advancedTrapped('actions-skipped-dismiss-test');
          const shown = store.getState().current?.skippedEffects;

          store.getState().dismissNotice('skippedEffects');

          expect(shown).toEqual([
            {
              kind: 'missingCard',
              card: 'Trapped',
              effect: 'RevealLocation',
              missing: ['secret_room'],
            },
          ]);
          expect(store.getState().current?.skippedEffects).toBeUndefined();
        });

        it('keeps the skipped effect through a refused tap, and the next step clears it', async () => {
          const store = await advancedTrapped('actions-skipped-next-step-test');

          await store.getState().actions.answer('pass');
          const afterRefusal = store.getState().current?.skippedEffects;
          await store.getState().actions.adjustActions(-1);

          expect(afterRefusal).toHaveLength(1);
          expect(store.getState().current?.skippedEffects).toBeUndefined();
        });
      });

      it.each([
        ['investigate', (actions: GameActions) => actions.investigate()],
        ['endTurn', (actions: GameActions) => actions.endTurn()],
        ['adjustActions', (actions: GameActions) => actions.adjustActions(-1)],
      ])('refuses %s while no one is taking their turn', async (name, action) => {
        const store = createAppStore(new IndexedDbStore(`appstore-no-turn-${name}-test`));
        await store.getState().startScenario(start);
        await store.getState().actions.nextPhase();
        expect(store.getState().current?.state.meta).toMatchObject({ phase: 'investigation' });
        expect(store.getState().current?.state.meta.turn).toBeUndefined();

        await action(store.getState().actions);

        expect(store.getState().current?.rejection).toEqual({ code: 'noTurnInProgress' });
      });
    });
  });
});
