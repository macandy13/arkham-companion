import { useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Closes a popup menu the way the app's menus close (`SplitAction`, a location's connections, a
 * chaos token's menu): on a press outside `ref`'s element, or on Escape inside it, which then does
 * not reach the dialog around it, so the window stays open. `open` says whether one is showing;
 * `close` hides it. Spread `onKeyDown` onto the same element that takes `ref`.
 */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  // Callers pass a new `close` each render; held in a ref, it doesn't re-add the listener each time.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeRef.current();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    event.preventDefault();
    close();
  };
  return { ref, onKeyDown };
}
