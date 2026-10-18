import { instanceId, type Edge } from '../../src/index';

/** An undirected edge between two instance IDs, or a one-way one with `oneWay`. */
export function edge(from: string, to: string, { oneWay = false } = {}): Edge {
  return { from: instanceId(from), to: instanceId(to), oneWay };
}
