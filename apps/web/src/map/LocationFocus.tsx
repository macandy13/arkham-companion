import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, LocationView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { LocationContent } from './LocationDetails';

/**
 * The phone's location mode (M3.14e): one location in the detail view's map row, in place of the
 * whole map, with the same content as the location details dialog (`LocationContent`) and a Map
 * button that brings the whole map back (`onMap`). It stays on the location after a move or an
 * investigation, since the players look at the row, not a window over it; a decision that follows
 * opens as its own dialog.
 */
export function LocationFocus({
  board,
  location,
  actions,
  busy,
  adjusting,
  onMap,
}: {
  board: BoardView;
  location: LocationView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onMap: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-mode="location">
      <LocationContent
        board={board}
        location={location}
        actions={actions}
        busy={busy}
        adjusting={adjusting}
        titleId={titleId}
      />
      <button type="button" onClick={onMap}>
        {t('detail.showMap')}
      </button>
    </section>
  );
}
