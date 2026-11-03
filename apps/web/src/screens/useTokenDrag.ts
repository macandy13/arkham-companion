import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { isTap, type Point } from '../map/mapLayout';

/** The pointer handlers that make one token on the page draggable (`TokenDrag.handlers`). */
export interface TokenDragHandlers {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  onPointerMove(event: PointerEvent<HTMLElement>): void;
  onPointerUp(event: PointerEvent<HTMLElement>): void;
  onPointerCancel(): void;
  onClick(event: MouseEvent<HTMLElement>): void;
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
  const dropped = useRef(false);
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
        dropped.current = dragged;
        if (dragged) onDrop(point);
      },
      onPointerCancel() {
        setPressed(undefined);
        setAt(undefined);
      },
      onClick(event) {
        if (dropped.current) event.stopPropagation();
        dropped.current = false;
      },
    },
  };
}
