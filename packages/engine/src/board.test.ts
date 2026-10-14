import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  execute,
  instanceId,
  mapId,
  neighbours,
  replay,
  shortestPaths,
  type Command,
  type Edge,
  type GameState,
  type InstanceId,
} from './index';
import {
  edge,
  rejectionOf,
  runFrom,
  startBoard,
  testContext,
  type BoardOptions,
} from '../test/utils';

const main = mapId('main');
const annex = mapId('annex');
const study = instanceId('study');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

/** Two maps: study (L1) and hall (L2) on main, cellar (L3) on annex; attic (L1) and a ghoul set aside. */
function board(connections: Edge[] = [], overrides: Partial<BoardOptions> = {}): GameState {
  return startBoard(testContext, {
    maps: {
      main: { locations: { study: 'L1', hall: 'L2' }, connections },
      annex: { locations: { cellar: 'L3' } },
    },
    setAside: { attic: 'L1', ghoul: 'E1' },
    playerCount: 2,
    ...overrides,
  });
}

function run(state: GameState, ...commands: Command[]): GameState {
  return runFrom(testContext, state, commands).state;
}

describe('AddConnection', () => {
  it('adds an undirected edge that works in both directions', () => {
    const next = run(board(), { type: 'AddConnection', mapId: main, from: study, to: hall });

    expect(neighbours(next, study)).toEqual([hall]);
    expect(neighbours(next, hall)).toEqual([study]);
  });

  it('adds a one-way edge that only works from its source', () => {
    const next = run(board(), {
      type: 'AddConnection',
      mapId: main,
      from: study,
      to: hall,
      oneWay: true,
    });

    expect(neighbours(next, study)).toEqual([hall]);
    expect(neighbours(next, hall)).toEqual([]);
  });

  it('stores the edge on the map named by the command, even when it ends on another map', () => {
    const next = run(board(), { type: 'AddConnection', mapId: annex, from: hall, to: cellar });

    expect(next.board.maps[annex]?.connections).toEqual([edge('hall', 'cellar')]);
    expect(next.board.maps[main]?.connections).toEqual([]);
  });

  it.each([
    ['an edge that already exists', { from: study, to: hall }],
    ['the same edge reversed', { from: hall, to: study }],
    ['the same edge on another map', { from: study, to: hall, mapId: annex }],
  ] as const)('rejects %s', (_name, command) => {
    const state = board([edge('study', 'hall')]);

    const rejection = rejectionOf(() =>
      execute(testContext, state, { type: 'AddConnection', mapId: main, ...command }),
    );

    expect(rejection).toEqual({
      code: 'duplicateConnection',
      from: command.from,
      to: command.to,
    });
  });

  it.each([
    ['a location to itself', { from: study, to: study }, { code: 'selfConnection', cardId: study }],
    [
      'a card that is not a location',
      { from: study, to: ghoul },
      { code: 'notALocation', cardId: ghoul },
    ],
    [
      'an unknown card',
      { from: study, to: instanceId('nowhere') },
      { code: 'unknownCard', cardId: 'nowhere' },
    ],
  ] as const)('rejects connecting %s', (_name, ends, expected) => {
    const rejection = rejectionOf(() =>
      execute(testContext, board(), { type: 'AddConnection', mapId: main, ...ends }),
    );

    expect(rejection).toEqual(expected);
  });

  it('rejects an edge for an unknown map', () => {
    const rejection = rejectionOf(() =>
      execute(testContext, board(), {
        type: 'AddConnection',
        mapId: mapId('nowhere'),
        from: study,
        to: hall,
      }),
    );

    expect(rejection).toEqual({ code: 'unknownMap', mapId: 'nowhere' });
  });

  it('keeps an edge to a set-aside location inactive until it enters play', () => {
    const connected = run(board(), { type: 'AddConnection', mapId: main, from: study, to: attic });

    const inPlay = run(connected, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: attic, to: { kind: 'location', mapId: annex } },
    });

    expect(neighbours(connected, study)).toEqual([]);
    expect(neighbours(inPlay, study)).toEqual([attic]);
  });
});

describe('RemoveConnection', () => {
  it('removes an undirected edge given in the opposite direction', () => {
    const state = board([edge('study', 'hall')]);

    const next = run(state, { type: 'RemoveConnection', from: hall, to: study });

    expect(next.board.maps[main]?.connections).toEqual([]);
  });

  it('removes a cross-map edge from the map that owns it', () => {
    const state = board([edge('hall', 'cellar')]);

    const next = run(state, { type: 'RemoveConnection', from: cellar, to: hall });

    expect(next.board.maps[main]?.connections).toEqual([]);
  });

  it('does not remove a one-way edge with an undirected command', () => {
    const state = board([edge('study', 'hall', { oneWay: true })]);

    const rejection = rejectionOf(() =>
      execute(testContext, state, { type: 'RemoveConnection', from: study, to: hall }),
    );

    expect(rejection).toEqual({ code: 'connectionNotFound', from: study, to: hall });
  });
});

