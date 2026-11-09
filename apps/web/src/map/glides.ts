import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { BoardView, GridCell, InstanceId, InvestigatorId, MapView } from '@arkham/engine';
import { piecesOnTile, tileOrigin, type Point } from './mapLayout';

/** A pawn or an enemy token on the map, by whom or what it stands for. */
export type MapPiece = { investigator: InvestigatorId } | { enemy: InstanceId };

/** Where a piece stands on a map: its location and its centre in the drawing's coordinates. */
export interface PiecePlace {
  piece: MapPiece;
  location: InstanceId;
  centre: Point;
}

/**
 * Where every pawn and enemy token stands on `map` laid out in `cells`, in the drawing's
 * coordinates: among the pieces on their location's tile (`piecesOnTile`), as `LocationTile`
 * draws them. A location without a cell has no tile, so its pieces are left out.
 */
export function piecePlaces(
  map: MapView,
  cells: Readonly<Record<InstanceId, GridCell>>,
  board: BoardView,
): PiecePlace[] {
  return map.locations.flatMap((location) => {
    const cell = cells[location.id];
    if (!cell) return [];
    const tile = tileOrigin(cell);
    return piecesOnTile(
      board.investigatorsAt(location.id),
      map.enemies[location.id] ?? [],
    ).pieces.map((placed) => ({
      piece:
        'investigator' in placed
          ? { investigator: placed.investigator.id }
          : { enemy: placed.enemy.id },
      location: location.id,
      centre: { x: tile.x + placed.centre.x, y: tile.y + placed.centre.y },
    }));
  });
}

/** A piece that moved and how far from its new centre it starts its glide, in drawing units. */
export interface Glide {
  piece: MapPiece;
  offset: Point;
}

/**
 * A piece the players dropped on the map, where, and on which location's tile, which then glides
 * from there if the move took it to that location.
 */
export interface Drop {
  piece: MapPiece;
  at: Point;
  to: InstanceId;
}

/**
 * The pieces that went to another location between `before` and `after` (M6.5b), each gliding from
 * where it stood: from where it was `dropped`, if the players dragged it to that location, else
 * from its old place (a drop the game refused never reaches the piece's next move elsewhere). A piece that only shifted on its own tile (another piece came or left) or that is new on
 * the map does not glide.
 */
export function glides(
  before: readonly PiecePlace[],
  after: readonly PiecePlace[],
  dropped?: Drop,
): Glide[] {
  return after.flatMap(({ piece, location, centre }) => {
    const was = before.find((place) => samePiece(place.piece, piece));
    if (!was || was.location === location) return [];
    const from =
      dropped && samePiece(dropped.piece, piece) && dropped.to === location
        ? dropped.at
        : was.centre;
    return [{ piece, offset: { x: from.x - centre.x, y: from.y - centre.y } }];
  });
}

function samePiece(a: MapPiece, b: MapPiece): boolean {
  return 'investigator' in a
    ? 'investigator' in b && a.investigator === b.investigator
    : 'enemy' in b && a.enemy === b.enemy;
}

/**
 * The drawn elements of `piece` in `drawing`: a pawn (`data-pawn`), or an enemy token
 * (`data-enemy`) with the badges beside it (`data-badge-of`), never the ghost a drag shows.
 */
function elementsOf(drawing: SVGSVGElement, piece: MapPiece): Element[] {
  const marks: [string, string][] =
    'investigator' in piece
      ? [['data-pawn', piece.investigator]]
      : [
          ['data-enemy', piece.enemy],
          ['data-badge-of', piece.enemy],
        ];
  return marks.flatMap(([attribute, id]) =>
    [...drawing.querySelectorAll(`[${attribute}]:not([data-ghost])`)].filter(
      (element) => element.getAttribute(attribute) === id,
    ),
  );
}

/**
 * Lets the pieces in `drawing` that went to another location glide there from where they stood
 * (M6.5b, `glides`), once per change of `board`, so the players follow a move they made, a
 * hunter's or one undone. It reads the places of the board it last saw, so the first board
 * shown, and a map shown again, move nothing. Motion only, so reduced motion has none; the glide's
 * time is the stylesheet's `--duration-glide`. Returns how to tell it that the players dropped a
 * piece, so that piece glides from where it was dropped into its place; the drop counts for the
 * next board only, so one the game refused (no new board) goes with the next change.
 */
export function useGlides(
  drawing: RefObject<SVGSVGElement | null>,
  board: BoardView,
  places: readonly PiecePlace[],
): (drop: Drop) => void {
  const seen = useRef<{ board: BoardView; places: readonly PiecePlace[] }>(undefined);
  const dropped = useRef<Drop>(undefined);
  useLayoutEffect(() => {
    const last = seen.current;
    if (last?.board === board) return;
    seen.current = { board, places };
    const drop = dropped.current;
    dropped.current = undefined;
    const svg = drawing.current;
    if (!last || !svg || prefersReducedMotion()) return;
    const moved = glides(last.places, places, drop);
    // Reading the stylesheet forces the browser to work out the styles, so only for a glide (M6.5d).
    if (moved.length === 0) return;
    const duration = seconds(getComputedStyle(svg).getPropertyValue('--duration-glide')) * 1000;
    for (const { piece, offset } of moved) {
      for (const element of elementsOf(svg, piece)) {
        element.animate([{ translate: `${offset.x}px ${offset.y}px` }, { translate: '0px 0px' }], {
          duration,
          easing: 'ease-in-out',
        });
      }
    }
  });
  return (drop) => {
    dropped.current = drop;
  };
}

/** Whether the players prefer reduced motion; so it counts where the browser cannot tell (unit tests). */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A CSS time ("0.4s", "400ms") in seconds; none when it does not read as one. */
function seconds(time: string): number {
  const value = Number.parseFloat(time);
  if (Number.isNaN(value)) return 0;
  return time.trim().endsWith('ms') ? value / 1000 : value;
}
