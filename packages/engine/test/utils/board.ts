import {
  instanceId,
  mapId,
  type Edge,
  type EngineContext,
  type GameState,
  type MapSpec,
  type StartScenario,
} from '../../src/index';
import { investigators } from './investigators';
import { run } from './scenario';

/** One map of a `startBoard` fixture. */
export interface BoardMapOptions {
  /** Locations on the map: instance ID to card code (use `L*` codes from `testCardDefs`). */
  locations: Readonly<Record<string, string>>;
  /** Edges owned by this map; they may end on other maps' locations. */
  connections?: readonly Edge[];
  visible?: boolean;
}

/** What `startBoard` builds; everything else is a standard start with the first investigators. */
export interface BoardOptions {
  /** Maps by ID. */
  maps: Readonly<Record<string, BoardMapOptions>>;
  /** Cards that start set aside: instance ID to card code. */
  setAside?: Readonly<Record<string, string>>;
  playerCount?: number;
}

/**
 * The state after starting a scenario that consists only of the given maps,
 * their locations (unrevealed) and set-aside cards. For tests about the
 * connection graph and locations; instance IDs are exactly the keys given.
 */
export function startBoard(
  ctx: EngineContext,
  { maps, setAside = {}, playerCount = 1 }: BoardOptions,
): GameState {
  const specs: Record<string, MapSpec> = {};
  const cards: StartScenario['cards'] = [];
  for (const [id, map] of Object.entries(maps)) {
    specs[mapId(id)] = {
      name: id,
      ...(map.visible === undefined ? {} : { visible: map.visible }),
      ...(map.connections ? { connections: map.connections } : {}),
    };
    for (const [location, code] of Object.entries(map.locations))
      cards.push({ id: instanceId(location), code, zone: { kind: 'location', mapId: mapId(id) } });
  }
  for (const [id, code] of Object.entries(setAside))
    cards.push({ id: instanceId(id), code, zone: { kind: 'setAside' } });
  const start: StartScenario = {
    type: 'StartScenario',
    scenarioId: 'test',
    difficulty: 'standard',
    seed: 1,
    investigators: investigators(playerCount),
    maps: specs,
    cards,
  };
  return run(ctx, [start]).state;
}

/** An undirected edge between two instance IDs, or a one-way one with `oneWay`. */
export function edge(from: string, to: string, { oneWay = false } = {}): Edge {
  return { from: instanceId(from), to: instanceId(to), oneWay };
}
