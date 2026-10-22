import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/** How long a press must be held to count as a long press. */
const LONG_PRESS_MS = 500;

/** How far, in CSS pixels, a press may wander and still count: further, it is a pan. */
const PRESS_SLOP = 10;

/** The handlers that make one target answer a long press (`LongPress.handlers`). */
export interface LongPressHandlers {
  onPointerDown(event: PointerEvent<SVGGElement>): void;
  onPointerMove(event: PointerEvent<SVGGElement>): void;
  onPointerUp(): void;
  onPointerCancel(): void;
  onPointerLeave(): void;
  onContextMenu(event: MouseEvent<SVGGElement>): void;
}

/** Long presses on several targets, one at a time (`useLongPress`). */
export interface LongPress<Target> {
  /** The handlers that make `target` answer a long press. */
  handlers(target: Target): LongPressHandlers;
}

/**
 * Calls `onLongPress` with the target that was pressed and held still. A press that moves is a
 * pan of the map, one joined by a second finger is a pinch, and one that starts on a draggable
 * piece (`data-drag`) is a drag, so none of them counts. The context menu (a right click, or the long press of a browser that has one) counts
 * at once and replaces the browser's own menu, which has nothing for a map tile.
 */
export function useLongPress<Target>(onLongPress: (target: Target) => void): LongPress<Target> {
  const press = useRef<{
    timer: ReturnType<typeof setTimeout>;
    pointerId: number;
    x: number;
    y: number;
  }>(undefined);
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = undefined;
  };
  useEffect(() => cancel, []);
  return {
    handlers: (target) => ({
      onPointerDown(event) {
        cancel();
        // A second finger makes it a pinch, which zooms the map rather than pressing a tile.
        if (!event.isPrimary) return;
        if (event.target instanceof Element && event.target.closest('[data-drag]')) return;
        const timer = setTimeout(() => {
          press.current = undefined;
          onLongPress(target);
        }, LONG_PRESS_MS);
        press.current = { timer, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      },
      onPointerMove(event) {
        const start = press.current;
        if (start?.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > PRESS_SLOP) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu(event) {
        event.preventDefault();
        cancel();
        onLongPress(target);
      },
    }),
  };
}
