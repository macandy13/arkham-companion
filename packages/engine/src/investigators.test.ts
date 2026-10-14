import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkInvariants,
  execute,
  instanceId,
  investigatorId,
  lowestRemainingHealth,
  lowestRemainingSanity,
  mostClues,
  mostResources,
  type Command,
  type GameState,
  type Investigator,
  type Rejection,
} from './index';
import {
  edge,
  investigatorOf,
  makeInvestigator,
  rejectionOf,
  runFrom,
  startBoard,
  testContext,
} from '../test/utils';

const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const alice = investigatorId('alice');
const bob = investigatorId('bob');

/**
 * Hall (L1, 1 clue per investigator) - Cellar (L2, 2 per investigator), both
 * unrevealed; Attic (L3) is unconnected. Alice is placed at the hall, which
 * reveals it (2 clues with two investigators); Bob has no location.
 */
function startWith(investigators: Investigator[]): GameState {
  const board = startBoard(testContext, {
    maps: {
      main: {
        locations: { hall: 'L1', cellar: 'L2', attic: 'L3' },
        connections: [edge('hall', 'cellar')],
      },
    },
    investigators,
  });
  return run(board, { type: 'MoveInvestigator', investigatorId: alice, to: hall });
}

function run(state: GameState, ...commands: Command[]): GameState {
  return runFrom(testContext, state, commands).state;
}

function reject(state: GameState, command: Command): Rejection {
  return rejectionOf(() => execute(testContext, state, command));
}

describe('MoveInvestigator', () => {
  let state: GameState;
  beforeEach(() => {
    state = startWith([makeInvestigator({ id: alice }), makeInvestigator({ id: bob, seat: 1 })]);
  });

  it('moves along a connection and reveals the destination with its clues', () => {
    const result = execute(testContext, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
    });

    expect(result.events.map((e) => e.type)).toEqual([
      'InvestigatorMoved',
      'CardFlipped',
      'TokensChanged',
    ]);
    expect(investigatorOf(result.state, alice).locationId).toBe(cellar);
    expect(result.state.cards[cellar]).toMatchObject({ faceUp: true, tokens: { clue: 4 } });
    expect(checkInvariants(result.state)).toEqual([]);
  });

  it('does not reveal a destination that is already revealed', () => {
    const atCellar = run(state, { type: 'MoveInvestigator', investigatorId: alice, to: cellar });

    const result = execute(testContext, atCellar, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: hall,
    });

    expect(result.events.map((e) => e.type)).toEqual(['InvestigatorMoved']);
  });

  it('rejects a location that is not connected', () => {
    expect(reject(state, { type: 'MoveInvestigator', investigatorId: alice, to: attic })).toEqual({
      code: 'notConnected',
      from: hall,
      to: attic,
    });
  });

  it('allows an unconnected destination when connections are ignored', () => {
    const moved = run(state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    expect(investigatorOf(moved, alice).locationId).toBe(attic);
    expect(moved.cards[attic]?.faceUp).toBe(true);
  });

  it('places an investigator without a location anywhere in play', () => {
    const placed = run(state, { type: 'MoveInvestigator', investigatorId: bob, to: attic });

    expect(investigatorOf(placed, bob).locationId).toBe(attic);
  });

  it('rejects moving to the current location', () => {
    expect(reject(state, { type: 'MoveInvestigator', investigatorId: alice, to: hall })).toEqual({
      code: 'alreadyAtLocation',
      investigatorId: alice,
      locationId: hall,
    });
  });

  it('rejects an unknown investigator', () => {
    const rejection = reject(state, {
      type: 'MoveInvestigator',
      investigatorId: investigatorId('nobody'),
      to: cellar,
    });

    expect(rejection.code).toBe('unknownInvestigator');
  });

  it('rejects a destination that is not on a map', () => {
    const rejection = reject(state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: instanceId('nowhere'),
    });

    expect(rejection.code).toBe('unknownCard');
  });

  it('rejects a defeated investigator', () => {
    const defeated = run(state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 8,
    });

    expect(
      reject(defeated, { type: 'MoveInvestigator', investigatorId: alice, to: cellar }),
    ).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });
});

