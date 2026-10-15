import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  execute,
  instanceId,
  investigatorId,
  type Command,
  type Edge,
  type GameState,
  type InstanceId,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  makeCard,
  makeInvestigator,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');

const hunter = instanceId('hunter');

/**
 * The cards of these tests: locations (named by letter in the map diagrams of
 * each test), a plain hunter, a hunter whose prey is "Most clues", an aloof
 * hunter and a ghoul without the hunter keyword.
 */
const ctx = contextWith(
  makeCard({ code: 'location', typeCode: 'location' }),
  makeCard({ code: 'hunter_ghoul', typeCode: 'enemy', keywords: [{ name: 'hunter' }] }),
  makeCard({
    code: 'most_clues_prey_hunter',
    typeCode: 'enemy',
    keywords: [{ name: 'hunter' }, { name: 'prey', detail: 'Most clues' }],
  }),
  makeCard({
    code: 'aloof_hunter',
    typeCode: 'enemy',
    keywords: [{ name: 'hunter' }, { name: 'aloof' }],
  }),
  makeCard({ code: 'plain_ghoul', typeCode: 'enemy' }),
);

/** A card to create: `id` is how the test refers to it, `code` says what it is. */
function enemy(id: InstanceId, code: string, zone: Zone): StartingCard {
  return { id, code, zone };
}

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
  enemies: StartingCard[];
}

function started({ places, edges, investigators, enemies }: Layout): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: Object.fromEntries(places.map((place) => [place, 'location'])),
        connections: edges,
      },
    },
    investigators,
    cards: enemies,
  });
}

const zoneOf = (state: GameState, cardId: InstanceId): Zone | undefined =>
  state.cards[cardId]?.zone;

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
      enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
    });

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  it.each([
    {
      name: 'engages the investigator when it arrives',
      code: 'hunter_ghoul',
      zone: engagedWith(alice),
    },
    { name: 'does not engage an aloof hunter on arrival', code: 'aloof_hunter', zone: at('b') },
  ])('$name', ({ code, zone }) => {
    const state = started({
      places: ['a', 'b'],
      edges: line('a', 'b'),
      investigators: [investigator('alice', 'b')],
      enemies: [enemy(hunter, code, at('a'))],
    });

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(zone);
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
      enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
    });

    expect(execute(ctx, state, moveHunters).events).toEqual([]);
  });

  it('does not move exhausted, engaged or non-hunter enemies', () => {
    const state = started({
      places: ['a', 'b', 'c'],
      edges: line('a', 'b', 'c'),
      investigators: [investigator('alice', 'c')],
      enemies: [
        enemy(instanceId('tired_hunter'), 'hunter_ghoul', at('a')),
        enemy(instanceId('engaged_hunter'), 'hunter_ghoul', engagedWith(alice)),
        enemy(instanceId('plain_ghoul'), 'plain_ghoul', at('a')),
      ],
    });
    const exhausted = stateAfter(ctx, state, {
      type: 'ExhaustEnemy',
      enemyId: instanceId('tired_hunter'),
    });

    expect(execute(ctx, exhausted, moveHunters).events).toEqual([]);
  });

  it('heads for the nearest investigator', () => {
    const state = started({
      places: ['x', 'far', 'a', 'near'],
      edges: line('x', 'far', 'a', 'near'),
      investigators: [investigator('alice', 'x'), investigator('bob', 'near')],
      enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
    });

    const { state: after } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
  });

  it('moves the same way when equally near investigators share the first step', () => {
    const state = started({
      places: ['a', 'b', 'c', 'd'],
      edges: [edge('a', 'b'), edge('b', 'c'), edge('b', 'd')],
      investigators: [investigator('alice', 'c'), investigator('bob', 'd')],
      enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
    });

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  describe('ties', () => {
    it('asks for the destination when two shortest paths differ', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd')],
        enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(zoneOf(after, hunter)).toEqual(at('a'));
      expect(after.pending).toMatchObject([
        { kind: 'chooseLocation', subject: hunter, options: [{ target: 'b' }, { target: 'c' }] },
      ]);
    });

    it('does not ask again while the question is open', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd')],
        enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
      });
      const asked = execute(ctx, state, moveHunters).state;

      expect(execute(ctx, asked, moveHunters).events).toEqual([]);
    });

    it('asks which investigator to hunt when equally near investigators lead apart', () => {
      const state = started({
        places: ['a', 'b', 'c'],
        edges: [edge('a', 'b'), edge('a', 'c')],
        investigators: [investigator('alice', 'b'), investigator('bob', 'c')],
        enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(after.pending).toMatchObject([
        {
          kind: 'chooseInvestigator',
          subject: hunter,
          options: [{ target: alice }, { target: bob }],
        },
      ]);
    });

    it('lets prey pick between equally near investigators', () => {
      const state = started({
        places: ['a', 'b', 'c'],
        edges: [edge('a', 'b'), edge('a', 'c')],
        investigators: [investigator('alice', 'b', 1), investigator('bob', 'c', 2)],
        enemies: [enemy(hunter, 'most_clues_prey_hunter', at('a'))],
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
    });

    it('asks for the destination after prey picked one investigator with two routes', () => {
      const state = started({
        ...fork,
        investigators: [investigator('alice', 'd', 1), investigator('bob', 'd', 1)],
        enemies: [enemy(hunter, 'most_clues_prey_hunter', at('a'))],
      });

      const { state: after } = execute(ctx, state, moveHunters);

      expect(after.pending).toMatchObject([{ kind: 'chooseLocation', subject: hunter }]);
    });
  });
});

