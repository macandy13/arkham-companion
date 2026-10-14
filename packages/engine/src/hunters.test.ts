import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  shortestPaths,
  type Command,
  type Edge,
  type GameState,
  type InstanceId,
  type Investigator,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  makeCard,
  makeInvestigator,
  rejectionOf,
  startBoard,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');

const ctx = contextWith(
  makeCard({ code: 'LOC', typeCode: 'location' }),
  makeCard({ code: 'HNT', typeCode: 'enemy', keywords: [{ name: 'hunter' }] }),
  makeCard({
    code: 'HPY',
    typeCode: 'enemy',
    keywords: [{ name: 'hunter' }, { name: 'prey', detail: 'Most clues' }],
  }),
  makeCard({ code: 'HAL', typeCode: 'enemy', keywords: [{ name: 'hunter' }, { name: 'aloof' }] }),
  makeCard({ code: 'FOE', typeCode: 'enemy' }),
);

const at = (place: string): Zone => ({ kind: 'atLocation', locationId: instanceId(place) });
const engagedWith = (id: typeof alice): Zone => ({ kind: 'engaged', investigatorId: id });
const moveHunters: Command = { type: 'MoveHunters' };

/** An investigator standing at `location`; `clues` matter for prey. */
function investigator(id: 'alice' | 'bob', location: string, clues = 0): Investigator {
  return makeInvestigator({
    id,
    seat: id === 'alice' ? 0 : 1,
    locationId: instanceId(location),
    clues,
  });
}

interface Layout {
  /** Location names; each is also its instance ID. */
  places: string[];
  edges: Edge[];
  investigators: Investigator[];
  /** Enemy instance ID to code and zone. */
  enemies: Record<string, { code: string; zone: Zone }>;
}

function started({ places, edges, investigators, enemies }: Layout): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: Object.fromEntries(places.map((place) => [place, 'LOC'])),
        connections: edges,
      },
    },
    investigators,
    cards: enemies,
  });
}

const zoneOf = (state: GameState, enemy: string): Zone | undefined =>
  state.cards[instanceId(enemy)]?.zone;

/** Undirected edges joining consecutive places. */
const line = (...places: string[]): Edge[] =>
  places.slice(1).map((place, i) => edge(places[i] ?? place, place));

