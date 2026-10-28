import { useCallback, useEffect, useRef } from 'react';
import { usePhone } from './usePhone';

/**
 * Lets the phone's back gesture close a card opened over the whole screen (M3.14g: the enemy
 * details, a zoomed card), as it closes the detail view (`useDetailView`). On a phone held upright
 * opening pushes a history entry and a back step closes the card (`onClose`); the returned `close`,
 * for the × and Escape, steps back through the history, so the entry goes with the card. Elsewhere
 * `close` is `onClose`, since a dialog over the tablet's board is no screen of its own.
 *
 * A card's own buttons that close it (a fight closes the enemy's) use `close` too. A card that goes
 * while it is open (an enemy leaving play) leaves its entry behind, and the next back step only
 * lands on the screen under it: the entry can only be removed by stepping back, which arrives
 * later than the card's unmount, after a remount in development's double effects would already
 * have taken the entry for its own.
 */
export function useBackCloses(onClose: () => void): () => void {
  const phone = usePhone();
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!phone) return;
    if (!isCardEntry(window.history.state)) {
      window.history.pushState({ ...asObject(window.history.state), cardView: true }, '');
    }
    const onBack = () => latest.current();
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [phone]);
  return useCallback(() => {
    if (phone && isCardEntry(window.history.state)) window.history.back();
    else latest.current();
  }, [phone]);
}

/** Whether a history entry's state is the one a card opened over the screen pushed. */
function isCardEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'cardView' in state;
}

/** The router's state, an object, or nothing to carry on when there is none. */
function asObject(state: unknown): object {
  return typeof state === 'object' && state !== null ? state : {};
}