describe('AdjustInvestigator', () => {
  let state: GameState;
  beforeEach(() => {
    state = startWith([
      makeInvestigator({
        id: alice,
        health: { max: 3, damage: 0 },
        sanity: { max: 2, horror: 0 },
        clues: 1,
      }),
    ]);
  });

  it('changes damage, horror, clues and resources', () => {
    const adjusted = run(
      state,
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 2 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'horror', delta: 1 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'clues', delta: 2 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'resources', delta: -3 },
    );

    expect(investigatorOf(adjusted, alice)).toMatchObject({
      health: { damage: 2 },
      sanity: { horror: 1 },
      clues: 3,
      resources: 2,
      status: 'active',
    });
  });

  it('defeats the investigator when damage reaches health', () => {
    const result = execute(testContext, state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 3,
    });

    expect(result.events.map((e) => e.type)).toEqual([
      'InvestigatorChanged',
      'InvestigatorDefeated',
    ]);
    expect(result.events[1]).toMatchObject({ cause: 'damage' });
    expect(investigatorOf(result.state, alice).status).toBe('defeated');
  });

  it('defeats the investigator when horror reaches sanity', () => {
    const defeated = run(state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'horror',
      delta: 5,
    });

    expect(investigatorOf(defeated, alice)).toMatchObject({
      status: 'defeated',
      sanity: { horror: 5 },
    });
  });

  it('does not defeat the investigator while health and sanity remain', () => {
    const hurt = run(state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 2,
    });

    expect(investigatorOf(hurt, alice).status).toBe('active');
  });

  it('rejects a counter dropping below zero', () => {
    expect(
      reject(state, {
        type: 'AdjustInvestigator',
        investigatorId: alice,
        stat: 'clues',
        delta: -2,
      }),
    ).toEqual({
      code: 'negativeInvestigatorStat',
      investigatorId: alice,
      stat: 'clues',
      current: 1,
      delta: -2,
    });
  });

  it('rejects a zero delta', () => {
    expect(
      reject(state, {
        type: 'AdjustInvestigator',
        investigatorId: alice,
        stat: 'clues',
        delta: 0,
      }).code,
    ).toBe('invalidTokenDelta');
  });

  it('rejects adjusting a defeated investigator', () => {
    const defeated = run(state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 3,
    });

    expect(
      reject(defeated, {
        type: 'AdjustInvestigator',
        investigatorId: alice,
        stat: 'resources',
        delta: 1,
      }).code,
    ).toBe('investigatorNotActive');
  });

  it('keeps the starting player count after a defeat', () => {
    const defeated = run(
      startWith([makeInvestigator({ id: alice }), makeInvestigator({ id: bob, seat: 1 })]),
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 8 },
    );

    expect(defeated.meta.playerCount).toBe(2);
  });
});

describe('DiscoverClues', () => {
  let state: GameState;
  beforeEach(() => {
    state = startWith([makeInvestigator({ id: alice }), makeInvestigator({ id: bob, seat: 1 })]);
  });

  it('moves clues from the location to the investigator', () => {
    const discovered = run(state, {
      type: 'DiscoverClues',
      investigatorId: alice,
      locationId: hall,
      amount: 1,
    });

    expect(discovered.cards[hall]?.tokens.clue).toBe(1);
    expect(investigatorOf(discovered, alice).clues).toBe(1);
    expect(checkInvariants(discovered)).toEqual([]);
  });

  it('rejects more clues than the location has', () => {
    expect(
      reject(state, {
        type: 'DiscoverClues',
        investigatorId: alice,
        locationId: hall,
        amount: 3,
      }),
    ).toEqual({ code: 'notEnoughClues', cardId: hall, available: 2, requested: 3 });
  });

  it('rejects an investigator who is elsewhere', () => {
    expect(
      reject(state, {
        type: 'DiscoverClues',
        investigatorId: bob,
        locationId: hall,
        amount: 1,
      }),
    ).toEqual({ code: 'investigatorNotAtLocation', investigatorId: bob, locationId: hall });
  });

  it('rejects a non-positive amount', () => {
    expect(
      reject(state, {
        type: 'DiscoverClues',
        investigatorId: alice,
        locationId: hall,
        amount: 0,
      }).code,
    ).toBe('invalidTokenDelta');
  });
});

