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
 * A location's cell in its map's book layout (the scenario guide's grid): columns count to the
 * right and rows downwards, both from 0. Only the screen reads it; rules go by connections.
 */
export interface GridCell {
  column: number;
  row: number;
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
  /**
   * Where the book layout draws each location of this map. A location without a cell has no
   * book position (the screen places it itself); a cell whose location has left play is ignored.
   */
  layout: Record<InstanceId, GridCell>;
}

/** A map as `StartScenario` declares it; `createMap` fills in the defaults. */
export interface MapSpec {
  name: string;
  /** Default true; a hidden map is an area the players cannot see yet. */
  visible?: boolean;
  connections?: readonly Edge[];
  layout?: Readonly<Record<InstanceId, GridCell>>;
}

/** The `GameMap` for a spec: visible, unconnected and without a layout unless the spec says otherwise. */
export function createMap(spec: MapSpec): GameMap {
  return {
    name: spec.name,
    visible: spec.visible ?? true,
    connections: [...(spec.connections ?? [])],
    layout: { ...spec.layout },
  };
}

/** IDs of the locations on map `mapId`, in zone order (empty for an unknown map). */
export function mapLocations(state: GameState, mapId: MapId): readonly InstanceId[] {
  return state.order[zoneKey({ kind: 'location', mapId })] ?? [];
}
