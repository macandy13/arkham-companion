import { describe, expect, it } from 'vitest';
import {
  cardDbFrom,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  type CardStats,
  type Edge,
  type EngineContext,
  type GameState,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';

const main = mapId('main');
const alice = investigatorId('alice');
const bob = investigatorId('bob');
const id = instanceId;

const defs: CardStats[] = [
  { code: 'LOC', name: 'Fake Place', typeCode: 'location', traits: [] },
  {
    code: 'HNT',
    name: 'Fake Hunter',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'hunter' }],
  },
  {
    code: 'HPY',
    name: 'Fake Hunting Predator',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'hunter' }, { name: 'prey', detail: 'Most clues' }],
  },
  {
    code: 'HAL',
    name: 'Fake Hunting Loner',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'hunter' }, { name: 'aloof' }],
  },
  { code: 'FOE', name: 'Fake Foe', typeCode: 'enemy', traits: [] },
];
const ctx: EngineContext = { cards: cardDbFrom(defs) };

const link = (from: string, to: string, oneWay = false): Edge => ({
  from: id(from),
  to: id(to),
  oneWay,
});

function investigator(who: typeof alice, location: string, clues = 0): Investigator {
  return {
    id: who,
    code: 'inv',
    name: who,
    seat: who === alice ? 1 : 2,
    locationId: id(location),
    health: { max: 8, damage: 0 },
    sanity: { max: 8, horror: 0 },
    clues,
    resources: 0,
    doomOnPlayerCards: 0,
    status: 'active',
  };
}

/** Locations named by `places` joined by `edges`; every enemy of `enemies` as `[id, code, zone]`. */
function started(
  places: string[],
  edges: Edge[],
  investigators: Investigator[],
  enemies: [string, string, Zone][],
): GameState {
  const cards: StartingCard[] = [
    ...places.map((place) => ({
      id: id(place),
      code: 'LOC',
      zone: { kind: 'location', mapId: main } as Zone,
      faceUp: true,
    })),
    ...enemies.map(([enemyId, code, zone]) => ({ id: id(enemyId), code, zone, faceUp: true })),
  ];
  return execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'hunters',
    difficulty: 'standard',
    seed: 1,
    shuffleEncounterDeck: false,
    investigators,
    maps: { [main]: { name: 'Main' } },
    cards,
    connections: edges,
  }).state;
}

const at = (place: string): Zone => ({ kind: 'atLocation', locationId: id(place) });
const moveHunters = { type: 'MoveHunters' } as const;

function zoneOf(state: GameState, enemy: string): Zone | undefined {
  return state.cards[id(enemy)]?.zone;
}

