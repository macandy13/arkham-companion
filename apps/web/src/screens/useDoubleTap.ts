import { useRef, type MouseEvent } from 'react';

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
 * double tap or never send `dblclick`; a third tap starts over.
 */
export function useDoubleTap(
  onDoubleTap: (element: HTMLElement) => void,
): (event: MouseEvent<HTMLElement>) => void {
  const last = useRef<number>(undefined);
  return (event) => {
    if (isDoubleTap(last.current, event.timeStamp)) {
      last.current = undefined;
      onDoubleTap(event.currentTarget);
    } else last.current = event.timeStamp;
  };
}
