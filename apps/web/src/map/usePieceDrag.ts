import { useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { isTap, type Point } from './mapLayout';

/** The pointer handlers that make one piece draggable (`PieceDrag.handlers`). */
export interface DragHandlers {
  onPointerDown(event: PointerEvent<SVGGElement>): void;
  onPointerMove(event: PointerEvent<SVGGElement>): void;
  onPointerUp(event: PointerEvent<SVGGElement>): void;
  onPointerCancel(): void;
  onClick(event: MouseEvent<SVGGElement>): void;
}

/** A drag of one `Piece` on a map drawing (`usePieceDrag`). */
export interface PieceDrag<Piece> {
  /** The piece being dragged and where it is, in the drawing's coordinates; absent while none is. */
  dragged?: { piece: Piece; at: Point };
  /** The handlers that make `piece` draggable. */
  handlers(piece: Piece): DragHandlers;
}

/**
 * Dragging pieces (pawns, enemy tokens) across the map drawing `svg`. While the pointer is down on
 * a piece, `dragged` follows it; letting go calls `onDrop` with the piece and the point, and the
 * caller decides what a drop there means. Letting go about where it went down (`isTap`) is a tap
 * instead, which calls `onTap` with the piece: when it returns true the tap was the piece's own,
 * and the click it makes goes no further, so the tile under the piece does not open as well. A drop that means nothing, or a refused one, leaves the
 * piece where it was, since the board still shows it where the game has it; the screen's
 * rejection toast gives the reason for a refusal, so the drop needs no hint of its own.
 */
export function usePieceDrag<Piece>(
  svg: RefObject<SVGSVGElement | null>,
  onDrop: (piece: Piece, point: Point) => void,
  onTap: (piece: Piece) => boolean,
): PieceDrag<Piece> {
  const [dragged, setDragged] = useState<{ piece: Piece; at: Point }>();
  const pressedAt = useRef<Point>(undefined);
  const tapTaken = useRef(false);
  // The screen matrix includes the pan and zoom transform, so a point maps right at any zoom.
  const toDrawing = (event: PointerEvent<SVGGElement>): Point | undefined => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return undefined;
    const { a, b, c, d, e, f } = matrix.inverse();
    const { clientX: x, clientY: y } = event;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  };
  const follow = (piece: Piece, event: PointerEvent<SVGGElement>) => {
    const at = toDrawing(event);
    setDragged(at && { piece, at });
  };
  return {
    dragged,
    handlers: (piece) => ({
      onPointerDown(event) {
        // Captured, the piece keeps getting the pointer's moves once it leaves the piece.
        event.currentTarget.setPointerCapture(event.pointerId);
        pressedAt.current = { x: event.clientX, y: event.clientY };
        follow(piece, event);
      },
      onPointerMove(event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) follow(piece, event);
      },
      onPointerUp(event) {
        setDragged(undefined);
        const pressed = pressedAt.current;
        const released = { x: event.clientX, y: event.clientY };
        tapTaken.current = pressed !== undefined && isTap(pressed, released) && onTap(piece);
        if (tapTaken.current) return;
        const point = toDrawing(event);
        if (point) onDrop(piece, point);
      },
      onPointerCancel() {
        setDragged(undefined);
      },
      onClick(event) {
        if (tapTaken.current) event.stopPropagation();
        tapTaken.current = false;
      },
    }),
  };
}
