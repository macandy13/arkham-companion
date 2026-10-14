import type { InstanceId, MapId } from './ids';
import type { Edge, GameMap } from './map';
import type { GameState } from './state';

/**
 * True if both edges are the same connection: an undirected edge matches in
 * either direction, a one-way edge only exactly, and the two kinds never match.
 */
export function sameEdge(a: Edge, b: Edge): boolean {
  if (a.oneWay !== b.oneWay) return false;
  if (a.from === b.from && a.to === b.to) return true;
  return !a.oneWay && a.from === b.to && a.to === b.from;
}

/** Every connection on the board with the map that owns it, in map order. */
export function allConnections(state: GameState): { mapId: MapId; edge: Edge }[] {
  return (Object.entries(state.board.maps) as [MapId, GameMap][]).flatMap(([mapId, map]) =>
    map.connections.map((edge) => ({ mapId, edge })),
  );
}

/**
 * Locations an investigator or enemy at `locationId` can move to in one step,
 * in the order the edges were added. An edge only counts while both of its
 * locations are on a map (zone `location`): scenario data may connect locations
 * that are still set aside, and these connections wake up once both are in play.
 * Edges may cross maps: every map's edges count, wherever their ends are.
 */
export function neighbours(state: GameState, locationId: InstanceId): InstanceId[] {
  if (!isLocationInPlay(state, locationId)) return [];
  const result = new Set<InstanceId>();
  for (const { edge } of allConnections(state)) {
    if (!isLocationInPlay(state, edge.from) || !isLocationInPlay(state, edge.to)) continue;
    if (edge.from === locationId) result.add(edge.to);
    else if (!edge.oneWay && edge.to === locationId) result.add(edge.from);
  }
  return [...result];
}

/**
 * Every shortest path from `from` to `to` over `neighbours`, each including both
 * ends. `[[from]]` when they are the same location, `[]` when `to` cannot be
 * reached. Hunter enemies and movement need all of them because ties are
 * resolved by the players, never guessed by the engine.
 */
export function shortestPaths(state: GameState, from: InstanceId, to: InstanceId): InstanceId[][] {
  if (!isLocationInPlay(state, from) || !isLocationInPlay(state, to)) return [];
  return pathsBack(shortestPathPredecessors(state, from, to), from, to);
}

/**
 * Whether the card is a location currently on a map. Named for locations
 * because "in play" is a broader game-rule notion (any card in a play area).
 */
export function isLocationInPlay(state: GameState, id: InstanceId): boolean {
  return state.cards[id]?.zone.kind === 'location';
}

/**
 * Breadth-first search from `from`, stopping after the level that reaches `to`.
 * Maps each visited location to all its neighbours one step closer to `from`.
 */
function shortestPathPredecessors(
  state: GameState,
  from: InstanceId,
  to: InstanceId,
): Map<InstanceId, InstanceId[]> {
  const predecessors = new Map<InstanceId, InstanceId[]>([[from, []]]);
  let frontier = [from];
  while (frontier.length > 0 && !predecessors.has(to)) {
    const next: InstanceId[] = [];
    for (const current of frontier) {
      for (const neighbour of neighbours(state, current)) {
        const known = predecessors.get(neighbour);
        if (known === undefined) {
          predecessors.set(neighbour, [current]);
          next.push(neighbour);
        } else if (next.includes(neighbour)) {
          // Discovered earlier on this same level, so this is an equally short route.
          known.push(current);
        }
      }
    }
    frontier = next;
  }
  return predecessors;
}

/** Expands the predecessor map into the paths ending at `to`. */
function pathsBack(
  predecessors: ReadonlyMap<InstanceId, InstanceId[]>,
  from: InstanceId,
  to: InstanceId,
): InstanceId[][] {
  if (!predecessors.has(to)) return [];
  if (to === from) return [[from]];
  return (predecessors.get(to) ?? []).flatMap((previous) =>
    pathsBack(predecessors, from, previous).map((path) => [...path, to]),
  );
}
