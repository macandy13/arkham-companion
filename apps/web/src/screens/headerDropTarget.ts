import type { Point } from '../map/mapLayout';

/**
 * Whether the header's agenda or act (`card`, the place `HeaderSlot` marks `data-slot`) lies under
 * the screen point `client`, for a token dropped on it: a clue from an investigator's card on the
 * act, doom from a location back on the agenda. A hit test, like the map's `locationAt`, since the
 * drag belongs to the counter it started on.
 */
export function overHeaderCard(card: 'agenda' | 'act', client: Point): boolean {
  return Boolean(document.elementFromPoint(client.x, client.y)?.closest(`[data-slot="${card}"]`));
}

/**
 * Whether the header's token pool (`TokenPool`'s `data-pool`) lies under the screen point `client`,
 * for a token dragged off the map back to the pool. A hit test, like `overHeaderCard`.
 */
export function overTokenPool(client: Point): boolean {
  return Boolean(document.elementFromPoint(client.x, client.y)?.closest('[data-pool]'));
}
