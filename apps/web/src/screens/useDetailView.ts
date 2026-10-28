import { useCallback, useEffect, useRef, useState } from 'react';
import type { InstanceId, InvestigatorId } from '@arkham/engine';

/** One of the header's four cards, which the detail view opens on. */
export type HeaderCardKind = 'encounter' | 'agenda' | 'act' | 'scenario';

/**
 * What the phone's detail view shows: a header card in the cards row, the map row (the whole map,
 * or one `location` in its place, the location mode), or an investigator's panel in the
 * investigators row.
 */
export type DetailTarget =
  | { row: 'cards'; card: HeaderCardKind }
  | { row: 'map'; location?: InstanceId }
  | { row: 'investigators'; investigator: InvestigatorId };

/**
 * The phone's detail view (M3.14b): open on a target (`DetailTarget`) or closed, the compact view.
 * Opening pushes a history entry, so the phone's back gesture closes the view again, as Escape and
 * `close` do; both go back through the history, so the entry never stays behind while the play
 * screen shows. Leaving the screen with the view open would leave it, but the view hides the menu
 * that leads away. Once open, `go` moves it to another target within the same entry.
 */
export function useDetailView(): {
  target: DetailTarget | undefined;
  open: (target: DetailTarget) => void;
  go: (target: DetailTarget) => void;
  close: () => void;
} {
  const [target, setTarget] = useState<DetailTarget>();
  // The back step lands a moment later, so a second Escape or × before it must not step again.
  const closing = useRef(false);
  const open = useCallback((next: DetailTarget) => {
    // The router keeps its own position in the history state, so the entry carries it on.
    window.history.pushState({ ...window.history.state, detailView: true }, '');
    closing.current = false;
    setTarget(next);
  }, []);
  const go = useCallback((next: DetailTarget) => setTarget(next), []);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    window.history.back();
  }, []);
  const shown = target !== undefined;
  useEffect(() => {
    if (!shown) return;
    const onBack = () => {
      closing.current = false;
      setTarget(undefined);
    };
    const onKey = (event: KeyboardEvent) => {
      // A dialog over the view takes Escape for itself and closes first.
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) close();
    };
    window.addEventListener('popstate', onBack);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onBack);
      window.removeEventListener('keydown', onKey);
    };
  }, [shown, close]);
  return { target, open, go, close };
}
