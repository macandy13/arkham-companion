import type { Point } from '../map/mapLayout';

/**
 * Whether the header's act (its place, `HeaderSlot`'s `data-slot='act'`) lies under the screen
 * point `client`, for a clue dropped on it from an investigator's card. A hit test, like the map's
 * `locationAt`, since the drag belongs to the counter it started on.
 */
export function overAct(client: Point): boolean {
  return Boolean(document.elementFromPoint(client.x, client.y)?.closest('[data-slot="act"]'));
}
