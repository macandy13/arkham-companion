import { instanceId, type InstanceId } from '@arkham/engine';
import type { Point } from './mapLayout';

/**
 * The location whose tile (`LocationTile`'s `data-location`) lies under the screen point `client`,
 * for a token dropped on the map from elsewhere on the page, such as a clue an investigator places
 * on their location. A hit test, like `investigatorAt`, since the drag belongs to the counter it
 * started on, which keeps the pointer captured.
 */
export function locationAt(client: Point): InstanceId | undefined {
  const tile = document
    .elementFromPoint(client.x, client.y)
    ?.closest<SVGElement>('[data-location]');
  const id = tile?.dataset['location'];
  return id === undefined ? undefined : instanceId(id);
}