describe('prey helpers', () => {
  const hurt = makeInvestigator({
    id: alice,
    health: { max: 7, damage: 4 },
    sanity: { max: 6, horror: 1 },
    clues: 3,
    resources: 1,
  });
  const shaken = makeInvestigator({
    id: bob,
    seat: 1,
    health: { max: 9, damage: 1 },
    sanity: { max: 6, horror: 3 },
    clues: 3,
    resources: 4,
  });

  it('finds the lowest remaining health', () => {
    expect(lowestRemainingHealth([hurt, shaken])).toEqual([hurt]);
  });

  it('finds the lowest remaining sanity', () => {
    expect(lowestRemainingSanity([hurt, shaken])).toEqual([shaken]);
  });

  it('returns every investigator tied for most clues', () => {
    expect(mostClues([hurt, shaken])).toEqual([hurt, shaken]);
  });

  it('finds the most resources', () => {
    expect(mostResources([hurt, shaken])).toEqual([shaken]);
  });

  it('ignores defeated and resigned investigators', () => {
    const gone = { ...hurt, status: 'defeated' as const };

    expect(lowestRemainingHealth([gone, shaken])).toEqual([shaken]);
  });

  it('is empty when nobody is active', () => {
    expect(mostClues([{ ...hurt, status: 'resigned' }])).toEqual([]);
  });
});

describe('investigator state over a sequence of adjustments', () => {
  const adjust = (stat: 'damage' | 'horror' | 'clues' | 'resources', delta: number): Command => ({
    type: 'AdjustInvestigator',
    investigatorId: alice,
    stat,
    delta,
  });

  it.each([
    ['damage below health', [adjust('damage', 2)], 'active'],
    ['damage reaching health', [adjust('damage', 2), adjust('damage', 1)], 'defeated'],
    ['horror reaching sanity', [adjust('horror', 1), adjust('horror', 1)], 'defeated'],
    ['damage healed before health runs out', [adjust('damage', 2), adjust('damage', -2)], 'active'],
    ['clues and resources only', [adjust('clues', 4), adjust('resources', -5)], 'active'],
  ] as const)(
    'after %s the investigator is %s and the state is consistent',
    (_, commands, status) => {
      const start = startWith([
        makeInvestigator({
          id: alice,
          health: { max: 3, damage: 0 },
          sanity: { max: 2, horror: 0 },
        }),
      ]);

      const end = run(start, ...commands);

      expect(investigatorOf(end, alice).status).toBe(status);
      expect(checkInvariants(end)).toEqual([]);
    },
  );
});

describe('lowestRemainingHealth with ties', () => {
  const withHealth = (id: string, max: number, damage: number): Investigator =>
    makeInvestigator({ id, health: { max, damage } });

  it.each([
    ['a single investigator', [withHealth('a', 5, 4)], ['a']],
    ['a clear minimum', [withHealth('a', 9, 0), withHealth('b', 6, 1)], ['b']],
    [
      'investigators tied on remaining health',
      [withHealth('a', 9, 4), withHealth('b', 6, 1), withHealth('c', 8, 0)],
      ['a', 'b'],
    ],
  ])('returns the lowest for %s', (_, candidates, expectedIds) => {
    expect(lowestRemainingHealth(candidates).map((inv) => inv.id)).toEqual(expectedIds);
  });
});
