import { useEffect, useRef, type MouseEvent } from 'react';

/** The longest pause between two taps that still makes them one double tap, in milliseconds. */
export const DOUBLE_TAP_MS = 350;

/**
 * Whether a tap at `now` is the second of a double tap after the one at `last` (both event
 * timestamps in milliseconds), `DOUBLE_TAP_MS` apart at most.
 */
export function isDoubleTap(last: number | undefined, now: number): boolean {
  return last !== undefined && now - last <= DOUBLE_TAP_MS;
}

/**
 * A click handler that calls `onDoubleTap` with the tapped element on the second of two taps or
 * clicks in quick succession. Built on `click` rather than `dblclick`, since touch browsers either zoom on a
 * double tap or never send `dblclick`; a third tap starts over. Where a single tap does something
 * too (`onTap`, a location tile opening its details), it waits `DOUBLE_TAP_MS` for a second tap
 * first, since the details would cover what the second tap lands on.
 */
export function useDoubleTap<E extends Element>(
  onDoubleTap: (element: E) => void,
  onTap?: () => void,
): (event: MouseEvent<E>) => void {
  const last = useRef<number>(undefined);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(pending.current), []);
  return (event) => {
    clearTimeout(pending.current);
    if (isDoubleTap(last.current, event.timeStamp)) {
      last.current = undefined;
      onDoubleTap(event.currentTarget);
      return;
    }
    last.current = event.timeStamp;
    if (onTap) pending.current = setTimeout(onTap, DOUBLE_TAP_MS);
  };
}
