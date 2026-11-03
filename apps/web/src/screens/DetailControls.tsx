import { useLayoutEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { assertNever, range } from '@arkham/util';
import type { DetailTarget } from './useDetailView';

/** Which card or panel of the shown row the players see, of how many it snaps between. */
interface RowPosition {
  item: number;
  items: number;
}

/** The part of the board (`#board > …`) each row of a `DetailTarget` is. */
const ROWS = {
  cards: ':scope > header',
  map: ':scope > #map',
  investigators: ':scope > #investigators',
} as const;

/**
 * The detail view's controls over the board (`board`, the `#board` element), whose stylesheet
 * shows the `target`'s row: the header in place, its places (its four cards and the victory
 * display) snapped sideways over the shrunk map, or the map or the investigator panels on the
 * whole screen. The controls are the button that closes it (`onClose`) and a dot per card or panel
 * of the row, the current one filled. As it opens it scrolls the row to the target's card or panel.
 * The dots only show where the players are, so screen readers skip them.
 */
export function DetailControls({
  board,
  target,
  onClose,
}: {
  board: RefObject<HTMLElement | null>;
  target: DetailTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const position = useRowScroll(board, target);
  return (
    <>
      <button
        type="button"
        data-icon="close"
        data-detail="close"
        aria-label={t('detail.close')}
        onClick={onClose}
      />
      {position.items > 1 && (
        <ol aria-hidden="true" data-dots="items">
          {range(position.items).map((item) => (
            <li key={item} data-current={item === position.item || undefined} />
          ))}
        </ol>
      )}
    </>
  );
}

/**
 * Scrolls the target's row to its card or panel as the view opens, then follows the players'
 * sideways swipes. The map row has nothing to swipe between.
 */
function useRowScroll(board: RefObject<HTMLElement | null>, target: DetailTarget): RowPosition {
  const [position, setPosition] = useState<RowPosition>({ item: 0, items: 0 });
  useLayoutEffect(() => {
    const row = board.current?.querySelector<HTMLElement>(ROWS[target.row]);
    const selector = itemOf(target);
    if (!row || selector === undefined) return;
    const follow = () => {
      const next = positionOf(row);
      setPosition((last) => (last.item === next.item && last.items === next.items ? last : next));
    };
    row
      .querySelector<HTMLElement>(selector)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'start' });
    // Scrolling to where the row already is fires no event, so the dots read it once as well.
    const first = requestAnimationFrame(follow);
    row.addEventListener('scroll', follow, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      row.removeEventListener('scroll', follow);
    };
  }, [board, target]);
  // The map row keeps no dots, whatever the last row it followed showed.
  return itemOf(target) === undefined ? { item: 0, items: 0 } : position;
}

/** The card or panel of its row a target shows, as a selector within the row; the map has none. */
function itemOf(target: DetailTarget): string | undefined {
  switch (target.row) {
    case 'cards':
      return `:scope > [data-slot='${target.card}']`;
    case 'map':
      return undefined;
    case 'investigators':
      return `:scope > [data-investigator='${target.investigator}']`;
    default:
      return assertNever(target);
  }
}

/** The card or panel of a row the players see now, by how far the row is scrolled. */
function positionOf(row: HTMLElement): RowPosition {
  const items = row.querySelectorAll(':scope > section:not([data-pool])').length;
  const item = row.clientWidth > 0 ? Math.round(row.scrollLeft / row.clientWidth) : 0;
  return { item, items };
}
