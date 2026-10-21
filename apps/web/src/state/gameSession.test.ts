import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  byName,
  cardDbWith,
  execute,
  emptyState,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  scenario,
  type InvestigatorCard,
  type ScenarioDefinition,
} from '@arkham/engine';
import { GATHERING_CODES, theGathering, theGatheringCards } from '@arkham/scenarios';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { GameSession } from './gameSession';

describe('GameSession on The Gathering', () => {
  const alder: InvestigatorCard = {
    code: investigatorCode('alder'),
    name: 'Alder',
    health: 6,
    sanity: 8,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
  };
  const ctx = {
    cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]),
    scenario: theGathering,
  };
  const setup = scenario.compileSetup(ctx, {
    difficulty: 'easy',
    seed: 3,
    investigators: [{ id: investigatorId('alder'), code: alder.code }],
  });

  /** A stored game of The Gathering, set up and not yet played, in database `name`. */
  async function storedGame(name: string) {
    const store = new IndexedDbStore(name);
    const gameId = await store.createGame({ title: 'The Gathering' });
    await store.appendEvents(gameId, execute(ctx, emptyState(), setup).events);
    return { store, gameId };
  }

  it('stores an action and its skill test as one undo group', async () => {
    const { store, gameId } = await storedGame('session-group-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.nextPhase());
    await session.play((table) => table.startTurn(investigatorId('alder')));
    const beforeInvestigating = session.state;

    await session.play((table) => table.investigate(byName('Alder'), { result: 'fail' }));
    await store.undoLast(gameId);

    expect((await store.loadGame(gameId))?.state).toEqual(beforeInvestigating);
  });

  it('stores nothing of a step whose second verb is refused', async () => {
    const { store, gameId } = await storedGame('session-refused-step-test');
    const session = await GameSession.open(store, gameId, ctx);
    const atSetup = session.state;

    const rejection = await session.play((table) => {
      table.nextPhase();
      table.endTurn(investigatorId('alder'));
    });

    expect(rejection).toEqual({ code: 'turnNotInProgress', investigatorId: 'alder' });
    expect(session.state).toBe(atSetup);
    expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
  });

  it('takes back a step in memory and in storage alike', async () => {
    const { store, gameId } = await storedGame('session-undo-test');
    const session = await GameSession.open(store, gameId, ctx);
    const atSetup = session.state;
    await session.play((table) => table.nextPhase());

    await session.undo();

    expect(session.state).toEqual(atSetup);
    expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
  });

  it('names the effects a step skipped for a missing card, until the next step', async () => {
    // With two Ghoul Priests set aside, The Barrier's reverse side cannot tell which one spawns.
    const twoPriests: ScenarioDefinition = {
      ...theGathering,
      setup: theGathering.setup.map((step) =>
        step.kind === 'setAside'
          ? { ...step, codes: [...step.codes, GATHERING_CODES.ghoulPriest] }
          : step,
      ),
    };
    const twoPriestsCtx = { ...ctx, scenario: twoPriests };
    const store = new IndexedDbStore('session-skipped-effect-test');
    const gameId = await store.createGame({ title: 'The Gathering' });
    const twoPriestsSetup = scenario.compileSetup(twoPriestsCtx, {
      difficulty: 'easy',
      seed: 3,
      investigators: [{ id: investigatorId('alder'), code: alder.code }],
    });
    await store.appendEvents(gameId, execute(twoPriestsCtx, emptyState(), twoPriestsSetup).events);
    const session = await GameSession.open(store, gameId, twoPriestsCtx);
    // Act 1 (Trapped) advances first, without its clues, so that The Barrier is current.
    await session.play((table) => table.play({ type: 'AdvanceAct' }));

    await session.play((table) => table.play({ type: 'AdvanceAct' }));
    const afterTheBarrier = session.skippedEffects;
    await session.play((table) => table.nextPhase());

    expect(afterTheBarrier).toEqual([
      { card: 'The Barrier', effect: 'SpawnEnemy', missing: ['Ghoul Priest'] },
    ]);
    expect(session.skippedEffects).toEqual([]);
  });

  it('reloads what another tab stored when its own write is refused', async () => {
    const { store, gameId } = await storedGame('session-two-tabs-test');
    const firstTab = await GameSession.open(store, gameId, ctx);
    const secondTab = await GameSession.open(store, gameId, ctx);
    await firstTab.play((table) => table.nextPhase());

    await expect(secondTab.play((table) => table.nextPhase())).rejects.toThrow();

    expect(secondTab.state).toEqual(firstTab.state);
  });
});
