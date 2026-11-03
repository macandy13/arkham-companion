import type { BoardView } from '@arkham/engine';
import type { DetailTarget, HeaderCardKind } from './useDetailView';
import type { SwipeDirection } from './useVerticalSwipe';

/** The header cards a swipe can expand the header on, by their places' `data-slot`. */
const HEADER_CARDS: readonly HeaderCardKind[] = ['encounter', 'agenda', 'act', 'scenario'];

/**
 * What a vertical swipe on the phone's board does (M3.15c), from the element it started `on` and
 * the part the detail view shows now (`shown`): down on the compact header expands it on the card
 * under the finger (else the agenda), up on the compact investigators expands their bar on the
 * panel under it (else the one the phone shows, `data-focus`). The opposite swipe on an expanded
 * part folds it (`'close'`), unless the investigators were scrolled down, where a swipe down
 * scrolls them back first. Anything else does nothing.
 */
export function swipeAction(
  direction: SwipeDirection,
  on: Element,
  shown: DetailTarget['row'] | undefined,
  board: BoardView,
): DetailTarget | 'close' | undefined {
  const part = on.closest('#board > header, #board > #investigators');
  if (part?.matches('header')) {
    if (direction === 'up') return shown === 'cards' ? 'close' : undefined;
    if (shown === 'cards') return undefined;
    const slot = on.closest('[data-slot]')?.getAttribute('data-slot');
    const card = HEADER_CARDS.find((kind) => kind === slot) ?? 'agenda';
    return { row: 'cards', card };
  }
  if (part) {
    if (direction === 'down')
      return shown === 'investigators' && part.scrollTop === 0 ? 'close' : undefined;
    if (shown === 'investigators') return undefined;
    const id =
      on.closest('[data-investigator]')?.getAttribute('data-investigator') ??
      part.querySelector('[data-focus]')?.getAttribute('data-investigator');
    const investigator = board.investigators.find((candidate) => candidate.id === id);
    return investigator && { row: 'investigators', investigator: investigator.id };
  }
  return undefined;
}