/** A diamond a-b-d and a-c-d: two equally short routes from a to d. */
const fork = {
  places: ['a', 'b', 'c', 'd'],
  edges: [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')],
};

describe('MoveHunters', () => {
  it('moves a hunter one step along the path to the investigator', () => {
    const state = started({
      places: ['a', 'b', 'c'],
      edges: line('a', 'b', 'c'),
      investigators: [investigator('alice', 'c')],
      enemies: { h: { code: 'HNT', zone: at('a') } },
    });

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  it.each([
    { name: 'engages the investigator when it arrives', code: 'HNT', zone: engagedWith(alice) },
    { name: 'does not engage an aloof hunter on arrival', code: 'HAL', zone: at('b') },
  ])('$name', ({ code, zone }) => {
    const state = started({
      places: ['a', 'b'],
      edges: line('a', 'b'),
      investigators: [investigator('alice', 'b')],
      enemies: { h: { code, zone: at('a') } },
    });

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(zone);
  });

  it.each([
    {
      name: 'shares a location with an investigator',
      edges: line('a', 'b'),
      investigators: [investigator('alice', 'b'), investigator('bob', 'a')],
    },
    { name: 'cannot reach anyone', edges: [], investigators: [investigator('alice', 'b')] },
    {
      name: 'is cut off by a one-way connection',
      edges: [edge('b', 'a', { oneWay: true })],
      investigators: [investigator('alice', 'b')],
    },
  ])('does not move a hunter that $name', ({ edges, investigators }) => {
    const state = started({
      places: ['a', 'b'],
      edges,
      investigators,
      enemies: { h: { code: 'HNT', zone: at('a') } },
    });

    expect(execute(ctx, state, moveHunters).events).toEqual([]);
  });

  it('does not move exhausted, engaged or non-hunter enemies', () => {
    const state = started({
      places: ['a', 'b', 'c'],
      edges: line('a', 'b', 'c'),
      investigators: [investigator('alice', 'c')],
      enemies: {
        tired: { code: 'HNT', zone: at('a') },
        held: { code: 'HNT', zone: engagedWith(alice) },
        plain: { code: 'FOE', zone: at('a') },
      },
    });
    const exhausted = execute(ctx, state, {
      type: 'ExhaustEnemy',
      enemyId: instanceId('tired'),
    }).state;

    expect(execute(ctx, exhausted, moveHunters).events).toEqual([]);
  });

  it('heads for the nearest investigator', () => {
    const state = started({
      places: ['x', 'far', 'a', 'near'],
      edges: line('x', 'far', 'a', 'near'),
      investigators: [investigator('alice', 'x'), investigator('bob', 'near')],
      enemies: { h: { code: 'HNT', zone: at('a') } },
    });

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(engagedWith(bob));
  });

  it('moves the same way when equally near investigators share the first step', () => {
    const state = started({
      places: ['a', 'b', 'c', 'd'],
      edges: [edge('a', 'b'), edge('b', 'c'), edge('b', 'd')],
      investigators: [investigator('alice', 'c'), investigator('bob', 'd')],
      enemies: { h: { code: 'HNT', zone: at('a') } },
    });

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, 'h')).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  describe('ties', () => {
    it('asks for the destination when two shortest paths differ', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd')],
        enemies: { h: { code: 'HNT', zone: at('a') } },
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(zoneOf(after, 'h')).toEqual(at('a'));
      expect(after.pending).toMatchObject([
        { kind: 'chooseLocation', subject: 'h', options: [{ target: 'b' }, { target: 'c' }] },
      ]);
    });

    it('rejects another hunter move while the question is open', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd')],
        enemies: { h: { code: 'HNT', zone: at('a') } },
      });
      const asked = execute(ctx, state, moveHunters).state;

      expect(rejectionOf(() => execute(ctx, asked, moveHunters)).code).toBe('decisionPending');
    });

    it('moves the hunter to the location the players chose', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd')],
        enemies: { h: { code: 'HNT', zone: at('a') } },
      });
      const asked = execute(ctx, state, moveHunters).state;

      const { state: after } = execute(ctx, asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('hunter:h:location'),
        optionId: 'c',
      });

      expect(zoneOf(after, 'h')).toEqual(at('c'));
      expect(after.pending).toEqual([]);
    });

    it('asks which investigator to hunt when equally near investigators lead apart', () => {
      const state = started({
        places: ['a', 'b', 'c'],
        edges: [edge('a', 'b'), edge('a', 'c')],
        investigators: [investigator('alice', 'b'), investigator('bob', 'c')],
        enemies: { h: { code: 'HNT', zone: at('a') } },
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(after.pending).toMatchObject([
        { kind: 'chooseInvestigator', subject: 'h', options: [{ target: alice }, { target: bob }] },
      ]);
    });

    it('engages the investigator the players chose when the hunter can reach them', () => {
      const state = started({
        places: ['a', 'b', 'c'],
        edges: [edge('a', 'b'), edge('a', 'c')],
        investigators: [investigator('alice', 'b'), investigator('bob', 'c')],
        enemies: { h: { code: 'HNT', zone: at('a') } },
      });
      const asked = execute(ctx, state, moveHunters).state;

      const { state: after } = execute(ctx, asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('hunter:h:investigator'),
        optionId: bob,
      });

      expect(zoneOf(after, 'h')).toEqual(engagedWith(bob));
    });

    it('lets prey pick between equally near investigators', () => {
      const state = started({
        places: ['a', 'b', 'c'],
        edges: [edge('a', 'b'), edge('a', 'c')],
        investigators: [investigator('alice', 'b', 1), investigator('bob', 'c', 2)],
        enemies: { h: { code: 'HPY', zone: at('a') } },
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(zoneOf(after, 'h')).toEqual(engagedWith(bob));
    });

    it('asks for the destination after prey picked one investigator with two routes', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd', 1), investigator('bob', 'd', 1)],
        enemies: { h: { code: 'HPY', zone: at('a') } },
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(after.pending).toMatchObject([{ kind: 'chooseLocation', subject: 'h' }]);
    });
  });
});

