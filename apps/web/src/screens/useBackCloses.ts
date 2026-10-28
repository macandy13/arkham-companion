import { useCallback, useEffect, useRef } from 'react';
import { usePhone } from './usePhone';

/**
 * The entry of a card that went while it was open, dropped on the next tick unless the card
 * mounts again at once and takes it back, as development's double effects remount every card.
 */
let dropping: { entry: string; timer: ReturnType<typeof setTimeout> } | undefined;

/**
 * Lets the phone's back gesture close a card opened over the whole screen (M3.14g: the enemy
 * details, a zoomed card), as it closes the detail view (`useDetailView`). On a phone held upright
 * opening pushes a history entry of its own, named by a fresh id, and a back step closes the card
 * (`onClose`). The returned `close`, for the ×, Escape and the card's buttons that close it, steps
 * back through the history once, however often it is tapped before the step lands. A card that
 * goes while it is open (an enemy leaving play) drops its entry, so no back step is left that
 * changes nothing. Elsewhere `close` is `onClose`, since a dialog over the tablet's board is no
 * screen of its own.
 */
export function useBackCloses(onClose: () => void): () => void {
  const phone = usePhone();
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  // The back step lands a moment later, so a second tap before it must not step again.
  const closing = useRef(false);
  useEffect(() => {
    if (!phone) return;
    const top = cardEntryOf(window.history.state);
    let entry: string;
    if (dropping && dropping.entry === top) {
      clearTimeout(dropping.timer);
      dropping = undefined;
      entry = top;
    } else {
      entry = crypto.randomUUID();
      window.history.pushState({ ...asObject(window.history.state), cardView: entry }, '');
    }
    const onBack = () => latest.current();
    window.addEventListener('popstate', onBack);
    return () => {
      window.removeEventListener('popstate', onBack);
      if (closing.current || cardEntryOf(window.history.state) !== entry) return;
      const timer = setTimeout(() => {
        dropping = undefined;
        window.history.back();
      }, 0);
      dropping = { entry, timer };
    };
  }, [phone]);
  return useCallback(() => {
    if (!phone) {
      latest.current();
      return;
    }
    if (closing.current) return;
    closing.current = true;
    window.history.back();
  }, [phone]);
}

/** The id of the card entry a history entry's state is, if it is one. */
function cardEntryOf(state: unknown): string | undefined {
  return typeof state === 'object' &&
    state !== null &&
    'cardView' in state &&
    typeof state.cardView === 'string'
    ? state.cardView
    : undefined;
}

/** The router's state, an object, or nothing to carry on when there is none. */
function asObject(state: unknown): object {
  return typeof state === 'object' && state !== null ? state : {};
}
