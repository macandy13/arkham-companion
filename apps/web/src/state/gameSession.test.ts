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
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
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

  it('takes back a step in memory and in storage alike', async () => {
    const { store, gameId } = await storedGame('session-undo-test');
    const session = await GameSession.open(store, gameId, ctx);
    const atSetup = session.state;
    await session.play((table) => table.nextPhase());

    await session.undo();

    expect(session.state).toEqual(atSetup);
    expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
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