describe('MoveHunter', () => {
  const layout = (): GameState =>
    started({
      ...fork,
      investigators: [investigator('alice', 'd')],
      enemies: {
        h: { code: 'HNT', zone: at('a') },
        held: { code: 'HNT', zone: engagedWith(alice) },
        plain: { code: 'LOC', zone: at('a') },
      },
    });

  it.each([
    { name: 'an engaged enemy', enemyId: 'held', to: 'b', code: 'notAHunter' },
    { name: 'a card that is not an enemy', enemyId: 'plain', to: 'b', code: 'notAHunter' },
    { name: 'an unknown card', enemyId: 'nobody', to: 'b', code: 'unknownCard' },
    { name: 'a location that is not connected', enemyId: 'h', to: 'd', code: 'hunterCannotMove' },
  ])('rejects moving $name', ({ enemyId, to, code }) => {
    const state = layout();

    const rejection = rejectionOf(() =>
      execute(ctx, state, { type: 'MoveHunter', enemyId: instanceId(enemyId), to: instanceId(to) }),
    );

    expect(rejection.code).toBe(code);
  });

  it('rejects moving towards an unknown investigator', () => {
    const state = layout();

    const rejection = rejectionOf(() =>
      execute(ctx, state, {
        type: 'MoveHunter',
        enemyId: instanceId('h'),
        towards: investigatorId('nobody'),
      }),
    );

    expect(rejection.code).toBe('unknownInvestigator');
  });

  it('rejects moving towards an investigator the hunter cannot reach', () => {
    const state = started({
      places: ['a', 'b'],
      edges: [],
      investigators: [investigator('alice', 'b')],
      enemies: { h: { code: 'HNT', zone: at('a') } },
    });

    const rejection = rejectionOf(() =>
      execute(ctx, state, { type: 'MoveHunter', enemyId: instanceId('h'), towards: alice }),
    );

    expect(rejection.code).toBe('noRoute');
  });

  it('takes the only step towards an investigator', () => {
    const state = started({
      places: ['a', 'b', 'c'],
      edges: line('a', 'b', 'c'),
      investigators: [investigator('alice', 'c')],
      enemies: { h: { code: 'HNT', zone: at('a') } },
    });

    const { state: after } = execute(ctx, state, {
      type: 'MoveHunter',
      enemyId: instanceId('h'),
      towards: alice,
    });

    expect(zoneOf(after, 'h')).toEqual(at('b'));
  });
});

/** Steps from `from` to the nearest investigator; infinite if none can be reached. */
function distanceToNearestInvestigator(state: GameState, from: InstanceId): number {
  const distances = state.investigators.flatMap(({ locationId }) => {
    const [path] = locationId === undefined ? [] : shortestPaths(state, from, locationId);
    return path ? [path.length - 1] : [];
  });
  return Math.min(...distances);
}

describe('MoveHunters invariants', () => {
  const layouts: (Omit<Layout, 'enemies'> & { name: string })[] = [
    {
      name: 'a line',
      places: ['a', 'b', 'c', 'd'],
      edges: line('a', 'b', 'c', 'd'),
      investigators: [investigator('alice', 'd')],
    },
    {
      name: 'a cycle with two investigators',
      places: ['a', 'b', 'c', 'd'],
      edges: [...line('a', 'b', 'c', 'd'), edge('d', 'a')],
      investigators: [investigator('alice', 'b'), investigator('bob', 'c')],
    },
    {
      name: 'a one-way shortcut',
      places: ['a', 'b', 'c', 'd'],
      edges: [...line('a', 'b', 'c', 'd'), edge('a', 'd', { oneWay: true })],
      investigators: [investigator('alice', 'd')],
    },
    {
      name: 'a fork with an unreachable investigator',
      places: ['a', 'b', 'c', 'd', 'e'],
      edges: [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')],
      investigators: [investigator('alice', 'd'), investigator('bob', 'e')],
    },
  ];

  it.each(layouts)(
    'on $name: moved hunters get strictly closer, engaged and exhausted ones stay',
    ({ places, edges, investigators }) => {
      const before = started({
        places,
        edges,
        investigators,
        enemies: {
          ready: { code: 'HNT', zone: at('a') },
          tired: { code: 'HNT', zone: at('a') },
          held: { code: 'HNT', zone: engagedWith(alice) },
          middle: { code: 'HNT', zone: at('b') },
        },
      });
      const exhausted = execute(ctx, before, {
        type: 'ExhaustEnemy',
        enemyId: instanceId('tired'),
      }).state;

      const { state: after } = execute(ctx, exhausted, moveHunters);

      expect(checkInvariants(after)).toEqual([]);
      for (const id of ['tired', 'held']) expect(zoneOf(after, id)).toEqual(zoneOf(exhausted, id));
      for (const id of ['ready', 'middle']) {
        const was = zoneOf(exhausted, id);
        const now = zoneOf(after, id);
        if (was?.kind !== 'atLocation' || now?.kind !== 'atLocation') continue;
        if (now.locationId !== was.locationId)
          expect(distanceToNearestInvestigator(after, now.locationId)).toBeLessThan(
            distanceToNearestInvestigator(exhausted, was.locationId),
          );
      }
    },
  );
});
