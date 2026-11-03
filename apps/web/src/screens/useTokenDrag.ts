import { useState, type PointerEvent } from 'react';
import { isTap, type Point } from '../map/mapLayout';

/** The pointer handlers that make one token on the page draggable (`TokenDrag.handlers`). */
export interface TokenDragHandlers {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  onPointerMove(event: PointerEvent<HTMLElement>): void;
  onPointerUp(event: PointerEvent<HTMLElement>): void;
  onPointerCancel(): void;
}

/** A drag of a token off a counter on the page (`useTokenDrag`). */
export interface TokenDrag {
  /** Where the dragged token is on the screen, for its `TokenGhost`; absent while none is dragged. */
  at?: Point;
  handlers: TokenDragHandlers;
}

/**
 * Dragging a token off a counter outside the map (M3.11c), such as a clue off an investigator's
 * card: the page's counterpart of the map's `usePieceDrag`, in screen points since the token may
 * land anywhere on the page. Letting go calls `onDrop` with the point, and the caller hit-tests
 * what lies there (`investigatorAt`, `locationAt`). A press let go where it went down (`isTap`)
 * drags nothing, so a tap on the counter stays a tap; the click a drag ends with goes no further,
 * so a card the counter sits on (the agenda) does not open as well.
 */
export function useTokenDrag(onDrop: (client: Point) => void): TokenDrag {
  const [pressed, setPressed] = useState<Point>();
  const [at, setAt] = useState<Point>();
  const pointOf = (event: PointerEvent<HTMLElement>) => ({ x: event.clientX, y: event.clientY });
  return {
    at,
    handlers: {
      onPointerDown(event) {
        // Captured, the counter keeps getting the pointer's moves once it leaves the counter.
        event.currentTarget.setPointerCapture(event.pointerId);
        setPressed(pointOf(event));
      },
      onPointerMove(event) {
        const point = pointOf(event);
        if (pressed && (at || !isTap(pressed, point))) setAt(point);
      },
      onPointerUp(event) {
        const point = pointOf(event);
        const dragged = pressed !== undefined && !isTap(pressed, point);
        setPressed(undefined);
        setAt(undefined);
        if (!dragged) return;
        swallowNextClick();
        onDrop(point);
      },
      onPointerCancel() {
        setPressed(undefined);
        setAt(undefined);
      },
    },
  };
}

/**
 * Keeps the click a drag ends with from reaching the page, so a card the counter sits on does not
 * open. It is caught on the window before React's own capture handlers (`HeaderSlot` opens the
 * card in the capture phase). A drag a browser ends without a click leaves it to the next press,
 * which drops it, so it never eats a later tap.
 */
function swallowNextClick(): void {
  const swallow = (event: Event) => event.stopPropagation();
  const drop = () => window.removeEventListener('click', swallow, { capture: true });
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.addEventListener('pointerdown', drop, { capture: true, once: true });
}
