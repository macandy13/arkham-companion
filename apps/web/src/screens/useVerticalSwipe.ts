import { useEffect, useRef, type RefObject } from 'react';
import type { Point } from '../map/mapLayout';

/** Which way a vertical swipe went, up or down the screen. */
export type SwipeDirection = 'up' | 'down';

/**
 * How far, in CSS pixels, a touch must travel up or down to count as a swipe: about a fingertip's
 * width, so a tap that slides a little stays a tap.
 */
const SWIPE_DISTANCE = 40;

/**
 * The direction of a swipe from `start` to `end`, or nothing for a tap or a sideways swipe: the
 * touch must travel `SWIPE_DISTANCE` and at least twice as far up or down as across, so the
 * header's and the investigators' sideways scrolling never reads as one.
 */
export function swipeDirection(start: Point, end: Point): SwipeDirection | undefined {
  const across = Math.abs(end.x - start.x);
  const down = end.y - start.y;
  if (Math.abs(down) < SWIPE_DISTANCE || Math.abs(down) < 2 * across) return undefined;
  return down > 0 ? 'down' : 'up';
}

/** A swipe up or down the board, for `useVerticalSwipe`'s handler. */
export interface Swipe {
  direction: SwipeDirection;
  /** The element the touch started on. */
  on: Element;
  /**
   * Whether, as the touch started, a part between `on` and the board was scrolled down: read then,
   * since by the touch's end the browser has scrolled it, perhaps back to the top.
   */
  scrolled: boolean;
}

/**
 * Calls `onSwipe` with the `Swipe` when a touch swipes up or down
 * within `element` (the phone's board, which expands and folds its parts by it, M3.15c). A touch
 * that starts on a token to drag (`[data-drag]`) is the drag's, not a swipe. Only touches count,
 * since a mouse has the taps; the listeners are passive, so scrolling stays the browser's.
 */
export function useVerticalSwipe(
  element: RefObject<HTMLElement | null>,
  enabled: boolean,
  onSwipe: (swipe: Swipe) => void,
): void {
  // The latest handler, so a new one each render does not bind the listeners again.
  const handler = useRef(onSwipe);
  useEffect(() => {
    handler.current = onSwipe;
  });
  useEffect(() => {
    const target = element.current;
    if (!enabled || !target) return;
    let start: { at: Point; on: Element; scrolled: boolean } | undefined;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const on = event.target instanceof Element ? event.target : undefined;
      start =
        event.touches.length === 1 && touch && on && !on.closest('[data-drag]')
          ? { at: { x: touch.clientX, y: touch.clientY }, on, scrolled: scrolledWithin(on, target) }
          : undefined;
    };
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const from = start;
      start = undefined;
      if (!from || !touch) return;
      const direction = swipeDirection(from.at, { x: touch.clientX, y: touch.clientY });
      if (direction) handler.current({ direction, on: from.on, scrolled: from.scrolled });
    };
    const onCancel = () => {
      start = undefined;
    };
    target.addEventListener('touchstart', onStart, { passive: true });
    target.addEventListener('touchend', onEnd, { passive: true });
    target.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchend', onEnd);
      target.removeEventListener('touchcancel', onCancel);
    };
  }, [element, enabled]);
}

/** Whether `on` or a part around it, up to `board`, is scrolled down from its top. */
function scrolledWithin(on: Element, board: Element): boolean {
  for (let part: Element | null = on; part && part !== board; part = part.parentElement) {
    if (part.scrollTop > 0) return true;
  }
  return false;
}