describe('MoveHunters order', () => {
  const first = instanceId('first_hunter');
  const second = instanceId('second_hunter');
  /** a - b - c with alice at c: a hunter at a and one at b both have a step to take. */
  const twoHunters = () =>
    started({
      places: ['a', 'b', 'c'],
      edges: line('a', 'b', 'c'),
      investigators: [investigator('alice', 'c')],
      enemies: [enemy(first, 'hunter_ghoul', at('a')), enemy(second, 'hunter_ghoul', at('b'))],
    });

  it('asks the lead investigator for the order when two hunters would move, and moves none', () => {
    const state = twoHunters();

    const { state: after, events } = execute(ctx, state, moveHunters);

    expect(events.map((e) => e.type)).toEqual(['DecisionRequested']);
    expect(after.pending).toMatchObject([
      {
        id: 'hunterOrder',
        kind: 'chooseCard',
        decider: { kind: 'lead' },
        options: [
          { id: first, target: first },
          { id: second, target: second },
        ],
      },
    ]);
    expect(zoneOf(after, first)).toEqual(at('a'));
    expect(zoneOf(after, second)).toEqual(at('b'));
  });

  it('does not ask again while the order question is open', () => {
    const asked = stateAfter(ctx, twoHunters(), moveHunters);

    expect(execute(ctx, asked, moveHunters).events).toEqual([]);
  });

  it('moves a single hunter directly when no other hunter would move', () => {
    const state = started({
      places: ['a', 'b', 'c'],
      edges: line('a', 'b', 'c'),
      investigators: [investigator('alice', 'c')],
      enemies: [
        enemy(first, 'hunter_ghoul', at('a')),
        enemy(second, 'hunter_ghoul', engagedWith(alice)),
      ],
    });

    const after = stateAfter(ctx, state, moveHunters);

    expect(zoneOf(after, first)).toEqual(at('b'));
    expect(after.pending).toEqual([]);
  });

  it('skips a hunter that has an open decision about itself', () => {
    const forked = instanceId('forked_hunter');
    const lone = instanceId('lone_hunter');
    const state = started({
      ...fork,
      investigators: [investigator('alice', 'd')],
      enemies: [enemy(forked, 'hunter_ghoul', at('a')), enemy(lone, 'hunter_ghoul', at('b'))],
    });
    const loneExhausted = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: lone });
    const forkedAsked = stateAfter(ctx, loneExhausted, moveHunters);
    const loneReady = stateAfter(ctx, forkedAsked, { type: 'ReadyEnemy', enemyId: lone });

    const after = stateAfter(ctx, loneReady, moveHunters);

    expect(forkedAsked.pending).toMatchObject([{ kind: 'chooseLocation', subject: forked }]);
    expect(zoneOf(after, lone)).toEqual(engagedWith(alice));
    expect(zoneOf(after, forked)).toEqual(at('a'));
    expect(after.pending).toHaveLength(1);
  });

  it('considers only the listed hunters, as the answer to the order question does', () => {
    const state = twoHunters();

    const afterFirst = stateAfter(ctx, state, { type: 'MoveHunters', hunters: [first] });
    const afterBoth = stateAfter(ctx, afterFirst, { type: 'MoveHunters', hunters: [second] });

    expect(zoneOf(afterFirst, first)).toEqual(at('b'));
    expect(zoneOf(afterFirst, second)).toEqual(at('b'));
    expect(zoneOf(afterBoth, first)).toEqual(at('b'));
    expect(zoneOf(afterBoth, second)).toEqual(engagedWith(alice));
  });
});

describe('MoveHunters routes', () => {
  it.each([
    {
      name: 'a line',
      places: ['a', 'b', 'c', 'd'],
      edges: line('a', 'b', 'c', 'd'),
      investigators: [investigator('alice', 'd')],
      zone: at('b'),
    },
    {
      name: 'a cycle where alice is one step away and bob two',
      places: ['a', 'b', 'c', 'd'],
      edges: [...line('a', 'b', 'c', 'd'), edge('d', 'a')],
      investigators: [investigator('alice', 'b'), investigator('bob', 'c')],
      zone: engagedWith(alice),
    },
    {
      name: 'a one-way shortcut from the hunter to alice',
      places: ['a', 'b', 'c', 'd'],
      edges: [...line('a', 'b', 'c', 'd'), edge('a', 'd', { oneWay: true })],
      investigators: [investigator('alice', 'd')],
      zone: engagedWith(alice),
    },
    {
      name: 'a map where bob cannot be reached',
      places: ['a', 'b', 'e'],
      edges: line('a', 'b'),
      investigators: [investigator('alice', 'b'), investigator('bob', 'e')],
      zone: engagedWith(alice),
    },
  ])('on $name the hunter ends at $zone', ({ places, edges, investigators, zone }) => {
    const before = started({
      places,
      edges,
      investigators,
      enemies: [enemy(hunter, 'hunter_ghoul', at('a'))],
    });

    const after = stateAfter(ctx, before, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(zone);
    expect(checkInvariants(after)).toEqual([]);
  });
});
