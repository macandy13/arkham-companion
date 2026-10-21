import { useState, type PointerEvent, type RefObject } from 'react';
import type { GridCell, InstanceId } from '@arkham/engine';
import { tileAt, type Point } from './mapLayout';

/** The pointer handlers that make one pawn draggable (`PawnDrag.handlers`). */
export interface PawnDragHandlers {
  onPointerDown(event: PointerEvent<SVGGElement>): void;
  onPointerMove(event: PointerEvent<SVGGElement>): void;
  onPointerUp(event: PointerEvent<SVGGElement>): void;
  onPointerCancel(): void;
}

/** A pawn drag in progress on one map drawing (`usePawnDrag`). */
export interface PawnDrag {
  /** Where the dragged pawn is, in the drawing's coordinates; absent while none is dragged. */
  ghost?: Point;
  /** The handlers for the pawn standing at `from`. */
  handlers(from: InstanceId): PawnDragHandlers;
}

/**
 * Dragging a pawn across the map drawing `svg`, whose tiles sit at `cells`. While the pointer is
 * down on a pawn, `ghost` follows it; letting go over another location's tile calls `onDrop`
 * with that location. A pawn let go anywhere else snaps back, as nothing changed. A refused move
 * snaps back too, since the board still shows the pawn where the game has it, and the screen's
 * rejection toast gives the reason, so the drop needs no hint of its own.
 */
export function usePawnDrag(
  svg: RefObject<SVGSVGElement | null>,
  cells: Record<InstanceId, GridCell>,
  onDrop: (location: InstanceId) => void,
): PawnDrag {
  const [ghost, setGhost] = useState<Point>();
  // The screen matrix includes the pan and zoom transform, so a point maps right at any zoom.
  const toDrawing = (event: PointerEvent<SVGGElement>): Point | undefined => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return undefined;
    const { a, b, c, d, e, f } = matrix.inverse();
    const { clientX: x, clientY: y } = event;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  };
  return {
    ghost,
    handlers: (from) => ({
      onPointerDown(event) {
        // Captured, the pawn keeps getting the pointer's moves once it leaves the pawn.
        event.currentTarget.setPointerCapture(event.pointerId);
        setGhost(toDrawing(event));
      },
      onPointerMove(event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setGhost(toDrawing(event));
      },
      onPointerUp(event) {
        setGhost(undefined);
        const point = toDrawing(event);
        const to = point && tileAt(cells, point);
        if (to && to !== from) onDrop(to);
      },
      onPointerCancel() {
        setGhost(undefined);
      },
    }),
  };
}
