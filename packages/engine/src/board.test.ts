import { beforeEach, describe, expect, it } from 'vitest';
import {
  CommandRejected,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  neighbours,
  replay,
  shortestPaths,
  type Command,
  type Event,
  type GameState,
  type Rejection,
  type StartScenario,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const main = mapId('main');
const annex = mapId('annex');
const a = instanceId('a');
const b = instanceId('b');
const c = instanceId('c');
const d = instanceId('d');
const ghoul = instanceId('ghoul');

/**
 * Two investigators; locations a (L1, 1 clue each) and b (L2, 2 each) on main,
 * c (L3, 1 fixed clue) on annex, d (L1) set aside; and an enemy.
 */
function startWith(connections: StartScenario['connections'] = []): StartScenario {
  return {
    type: 'StartScenario',
    scenarioId: 'test',
    difficulty: 'standard',
    seed: 1,
    investigators: [1, 2].map((seat) => ({
      id: investigatorId(`inv${seat}`),
      code: '00001',
      name: 'Test Investigator',
      seat,
      health: { max: 8, damage: 0 },
      sanity: { max: 6, horror: 0 },
      clues: 0,
      resources: 5,
      status: 'active' as const,
    })),
    maps: { [main]: { name: 'Main' }, [annex]: { name: 'Annex' } },
    cards: [
      { id: a, code: 'L1', zone: { kind: 'location', mapId: main } },
      { id: b, code: 'L2', zone: { kind: 'location', mapId: main } },
      { id: c, code: 'L3', zone: { kind: 'location', mapId: annex } },
      { id: d, code: 'L1', zone: { kind: 'setAside' } },
      { id: ghoul, code: 'E1', zone: { kind: 'setAside' } },
    ],
    connections,
  };
}

function run(state: GameState, ...commands: Command[]): GameState {
  return commands.reduce((acc, cmd) => execute(sandboxContext, acc, cmd).state, state);
}

function rejectionOf(fn: () => unknown): Rejection {
  try {
    fn();
  } catch (e) {
    if (e instanceof CommandRejected) return e.rejection;
    throw e;
  }
  throw new Error('expected CommandRejected');
}

describe('connections', () => {
  let state: GameState;
  beforeEach(() => {
    state = run(emptyState(), startWith());
  });

  it('adds an undirected edge that works in both directions', () => {
    const next = run(state, { type: 'AddConnection', from: a, to: b });

    expect(neighbours(next, a)).toEqual([b]);
    expect(neighbours(next, b)).toEqual([a]);
  });

  it('adds a one-way edge that only works from its source', () => {
    const next = run(state, { type: 'AddConnection', from: a, to: b, oneWay: true });

    expect(neighbours(next, a)).toEqual([b]);
    expect(neighbours(next, b)).toEqual([]);
  });

  it('removes an undirected edge given in the opposite direction', () => {
    const connected = run(state, { type: 'AddConnection', from: a, to: b });

    const next = run(connected, { type: 'RemoveConnection', from: b, to: a });

    expect(next.board.connections).toEqual([]);
  });

  it('does not remove a one-way edge with an undirected command', () => {
    const connected = run(state, { type: 'AddConnection', from: a, to: b, oneWay: true });

    const rejection = rejectionOf(() =>
      execute(sandboxContext, connected, { type: 'RemoveConnection', from: a, to: b }),
    );

    expect(rejection).toEqual({ code: 'connectionNotFound', from: a, to: b });
  });

  it('rejects an edge that already exists, even reversed', () => {
    const connected = run(state, { type: 'AddConnection', from: a, to: b });

    const rejection = rejectionOf(() =>
      execute(sandboxContext, connected, { type: 'AddConnection', from: b, to: a }),
    );

    expect(rejection).toEqual({ code: 'duplicateConnection', from: b, to: a });
  });

  it('rejects a connection from a location to itself', () => {
    const rejection = rejectionOf(() =>
      execute(sandboxContext, state, { type: 'AddConnection', from: a, to: a }),
    );

    expect(rejection).toEqual({ code: 'selfConnection', cardId: a });
  });

  it('rejects connecting a card that is not a location', () => {
    const rejection = rejectionOf(() =>
      execute(sandboxContext, state, { type: 'AddConnection', from: a, to: ghoul }),
    );

    expect(rejection).toEqual({ code: 'notALocation', cardId: ghoul });
  });

  it('rejects connecting an unknown card', () => {
    const rejection = rejectionOf(() =>
      execute(sandboxContext, state, { type: 'AddConnection', from: a, to: instanceId('nowhere') }),
    );

    expect(rejection).toEqual({ code: 'unknownCard', cardId: 'nowhere' });
  });

  it('rejects starting connections that repeat an edge', () => {
    const start = startWith([
      { from: a, to: b, oneWay: false },
      { from: b, to: a, oneWay: false },
    ]);

    const rejection = rejectionOf(() => execute(sandboxContext, emptyState(), start));

    expect(rejection).toEqual({ code: 'duplicateConnection', from: b, to: a });
  });

  it('keeps an edge to a set-aside location inactive until it enters play', () => {
    const connected = run(state, { type: 'AddConnection', from: a, to: d });

    const inPlay = run(connected, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: d, to: { kind: 'location', mapId: annex } },
    });

    expect(neighbours(connected, a)).toEqual([]);
    expect(neighbours(inPlay, a)).toEqual([d]);
  });

  it('keeps the invariants and replays from events', () => {
    const commands: Command[] = [
      { type: 'AddConnection', from: a, to: b },
      { type: 'RemoveConnection', from: a, to: b },
      { type: 'AddConnection', from: b, to: c, oneWay: true },
    ];
    const events: Event[] = [];
    let after = state;
    for (const command of commands) {
      const result = execute(sandboxContext, after, command);
      after = result.state;
      events.push(...result.events);
    }

    expect(checkInvariants(after)).toEqual([]);
    expect(replay(events, state)).toEqual(after);
  });
});

