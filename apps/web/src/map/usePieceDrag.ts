import { useState, type PointerEvent, type RefObject } from 'react';
import type { Point } from './mapLayout';

/** The pointer handlers that make one piece draggable (`PieceDrag.handlers`). */
export interface DragHandlers {
  onPointerDown(event: PointerEvent<SVGGElement>): void;
  onPointerMove(event: PointerEvent<SVGGElement>): void;
  onPointerUp(event: PointerEvent<SVGGElement>): void;
  onPointerCancel(): void;
}

/** A drag of one `Piece` on a map drawing (`usePieceDrag`). */
export interface PieceDrag<Piece> {
  /** The piece being dragged and where it is, in the drawing's coordinates; absent while none is. */
  dragged?: { piece: Piece; at: Point };
  /** The handlers that make `piece` draggable. */
  handlers(piece: Piece): DragHandlers;
}

/**
 * Dragging pieces (pawns, enemy chips) across the map drawing `svg`. While the pointer is down on
 * a piece, `dragged` follows it; letting go calls `onDrop` with the piece and the point, and the
 * caller decides what a drop there means. A drop that means nothing, or a refused one, leaves the
 * piece where it was, since the board still shows it where the game has it; the screen's
 * rejection toast gives the reason for a refusal, so the drop needs no hint of its own.
 */
export function usePieceDrag<Piece>(
  svg: RefObject<SVGSVGElement | null>,
  onDrop: (piece: Piece, point: Point) => void,
): PieceDrag<Piece> {
  const [dragged, setDragged] = useState<{ piece: Piece; at: Point }>();
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
        follow(piece, event);
      },
      onPointerMove(event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) follow(piece, event);
      },
      onPointerUp(event) {
        setDragged(undefined);
        const point = toDrawing(event);
        if (point) onDrop(piece, point);
      },
      onPointerCancel() {
        setDragged(undefined);
      },
    }),
  };
}
