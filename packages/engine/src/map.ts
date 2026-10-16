import type { InstanceId, MapId } from './ids';
import type { GameState } from './state';
import { zoneKey } from './zone';

/** A connection between two location instances of one `GameMap`. */
export interface Edge {
  from: InstanceId;
  to: InstanceId;
  /** One-way edges only allow movement from `from` to `to`. */
  oneWay: boolean;
}

/**
 * One map of the board (architecture "Game state"): a set of locations and
 * the connections between them, kept together so a map is set up, changed
 * and drawn as one unit. A scenario can have several (`Board.maps`).
 *
 * This is the map "class": plain data plus the pure functions in this module
 * instead of an object with methods. The state is event-sourced, saved as
 * JSON and compared structurally on replay, so it must not hold class
 * instances (they would lose their prototype when a game is loaded).
 *
 * The locations are the cards whose zone is `{ kind: 'location', mapId }`;
 * `mapLocations` lists them. Membership is deliberately not copied into the
 * map, so a card's zone stays the only record of where it is.
 */
export interface GameMap {
  name: string;
  visible: boolean;
  /** Connections between locations of this map. */
  connections: Edge[];
}

/** A map as `StartScenario` declares it; `createMap` fills in the defaults. */
export interface MapSpec {
  name: string;
  /** Default true; a hidden map is an area the players cannot see yet. */
  visible?: boolean;
  connections?: readonly Edge[];
}

/** The `GameMap` for a spec: visible and unconnected unless the spec says otherwise. */
export function createMap(spec: MapSpec): GameMap {
  return {
    name: spec.name,
    visible: spec.visible ?? true,
    connections: [...(spec.connections ?? [])],
  };
}

/** IDs of the locations on map `mapId`, in zone order (empty for an unknown map). */
export function mapLocations(state: GameState, mapId: MapId): readonly InstanceId[] {
  return state.order[zoneKey({ kind: 'location', mapId })] ?? [];
}
