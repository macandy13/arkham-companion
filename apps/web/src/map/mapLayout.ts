import type { GridCell, InstanceId, MapView } from '@arkham/engine';

/** A point in the map drawing's coordinates (SVG user units, y downwards). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Size of a location tile and the gap between tiles, in SVG user units. The drawing shrinks to
 * fit its box but never grows past one unit per CSS pixel, so these are also the largest tile
 * size: a tile is wider than tall like a card on its side.
 */
export const TILE = { width: 160, height: 100, gap: 60 } as const;

/**
 * Where each location of `map` is drawn: its book layout cell, or for a location without one
 * the next free cell in a row below the laid-out ones, in map order, so a scenario without a
 * layout still shows every location.
 */
export function tileCells(map: MapView): Record<InstanceId, GridCell> {
  const laidOut = Object.values(map.cells);
  const spareRow = laidOut.length === 0 ? 0 : Math.max(...laidOut.map(({ row }) => row)) + 1;
  let spareColumn = 0;
  return Object.fromEntries(
    map.locations.map(({ id }) => [id, map.cells[id] ?? { column: spareColumn++, row: spareRow }]),
  );
}

/** The top left corner of the tile in `cell`. */
export function tileOrigin({ column, row }: GridCell): Point {
  return { x: column * (TILE.width + TILE.gap), y: row * (TILE.height + TILE.gap) };
}

/** The size of a drawing that holds every tile in `cells`, from the origin. */
export function drawingSize(cells: readonly GridCell[]): { width: number; height: number } {
  const columns = Math.max(0, ...cells.map(({ column }) => column + 1));
  const rows = Math.max(0, ...cells.map(({ row }) => row + 1));
  const width = columns * TILE.width + Math.max(0, columns - 1) * TILE.gap;
  const height = rows * TILE.height + Math.max(0, rows - 1) * TILE.gap;
  return { width, height };
}

/**
 * The ends of a connection line from the tile in cell `from` to the tile in cell `to`: on the
 * line between their centres where it leaves each tile, so a one-way arrowhead sits at the edge
 * of its target instead of under it.
 */
export function connectionEnds(from: GridCell, to: GridCell): [Point, Point] {
  const start = centre(from);
  const end = centre(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // The share of the centre-to-centre line that lies inside one tile; at most half, so tiles
  // that overlap (two locations given one cell) draw no line rather than a reversed one.
  const inside = Math.min(
    0.5,
    dx === 0 ? Infinity : TILE.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : TILE.height / 2 / Math.abs(dy),
  );
  return [
    { x: start.x + dx * inside, y: start.y + dy * inside },
    { x: end.x - dx * inside, y: end.y - dy * inside },
  ];
}

function centre(cell: GridCell): Point {
  const { x, y } = tileOrigin(cell);
  return { x: x + TILE.width / 2, y: y + TILE.height / 2 };
}
