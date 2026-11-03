import { investigatorId, type InvestigatorId } from '@arkham/engine';
import type { Point } from '../map/mapLayout';

/**
 * The investigator whose panel (`InvestigatorBar`'s `data-investigator`) lies under the screen
 * point `client`, for a token dropped there from elsewhere on the page, such as a clue dragged off
 * a location on the map. A hit test rather than a drop handler on the panel, since the drag
 * belongs to the element it started on, which keeps the pointer captured.
 */
export function investigatorAt(client: Point): InvestigatorId | undefined {
  const panel = document
    .elementFromPoint(client.x, client.y)
    ?.closest<HTMLElement>('[data-investigator]');
  const id = panel?.dataset['investigator'];
  return id === undefined ? undefined : investigatorId(id);
}