describe('MoveHunters', () => {
  it('moves a hunter one step along the path to the investigator', () => {
    const state = started(
      ['a', 'b', 'c'],
      [link('a', 'b'), link('b', 'c')],
      [investigator(alice, 'c')],
      [['h', 'HNT', at('a')]],
    );

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  it('engages the investigator when it arrives', () => {
    const state = started(
      ['a', 'b'],
      [link('a', 'b')],
      [investigator(alice, 'b')],
      [['h', 'HNT', at('a')]],
    );

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual({ kind: 'engaged', investigatorId: alice });
  });

  it('does not engage an aloof hunter on arrival', () => {
    const state = started(
      ['a', 'b'],
      [link('a', 'b')],
      [investigator(alice, 'b')],
      [['h', 'HAL', at('a')]],
    );

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(at('b'));
  });

  it('does not move a hunter that shares a location with an investigator', () => {
    const state = started(
      ['a', 'b'],
      [link('a', 'b')],
      [investigator(alice, 'b'), investigator(bob, 'a')],
      [['h', 'HAL', at('a')]],
    );

    const { events } = execute(ctx, state, moveHunters);

    expect(events).toEqual([]);
  });

  it('does not move exhausted, engaged or non-hunter enemies', () => {
    const state = started(
      ['a', 'b', 'c'],
      [link('a', 'b'), link('b', 'c')],
      [investigator(alice, 'c')],
      [
        ['tired', 'HNT', at('a')],
        ['held', 'HNT', { kind: 'engaged', investigatorId: alice }],
        ['plain', 'FOE', at('a')],
      ],
    );
    const exhausted = execute(ctx, state, { type: 'ExhaustEnemy', enemyId: id('tired') }).state;

    const { events } = execute(ctx, exhausted, moveHunters);

    expect(events).toEqual([]);
  });

  it('does not move a hunter that cannot reach anyone', () => {
    const state = started(['a', 'b'], [], [investigator(alice, 'b')], [['h', 'HNT', at('a')]]);

    const { events } = execute(ctx, state, moveHunters);

    expect(events).toEqual([]);
  });

  it('respects one-way connections', () => {
    const state = started(
      ['a', 'b'],
      [link('b', 'a', true)],
      [investigator(alice, 'b')],
      [['h', 'HNT', at('a')]],
    );

    const { events } = execute(ctx, state, moveHunters);

    expect(events).toEqual([]);
  });

  it('heads for the nearest investigator', () => {
    const state = started(
      ['x', 'far', 'a', 'near'],
      [link('x', 'far'), link('far', 'a'), link('a', 'near')],
      [investigator(alice, 'x'), investigator(bob, 'near')],
      [['h', 'HNT', at('a')]],
    );

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual({ kind: 'engaged', investigatorId: bob });
  });

  it('moves the same way when equally near investigators share the first step', () => {
    const state = started(
      ['a', 'b', 'c', 'd'],
      [link('a', 'b'), link('b', 'c'), link('b', 'd')],
      [investigator(alice, 'c'), investigator(bob, 'd')],
      [['h', 'HNT', at('a')]],
    );

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  describe('ties', () => {
    const fork = ['a', 'b', 'c', 'd'];
    const forkEdges = [link('a', 'b'), link('a', 'c'), link('b', 'd'), link('c', 'd')];

    it('asks for the destination when two shortest paths differ', () => {
      const state = started(fork, forkEdges, [investigator(alice, 'd')], [['h', 'HNT', at('a')]]);

      const { state: after } = execute(ctx, state, moveHunters);

      expect(zoneOf(after, 'h')).toEqual(at('a'));
      expect(after.pending).toMatchObject([
        {
          kind: 'chooseLocation',
          subject: 'h',
          options: [{ target: 'b' }, { target: 'c' }],
        },
      ]);
    });

    it('does not ask again while the question is open', () => {
      const state = started(fork, forkEdges, [investigator(alice, 'd')], [['h', 'HNT', at('a')]]);
      const asked = execute(ctx, state, moveHunters).state;

      const { events } = execute(ctx, asked, moveHunters);

      expect(events).toEqual([]);
    });

    it('asks which investigator to hunt when equally near investigators lead apart', () => {
      const state = started(
        ['a', 'b', 'c'],
        [link('a', 'b'), link('a', 'c')],
        [investigator(alice, 'b'), investigator(bob, 'c')],
        [['h', 'HNT', at('a')]],
      );

      const { state: after } = execute(ctx, state, moveHunters);

      expect(after.pending).toMatchObject([
        { kind: 'chooseInvestigator', subject: 'h', options: [{ target: alice }, { target: bob }] },
      ]);
    });

    it('lets prey pick between equally near investigators', () => {
      const state = started(
        ['a', 'b', 'c'],
        [link('a', 'b'), link('a', 'c')],
        [investigator(alice, 'b', 1), investigator(bob, 'c', 2)],
        [['h', 'HPY', at('a')]],
      );

      const { state: after } = execute(ctx, state, moveHunters);

      expect(zoneOf(after, 'h')).toEqual({ kind: 'engaged', investigatorId: bob });
    });

    it('asks for the destination after prey picked one investigator with two routes', () => {
      const state = started(
        fork,
        forkEdges,
        [investigator(alice, 'd', 1), investigator(bob, 'd', 1)],
        [['h', 'HPY', at('a')]],
      );

      const { state: after } = execute(ctx, state, moveHunters);

      expect(after.pending).toMatchObject([{ kind: 'chooseLocation', subject: 'h' }]);
    });
  });

  it('keeps the invariants', () => {
    const state = started(
      ['a', 'b'],
      [link('a', 'b')],
      [investigator(alice, 'b')],
      [['h', 'HNT', at('a')]],
    );

    expect(checkInvariants(execute(ctx, state, moveHunters).state)).toEqual([]);
  });
});