describe('shortestPaths', () => {
  it('returns the location itself when from equals to', () => {
    const state = run(emptyState(), startWith());

    expect(shortestPaths(state, a, a)).toEqual([[a]]);
  });

  it('returns no path when the target cannot be reached', () => {
    const state = run(emptyState(), startWith([{ from: a, to: b, oneWay: false }]));

    expect(shortestPaths(state, a, c)).toEqual([]);
  });

  it('returns no path to a location that is not in play', () => {
    const state = run(emptyState(), startWith([{ from: a, to: d, oneWay: false }]));

    expect(shortestPaths(state, a, d)).toEqual([]);
  });

  it('returns all equally short paths and ignores longer ones', () => {
    const e = instanceId('e');
    const start = startWith([
      { from: a, to: b, oneWay: false },
      { from: b, to: c, oneWay: false },
      { from: a, to: e, oneWay: false },
      { from: e, to: c, oneWay: false },
      { from: a, to: c, oneWay: true },
    ]);
    const state = run(emptyState(), {
      ...start,
      cards: [...start.cards, { id: e, code: 'L2', zone: { kind: 'location', mapId: main } }],
    });

    expect(shortestPaths(state, a, c)).toEqual([[a, c]]);
    expect(shortestPaths(state, c, a)).toEqual([
      [c, b, a],
      [c, e, a],
    ]);
  });

  it('crosses from one map to another', () => {
    const state = run(emptyState(), startWith([{ from: b, to: c, oneWay: false }]));
    const linked = run(state, { type: 'AddConnection', from: a, to: b });

    expect(shortestPaths(state, a, c)).toEqual([]);
    expect(shortestPaths(linked, a, c)).toEqual([[a, b, c]]);
  });
});

describe('RevealLocation', () => {
  let state: GameState;
  beforeEach(() => {
    state = run(emptyState(), startWith());
  });

  it('flips the location and places clues per investigator', () => {
    const next = run(state, { type: 'RevealLocation', locationId: b });

    expect(next.cards[b]?.faceUp).toBe(true);
    expect(next.cards[b]?.tokens.clue).toBe(4);
  });

  it('places a fixed clue count regardless of investigators', () => {
    const next = run(state, { type: 'RevealLocation', locationId: c });

    expect(next.cards[c]?.tokens.clue).toBe(1);
  });

  it('rejects revealing a location twice', () => {
    const revealed = run(state, { type: 'RevealLocation', locationId: a });

    const rejection = rejectionOf(() =>
      execute(sandboxContext, revealed, { type: 'RevealLocation', locationId: a }),
    );

    expect(rejection).toEqual({ code: 'alreadyRevealed', cardId: a });
  });

  it('rejects revealing a card that is not on a map', () => {
    const rejection = rejectionOf(() =>
      execute(sandboxContext, state, { type: 'RevealLocation', locationId: d }),
    );

    expect(rejection).toEqual({ code: 'notALocation', cardId: d });
  });

  it('rejects revealing an unknown card', () => {
    const rejection = rejectionOf(() =>
      execute(sandboxContext, state, { type: 'RevealLocation', locationId: instanceId('nowhere') }),
    );

    expect(rejection).toEqual({ code: 'unknownCard', cardId: 'nowhere' });
  });
});
