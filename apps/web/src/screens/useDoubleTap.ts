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
  const tapOn = useDoubleTapOn<true, E>(
    (_, element) => onDoubleTap(element),
    onTap && (() => onTap()),
  );
  return (event) => tapOn(true, event.currentTarget, event.timeStamp);
}

/**
 * `useDoubleTap` for taps that come as a `key` (which piece, such as an enemy on the map), its
 * `element` and the event's `timeStamp` rather than as a click, as the map's piece drags report
 * them; two taps make a double tap only on the same key. A tap on another key drops the single tap
 * still waiting for the one before, since only one piece's details can show at a time.
 */
export function useDoubleTapOn<K, E extends Element = Element>(
  onDoubleTap: (key: K, element: E) => void,
  onTap?: (key: K) => void,
): (key: K, element: E, timeStamp: number) => void {
  const last = useRef<{ key: K; at: number }>(undefined);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(pending.current), []);
  return (key, element, timeStamp) => {
    clearTimeout(pending.current);
    if (last.current?.key === key && isDoubleTap(last.current.at, timeStamp)) {
      last.current = undefined;
      onDoubleTap(key, element);
      return;
    }
    last.current = { key, at: timeStamp };
    if (onTap) pending.current = setTimeout(() => onTap(key), DOUBLE_TAP_MS);
  };
}
