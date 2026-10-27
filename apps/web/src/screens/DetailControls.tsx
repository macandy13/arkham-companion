import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { range } from '@arkham/util';
import type { DetailTarget } from './useDetailView';

/** Where the detail view is scrolled to: its row, and the card or panel within that row. */
interface DetailPosition {
  row: number;
  item: number;
  /** How many cards or panels the row snaps between; the map row has none. */
  items: number;
}

/** The rows of the detail view from the top, each a part of the board (`#board > …`). */
const ROWS = [':scope > header', ':scope > #map', ':scope > #investigators'] as const;

/**
 * The detail view's controls over the board (`board`, the `#board` element), which the stylesheet
 * turns into three rows snapped vertically, the header's places (its four cards and the victory
 * display) and the investigator panels each snapped sideways: the × that closes it (`onClose`), a
 * dot per row at the right edge and a dot per card or panel of the current row along the foot, the
 * current one filled. As it opens it scrolls to its `target`; once the players leave the cards
 * row, the row goes back to the agenda, so it opens there again. The dots only show where the
 * players are, so screen readers skip them.
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
  const position = useDetailScroll(board, target);
  return (
    <>
      <button
        type="button"
        data-icon="close"
        data-detail="close"
        aria-label={t('detail.close')}
        onClick={onClose}
      />
      <ol aria-hidden="true" data-dots="rows">
        {range(ROWS.length).map((row) => (
          <li key={row} data-current={row === position.row || undefined} />
        ))}
      </ol>
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
 * Scrolls the board to `target` as the view opens, then follows the players' swipes: the scroll
 * events of the board and its rows reach the board in their capture phase, since they do not
 * bubble.
 */
function useDetailScroll(
  board: RefObject<HTMLElement | null>,
  target: DetailTarget,
): DetailPosition {
  const [position, setPosition] = useState<DetailPosition>({ row: 0, item: 0, items: 0 });
  const lastRow = useRef(0);
  useLayoutEffect(() => {
    const element = board.current;
    if (!element) return;
    const follow = () => {
      const next = positionOf(element);
      if (lastRow.current === 0 && next.row !== 0) backToAgenda(element);
      lastRow.current = next.row;
      setPosition((last) =>
        last.row === next.row && last.item === next.item && last.items === next.items ? last : next,
      );
    };
    const row = element.querySelector<HTMLElement>(ROWS[ROW_INDEX[target.row]]);
    const selector = itemOf(target);
    const item = selector === undefined ? undefined : row?.querySelector<HTMLElement>(selector);
    row?.scrollIntoView?.({ block: 'start' });
    item?.scrollIntoView?.({ block: 'nearest', inline: 'start' });
    // Scrolling to where the board already is fires no event, so the dots read it once as well.
    const first = requestAnimationFrame(follow);
    element.addEventListener('scroll', follow, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(first);
      element.removeEventListener('scroll', follow, { capture: true });
    };
  }, [board, target]);
  return position;
}

/** Where each row of a `DetailTarget` stands in `ROWS`. */
const ROW_INDEX = { cards: 0, map: 1, investigators: 2 } as const;

/** The card or panel of its row a target shows, as a selector within the row; the map has none. */
function itemOf(target: DetailTarget): string | undefined {
  if (target.row === 'cards') return `:scope > [data-slot='${target.card}']`;
  if (target.row === 'investigators')
    return `:scope > [data-investigator='${target.investigator}']`;
  return undefined;
}

/** The row and the card or panel of the board the players see now, by how far each is scrolled. */
function positionOf(board: HTMLElement): DetailPosition {
  const row = board.clientHeight > 0 ? Math.round(board.scrollTop / board.clientHeight) : 0;
  const rowElement = board.querySelector<HTMLElement>(ROWS[row] ?? ROWS[0]);
  const items = rowElement?.querySelectorAll(':scope > section').length ?? 0;
  const item =
    rowElement && rowElement.clientWidth > 0
      ? Math.round(rowElement.scrollLeft / rowElement.clientWidth)
      : 0;
  return { row, item, items: row === 1 ? 0 : items };
}

/** Scrolls the cards row back to the agenda, where it opens. */
function backToAgenda(board: HTMLElement): void {
  const header = board.querySelector<HTMLElement>(ROWS[0]);
  const agenda = header?.querySelector<HTMLElement>(":scope > [data-slot='agenda']");
  if (!header || !agenda) return;
  header.scrollLeft += agenda.getBoundingClientRect().left - header.getBoundingClientRect().left;
}