describe('connections at start', () => {
  it('rejects starting connections that repeat an edge, even across maps', () => {
    const rejection = rejectionOf(() =>
      startBoard(testContext, {
        maps: {
          main: { locations: { study: 'L1', hall: 'L2' }, connections: [edge('study', 'hall')] },
          annex: { locations: {}, connections: [edge('hall', 'study')] },
        },
      }),
    );

    expect(rejection).toEqual({ code: 'duplicateConnection', from: hall, to: study });
  });

  it('allows a starting connection to a location on another map', () => {
    const state = board([edge('hall', 'cellar')]);

    expect(neighbours(state, hall)).toEqual([cellar]);
  });
});

describe('connection events', () => {
  it('keep the invariants and replay to the same state', () => {
    const commands: Command[] = [
      { type: 'AddConnection', mapId: main, from: study, to: hall },
      { type: 'RemoveConnection', from: study, to: hall },
      { type: 'AddConnection', mapId: annex, from: hall, to: cellar, oneWay: true },
    ];
    const initial = board();

    const { state, events } = runFrom(testContext, initial, commands);

    expect(checkInvariants(state)).toEqual([]);
    expect(replay(events, initial)).toEqual(state);
  });
});

describe('neighbours', () => {
  const edges = [edge('study', 'hall'), edge('hall', 'cellar', { oneWay: true })];

  it.each([
    ['study', ['hall']],
    ['hall', ['study', 'cellar']],
    ['cellar', []],
  ])('lists the locations reachable from %s', (from, expected) => {
    expect(neighbours(board(edges), instanceId(from))).toEqual(expected);
  });

  it.each([
    ['a set-aside location', 'attic'],
    ['a card that is not a location', 'ghoul'],
    ['an unknown card', 'nowhere'],
  ])('is empty for %s', (_name, from) => {
    const state = board([...edges, edge('study', 'attic')]);

    expect(neighbours(state, instanceId(from))).toEqual([]);
  });
});

describe('shortestPaths', () => {
  const ring: Edge[] = [
    edge('study', 'hall'),
    edge('hall', 'cellar'),
    edge('study', 'den'),
    edge('den', 'cellar'),
    edge('study', 'cellar', { oneWay: true }),
  ];
  const ringBoard = startBoard(testContext, {
    maps: {
      main: { locations: { study: 'L1', hall: 'L2', den: 'L2' }, connections: ring },
      annex: { locations: { cellar: 'L3' } },
    },
    setAside: { attic: 'L1' },
  });
  const path = (...keys: string[]): InstanceId[] => keys.map(instanceId);

  it.each([
    ['the location itself when from equals to', 'study', 'study', [path('study')]],
    ['a direct one-way edge, ignoring longer routes', 'study', 'cellar', [path('study', 'cellar')]],
    [
      'every equally short path against the one-way edge',
      'cellar',
      'study',
      [path('cellar', 'hall', 'study'), path('cellar', 'den', 'study')],
    ],
    ['nothing for a location that is not on a map', 'study', 'attic', []],
    ['nothing for an unknown location', 'nowhere', 'study', []],
  ])('returns %s', (_name, from, to, expected) => {
    expect(shortestPaths(ringBoard, instanceId(from), instanceId(to))).toEqual(expected);
  });

  it('returns no path when the target cannot be reached', () => {
    expect(shortestPaths(board([edge('study', 'hall')]), study, cellar)).toEqual([]);
  });

  it('crosses from one map to another', () => {
    const state = board([edge('hall', 'cellar')]);

    expect(shortestPaths(state, hall, cellar)).toEqual([[hall, cellar]]);
  });
});

describe('RevealLocation', () => {
  it.each([
    ['per investigator', hall, 4],
    ['as a fixed amount regardless of investigators', cellar, 1],
  ])('flips the location and places clues %s', (_name, locationId, clues) => {
    const next = run(board(), { type: 'RevealLocation', locationId });

    expect(next.cards[locationId]?.faceUp).toBe(true);
    expect(next.cards[locationId]?.tokens.clue).toBe(clues);
  });

  it('rejects revealing a location twice', () => {
    const revealed = run(board(), { type: 'RevealLocation', locationId: study });

    const rejection = rejectionOf(() =>
      execute(testContext, revealed, { type: 'RevealLocation', locationId: study }),
    );

    expect(rejection).toEqual({ code: 'alreadyRevealed', cardId: study });
  });

  it.each([
    ['a card that is not on a map', attic, { code: 'notALocation', cardId: attic }],
    ['an unknown card', instanceId('nowhere'), { code: 'unknownCard', cardId: 'nowhere' }],
  ])('rejects revealing %s', (_name, locationId, expected) => {
    const rejection = rejectionOf(() =>
      execute(testContext, board(), { type: 'RevealLocation', locationId }),
    );

    expect(rejection).toEqual(expected);
  });
});
