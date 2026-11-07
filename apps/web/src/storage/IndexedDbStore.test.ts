import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STATE_VERSION,
  campaign,
  campaignDefinitionId,
  campaignId,
  cardCode,
  gameId,
  scenarioId,
  emptyState,
  instanceId,
  investigatorCode,
  investigatorId,
  mapId,
  replay,
  type CampaignEvent,
  type CampaignStarted,
  type CardInstance,
  type Event,
  type ScenarioStarted,
} from '@arkham/engine';
import type { CardDef } from '@arkham/carddata';
import { IndexedDbStore, SeqConflictError } from './IndexedDbStore';

const card = (id: string): CardInstance => ({
  id: instanceId(id),
  code: cardCode('0001'),
  zone: { kind: 'encounterDeck' },
  faceUp: false,
  exhausted: false,
  tokens: {},
  flags: {},
});

const started: ScenarioStarted = {
  type: 'ScenarioStarted',
  scenarioId: scenarioId('test'),
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
  maps: { [mapId('m')]: { name: 'Map', visible: true, connections: [], layout: {} } },
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
    expect(await store.loadGame(gameId('nope'))).toBeUndefined();
    await expect(store.appendEvents(gameId('nope'), [started])).rejects.toThrow(/Unknown game/);
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
    await expect(store.renameGame(gameId('nope'), 'x')).rejects.toThrow(/Unknown game/);
  });

  it.each([
    { chosen: undefined, kept: 'display' },
    { chosen: 'auto', kept: 'auto' },
  ] as const)(
    "keeps a game's reliance on the helpers: $chosen at the start gives $kept",
    async ({ chosen, kept }) => {
      const id = await store.createGame(chosen === undefined ? {} : { reliance: chosen });

      expect((await store.loadGame(id))?.summary.reliance).toBe(kept);
    },
  );

  it("changes a game's reliance on the helpers without counting it as play", async () => {
    const id = await store.createGame({ reliance: 'display' });
    const before = (await store.listGames())[0]!.updatedAt;

    await store.setGameReliance(id, 'assist');

    expect((await store.listGames())[0]).toMatchObject({ reliance: 'assist', updatedAt: before });
    await expect(store.setGameReliance(gameId('nope'), 'auto')).rejects.toThrow(/Unknown game/);
  });

  it('remembers the notices read in a game without counting it as play', async () => {
    const id = await store.createGame({ title: 'Read' });
    const before = (await store.listGames())[0]!.updatedAt;

    await store.markNoticeRead(id, 'drawnCards', 'first_step');
    await store.markNoticeRead(id, 'skippedEffects', 'first_step');
    await store.markNoticeRead(id, 'drawnCards', 'second_step');

    expect(await store.loadReadNotices(id)).toEqual({
      drawnCards: 'second_step',
      skippedEffects: 'first_step',
    });
    expect((await store.listGames())[0]).toMatchObject({ updatedAt: before });
  });

  it('forgets the notices read for the step it undoes, and only those', async () => {
    const id = await store.createGame({ title: 'Undone' });
    await store.appendEvents(id, [started], undefined, 'first_step');
    await store.appendEvents(id, [tokens(1)], undefined, 'second_step');
    await store.markNoticeRead(id, 'skippedEffects', 'first_step');
    await store.markNoticeRead(id, 'drawnCards', 'second_step');

    await store.undoLast(id);

    expect(await store.loadReadNotices(id)).toEqual({ skippedEffects: 'first_step' });
  });

  it('knows no notices read in a new or unknown game, and marks none in an unknown one', async () => {
    const id = await store.createGame({ title: 'New' });

    expect(await store.loadReadNotices(id)).toEqual({});
    expect(await store.loadReadNotices(gameId('nope'))).toEqual({});
    await expect(store.markNoticeRead(gameId('nope'), 'drawnCards', 'a_step')).rejects.toThrow(
      /Unknown game/,
    );
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
    await expect(store.duplicateGame(gameId('nope'))).rejects.toThrow(/Unknown game/);
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

  it("keeps the cause given for an event and none for the players' own", async () => {
    const id = await store.createGame();
    const mythosDoom = { kind: 'rule', step: 'placeDoom' } as const;

    await store.appendEvents(id, [started]);
    await store.appendEvents(id, [tokens(1), tokens(-1)], undefined, 'mythos', [mythosDoom]);

    expect((await store.loadEvents(id)).map((stored) => stored.cause)).toEqual([
      undefined,
      mythosDoom,
      undefined,
    ]);
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
    expect(await store.undoLast(gameId('nope'))).toBeUndefined();
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

describe('IndexedDbStore campaigns', () => {
  const roland = investigatorCode('01001');
  const campaignStarted = (id: string): CampaignStarted => ({
    type: 'CampaignStarted',
    campaignId: campaignId(id),
    definitionId: campaignDefinitionId('night-of-the-zealot'),
    difficulty: 'hard',
    investigators: [
      {
        code: roland,
        name: 'Roland Banks',
        health: 9,
        sanity: 5,
        physicalTrauma: 0,
        mentalTrauma: 0,
        xpEarned: 0,
        xpSpent: 0,
        fate: 'alive',
        earnedCards: [],
      },
    ],
    chaosBag: ['0', 'skull'],
    scenarioIds: [scenarioId('the_gathering'), scenarioId('the_midnight_masks')],
  });
  const xp = (delta: number): CampaignEvent => ({
    type: 'XpChanged',
    code: roland,
    account: 'earned',
    delta,
  });
  const gatheringPlayed: CampaignEvent = {
    type: 'ScenarioPlayed',
    scenarioId: scenarioId('the_gathering'),
    outcome: { kind: 'noResolution' },
  };

  it('creates a campaign with a UUID and loads it by replaying its log', async () => {
    const id = await store.createCampaign({ title: 'Zealot' });
    const events = [campaignStarted(id), xp(3)];
    await store.appendCampaignEvents(id, events);

    const loaded = await store.loadCampaign(id);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(loaded?.log).toEqual(campaign.replayEvents(events));
    expect(loaded?.summary).toMatchObject({
      campaignId: id,
      title: 'Zealot',
      lastSeq: 2,
      definitionId: 'night-of-the-zealot',
      difficulty: 'hard',
      position: 0,
      scenarioCount: 2,
      investigators: [{ code: '01001', name: 'Roland Banks' }],
    });
    expect(loaded?.summary.result).toBeUndefined();
  });

  it("writes the cause given for a campaign event and none for the players' own", async () => {
    const id = await store.createCampaign();
    const gathering = {
      kind: 'resolution',
      scenarioId: scenarioId('the_gathering'),
      outcome: { kind: 'noResolution' },
    } as const;

    const stored = await store.appendCampaignEvents(
      id,
      [campaignStarted(id), { type: 'CampaignEnded', result: 'lost' }],
      undefined,
      undefined,
      [undefined, gathering],
    );

    expect(stored.map((row) => row.cause)).toEqual([undefined, gathering]);
  });

  it("keeps a campaign's reliance on the helpers, and changes it without counting it as play", async () => {
    const id = await store.createCampaign({ reliance: 'assist' });
    await store.appendCampaignEvents(id, [campaignStarted(id)]);
    const before = (await store.loadCampaign(id))?.summary;

    await store.setCampaignReliance(id, 'auto');

    expect(before?.reliance).toBe('assist');
    expect((await store.loadCampaign(id))?.summary).toMatchObject({
      reliance: 'auto',
      updatedAt: before?.updatedAt,
    });
    await expect(store.setCampaignReliance(campaignId('nope'), 'auto')).rejects.toThrow(
      /Unknown campaign/,
    );
  });

  it('summarises a campaign that ended with its result and when it ended', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const id = await store.createCampaign();
    vi.setSystemTime(1000);
    await store.appendCampaignEvents(id, [campaignStarted(id)]);
    vi.setSystemTime(2000);
    await store.appendCampaignEvents(id, [{ type: 'CampaignEnded', result: 'won' }]);

    const summary = (await store.loadCampaign(id))?.summary;
    expect(summary?.result).toBe('won');
    expect(summary?.endedAt).toBe(2000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists campaigns, most recently played first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1000);
    const played = await store.createCampaign({ title: 'Played' });
    vi.setSystemTime(2000);
    await store.createCampaign({ title: 'Untouched' });
    vi.setSystemTime(3000);
    await store.appendCampaignEvents(played, [campaignStarted(played)]);

    const list = await store.listCampaigns();

    expect(list.map((c) => [c.title, c.updatedAt])).toEqual([
      ['Played', 3000],
      ['Untouched', 2000],
    ]);
  });

  it('rejects campaign appends with a stale expectedSeq and writes nothing', async () => {
    const id = await store.createCampaign();
    await store.appendCampaignEvents(id, [campaignStarted(id)], 0);

    await expect(store.appendCampaignEvents(id, [xp(1)], 0)).rejects.toBeInstanceOf(
      SeqConflictError,
    );
    expect((await store.loadCampaign(id))?.summary.lastSeq).toBe(1);
  });

  it('returns undefined for unknown campaigns and rejects appends to them', async () => {
    expect(await store.loadCampaign(campaignId('nope'))).toBeUndefined();
    expect(await store.undoLastCampaign(campaignId('nope'))).toBeUndefined();
    await expect(store.appendCampaignEvents(campaignId('nope'), [xp(1)])).rejects.toThrow(
      /Unknown campaign/,
    );
  });

  it('undoes the last campaign command group, such as a whole resolution', async () => {
    const id = await store.createCampaign();
    await store.appendCampaignEvents(id, [campaignStarted(id)]);
    await store.appendCampaignEvents(id, [xp(2), gatheringPlayed]);

    const undone = await store.undoLastCampaign(id);

    expect(undone?.log).toEqual(campaign.replayEvents([campaignStarted(id)]));
    expect(undone?.summary.lastSeq).toBe(1);
    const next = await store.appendCampaignEvents(id, [xp(1)]);
    expect(next[0]?.seq).toBe(2);
  });

  it('rejects a campaign undo with a stale expectedSeq and removes nothing', async () => {
    const id = await store.createCampaign();
    await store.appendCampaignEvents(id, [campaignStarted(id)]);

    await expect(store.undoLastCampaign(id, 0)).rejects.toBeInstanceOf(SeqConflictError);
    expect((await store.loadCampaign(id))?.summary.lastSeq).toBe(1);
  });

  it('renames a campaign without counting it as play', async () => {
    const id = await store.createCampaign({ title: 'Zealot' });
    await store.appendCampaignEvents(id, [campaignStarted(id)]);
    const before = (await store.listCampaigns())[0]!.updatedAt;

    await store.renameCampaign(id, 'Zealot – Roland');

    expect((await store.listCampaigns())[0]).toMatchObject({
      title: 'Zealot – Roland',
      updatedAt: before,
    });
    await expect(store.renameCampaign(campaignId('nope'), 'x')).rejects.toThrow(/Unknown campaign/);
  });

  it('deletes a campaign with its log and its games, leaving other campaigns and games alone', async () => {
    const zealot = await store.createCampaign();
    const other = await store.createCampaign();
    const zealotGame = await store.createGame({ campaignId: zealot });
    const otherGame = await store.createGame({ campaignId: other });
    const quickGame = await store.createGame();
    await store.appendCampaignEvents(zealot, [campaignStarted(zealot)]);
    await store.appendCampaignEvents(other, [campaignStarted(other)]);
    for (const game of [zealotGame, otherGame, quickGame])
      await store.appendEvents(game, [started]);
    await store.saveSnapshot(zealotGame, 1, replay([started]));

    await store.deleteCampaign(zealot);

    expect(await store.loadCampaign(zealot)).toBeUndefined();
    expect(await store.loadGame(zealotGame)).toBeUndefined();
    expect(await store.loadEvents(zealotGame)).toEqual([]);
    expect((await store.listCampaigns()).map((c) => c.campaignId)).toEqual([other]);
    expect((await store.listGames()).map((g) => g.gameId).sort()).toEqual(
      [otherGame, quickGame].sort(),
    );
  });

  it('imports a campaign under a new id, its log and its game moved to that id', async () => {
    const elsewhere = campaignId('on-the-other-device');
    const gameOfTheCampaign: ScenarioStarted = {
      ...started,
      campaign: campaign.replayEvents([campaignStarted(elsewhere)]),
    };

    const id = await store.importCampaign({
      title: 'Zealot',
      reliance: 'assist',
      events: [{ timestamp: 1000, commandId: 'start', event: campaignStarted(elsewhere) }],
      games: [
        {
          title: 'The Gathering',
          events: [{ timestamp: 2000, commandId: 'start', event: gameOfTheCampaign }],
        },
      ],
    });

    expect(id).not.toBe(elsewhere);
    expect(await store.loadCampaign(id)).toMatchObject({
      summary: { title: 'Zealot', reliance: 'assist', createdAt: 1000 },
      log: { campaignId: id },
    });
    const [game] = await store.listGames();
    expect(game).toMatchObject({ title: 'The Gathering', campaignId: id });
    expect((await store.loadGame(game!.gameId))?.state.campaign?.campaignId).toBe(id);
  });

  it('deleting a game leaves its campaign and other campaigns untouched', async () => {
    const zealot = await store.createCampaign();
    const other = await store.createCampaign();
    const game = await store.createGame({ campaignId: zealot });
    await store.appendCampaignEvents(zealot, [campaignStarted(zealot), xp(1)]);
    await store.appendCampaignEvents(other, [campaignStarted(other)]);
    await store.appendEvents(game, [started]);

    await store.deleteGame(game);

    expect((await store.loadCampaign(zealot))?.summary.lastSeq).toBe(2);
    expect((await store.loadCampaign(other))?.summary.lastSeq).toBe(1);
  });
});
