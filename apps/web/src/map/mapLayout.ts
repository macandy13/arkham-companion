import { GRID_CELLS_PER_CARD, type GridCell, type InstanceId, type MapView } from '@arkham/engine';

/** A point in the map drawing's coordinates (SVG user units, y downwards). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Size of a location tile and the gap between tiles, in SVG user units. The drawing shrinks to
 * fit its box but never grows past one unit per CSS pixel, so these are also the largest tile
 * size: a tile is wider than tall like a card on its side. A tile and a gap divide by
 * `GRID_CELLS_PER_CARD`, so every cell starts on a whole unit.
 */
export const TILE = { width: 160, height: 100, gap: 50 } as const;

/**
 * Where each location of `map` is drawn: its book layout cell, or for a location without one a
 * place in a row one card step below the lowest laid-out tile, one card step apart in map
 * order, so a scenario without a layout still shows every location.
 */
export function tileCells(map: MapView): Record<InstanceId, GridCell> {
  const laidOut = Object.values(map.cells);
  const spareRow =
    laidOut.length === 0 ? 0 : Math.max(...laidOut.map(({ row }) => row)) + GRID_CELLS_PER_CARD;
  let spare = 0;
  return Object.fromEntries(
    map.locations.map(({ id }) => [
      id,
      map.cells[id] ?? { column: GRID_CELLS_PER_CARD * spare++, row: spareRow },
    ]),
  );
}

/**
 * The top left corner of the tile in `cell`. A card step (`GRID_CELLS_PER_CARD` cells) is a
 * tile and a gap, so tiles one card step apart sit side by side with a gap between them.
 */
export function tileOrigin({ column, row }: GridCell): Point {
  return {
    x: (column * (TILE.width + TILE.gap)) / GRID_CELLS_PER_CARD,
    y: (row * (TILE.height + TILE.gap)) / GRID_CELLS_PER_CARD,
  };
}

/** The size of a drawing that holds every tile in `cells`, from the origin. */
export function drawingSize(cells: readonly GridCell[]): { width: number; height: number } {
  const origins = cells.map(tileOrigin);
  if (origins.length === 0) return { width: 0, height: 0 };
  return {
    width: Math.max(...origins.map(({ x }) => x)) + TILE.width,
    height: Math.max(...origins.map(({ y }) => y)) + TILE.height,
  };
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
