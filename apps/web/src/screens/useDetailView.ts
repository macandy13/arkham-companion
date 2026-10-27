import { useCallback, useEffect, useState } from 'react';
import type { InvestigatorId } from '@arkham/engine';

/** The header's four cards, in the order the header and the detail view's cards row lay them out. */
export const HEADER_CARDS = ['encounter', 'agenda', 'act', 'scenario'] as const;

/** One of the header's four cards (`HEADER_CARDS`), which the detail view opens on. */
export type HeaderCardKind = (typeof HEADER_CARDS)[number];

/**
 * What the phone's detail view opens on: a header card in the cards row, or an investigator's
 * panel in the investigators row. The map row between them is reached by swiping.
 */
export type DetailTarget =
  { row: 'cards'; card: HeaderCardKind } | { row: 'investigators'; investigator: InvestigatorId };

/**
 * The phone's detail view (M3.14b): open on a target (`DetailTarget`) or closed, the compact view.
 * Opening pushes a history entry, so the phone's back gesture closes the view again, as Escape and
 * `close` do; both go back through the history, so the entry never stays behind.
 */
export function useDetailView(): {
  target: DetailTarget | undefined;
  open: (target: DetailTarget) => void;
  close: () => void;
} {
  const [target, setTarget] = useState<DetailTarget>();
  const open = useCallback((next: DetailTarget) => {
    window.history.pushState({ detailView: true }, '');
    setTarget(next);
  }, []);
  const close = useCallback(() => window.history.back(), []);
  const shown = target !== undefined;
  useEffect(() => {
    if (!shown) return;
    const onBack = () => setTarget(undefined);
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
  return { target, open, close };
}
