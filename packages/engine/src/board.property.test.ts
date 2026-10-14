import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  neighbours,
  sameEdge,
  shortestPaths,
  type Edge,
  type GameState,
  type InstanceId,
  type MapId,
  type StartScenario,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const LOCATION_COUNT = 6;
const ids = Array.from({ length: LOCATION_COUNT }, (_, i) => instanceId(`loc${i}`));
const maps = [mapId('m1'), mapId('m2')];

interface Graph {
  /** Map of each location, or undefined if it is still set aside. */
  zones: (MapId | undefined)[];
  edges: Edge[];
}

const edgeArb: fc.Arbitrary<Edge> = fc
  .record({
    from: fc.constantFrom(...ids),
    to: fc.constantFrom(...ids),
    oneWay: fc.boolean(),
  })
  .filter((edge) => edge.from !== edge.to);

/** Random graphs with one-way and undirected edges; locations are on two maps or set aside. */
const graphArb: fc.Arbitrary<Graph> = fc.record({
  zones: fc.array(fc.constantFrom<MapId | undefined>(...maps, undefined), {
    minLength: LOCATION_COUNT,
    maxLength: LOCATION_COUNT,
  }),
  edges: fc
    .array(edgeArb, { maxLength: 14 })
    .map((edges) =>
      edges.filter((edge, i) => !edges.slice(0, i).some((earlier) => sameEdge(earlier, edge))),
    ),
});

function stateOf(graph: Graph): GameState {
  const start: StartScenario = {
    type: 'StartScenario',
    scenarioId: 'graph',
    difficulty: 'standard',
    seed: 1,
    investigators: [
      {
        id: investigatorId('a'),
        code: 'inv',
        name: 'A',
        seat: 0,
        health: { max: 8, damage: 0 },
        sanity: { max: 8, horror: 0 },
        clues: 0,
        resources: 0,
        status: 'active',
      },
    ],
    maps: Object.fromEntries(maps.map((m) => [m, { name: m }])),
    cards: graph.zones.map((zoneMap, i) => ({
      id: ids[i]!,
      code: 'L1',
      zone: zoneMap ? { kind: 'location', mapId: zoneMap } : { kind: 'setAside' },
    })),
    connections: graph.edges,
  };
  return execute(sandboxContext, emptyState(), start).state;
}

/** Every simple path from `path[0]` to `to` with exactly `length` steps, found by brute force. */
function simplePaths(
  state: GameState,
  path: InstanceId[],
  to: InstanceId,
  length: number,
): InstanceId[][] {
  // Locations that are not on a map are not part of the graph, not even as a one-node path.
  if (state.cards[path[0]!]?.zone.kind !== 'location') return [];
  const last = path[path.length - 1]!;
  if (path.length - 1 === length) return last === to ? [path] : [];
  return neighbours(state, last)
    .filter((next) => !path.includes(next))
    .flatMap((next) => simplePaths(state, [...path, next], to, length));
}

describe('connection graph properties', () => {
  it('shortestPaths returns every shortest path, each a valid path of equal minimal length', () => {
    fc.assert(
      fc.property(graphArb, fc.constantFrom(...ids), fc.constantFrom(...ids), (graph, from, to) => {
        const state = stateOf(graph);

        const paths = shortestPaths(state, from, to);

        for (const path of paths) {
          expect(path[0]).toBe(from);
          expect(path[path.length - 1]).toBe(to);
          for (let i = 1; i < path.length; i++)
            expect(neighbours(state, path[i - 1]!)).toContain(path[i]);
        }
        // Brute force: nothing shorter exists, and every path of the minimal length was found.
        const shortest = paths[0]?.length;
        for (let length = 0; length < LOCATION_COUNT; length++) {
          const expected = simplePaths(state, [from], to, length);
          if (shortest !== undefined && length === shortest - 1) expect(paths).toEqual(expected);
          else if (shortest === undefined || length < shortest - 1) expect(expected).toEqual([]);
        }
      }),
    );
  });

  it('neighbours only lists locations that are on a map, and respects direction', () => {
    fc.assert(
      fc.property(graphArb, fc.constantFrom(...ids), (graph, from) => {
        const state = stateOf(graph);

        for (const to of neighbours(state, from)) {
          expect(state.cards[from]?.zone.kind).toBe('location');
          expect(state.cards[to]?.zone.kind).toBe('location');
          const usable = graph.edges.some(
            (edge) =>
              (edge.from === from && edge.to === to) ||
              (!edge.oneWay && edge.from === to && edge.to === from),
          );
          expect(usable).toBe(true);
        }
      }),
    );
  });

  it('the graph keeps its invariants', () => {
    fc.assert(
      fc.property(graphArb, (graph) => {
        expect(checkInvariants(stateOf(graph))).toEqual([]);
      }),
    );
  });
});
