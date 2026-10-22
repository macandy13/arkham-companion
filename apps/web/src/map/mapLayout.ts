import { GRID_CELLS_PER_CARD, type GridCell, type InstanceId, type MapView } from '@arkham/engine';

/** A point in the map drawing's coordinates (SVG user units, y downwards). */
export interface Point {
  x: number;
  y: number;
}

/**
 * The size of every card, in SVG user units: all Arkham cards are 63.5 × 88 mm, drawn at 5 : 7,
 * which is within 1 % of the real card and half the size of an ArkhamDB scan (about 300 × 419),
 * so card art can fill it. Portrait cards (locations) stand `short` wide; landscape cards (the
 * agenda and act) lie `long` wide.
 */
export const CARD = { short: 150, long: 210 } as const;

/**
 * Size of a location tile, a portrait card, and the gap between tiles, in SVG user units. The
 * drawing shrinks to fit its box but never grows past one unit per CSS pixel, so these are also
 * the largest tile size. A tile and a gap divide by `GRID_CELLS_PER_CARD`, so every cell starts
 * on a whole unit.
 */
export const TILE = { width: CARD.short, height: CARD.long, gap: 30 } as const;

/**
 * Where a tile's contents sit, in SVG user units from its top left corner. The name band runs
 * along the top, `band` high, with the edit button at its right end. Below it a row of round
 * badges and tokens (`badgeOffset`, `tokenOffset`), then enemy chips, and investigator pawns in a
 * row along the bottom edge (`pawnOffset`). Badges, tokens and pawns share one radius, so every
 * round thing on a tile is one size.
 */
export const CONTENT = { inset: 10, band: 48, chip: 28, pawnRadius: 14, pawnGap: 6 } as const;

/** The centre of the row of badges and tokens below the name band, from a tile's top. */
const tokenRowY = CONTENT.band + CONTENT.pawnRadius;

/** The centre of a tile's stat badge, the printed value at the left end of the token row. */
export const BADGE_CENTRE: Point = { x: CONTENT.inset + CONTENT.pawnRadius, y: tokenRowY };

/**
 * The centre of the `index`th token in the row below the name band, counted from the right
 * edge, so the tokens a location has line up at the right and leave the badge free.
 */
export function tokenOffset(index: number): Point {
  return {
    x:
      TILE.width -
      CONTENT.inset -
      CONTENT.pawnRadius -
      index * (2 * CONTENT.pawnRadius + CONTENT.pawnGap),
    y: tokenRowY,
  };
}

/** The top of the first enemy chip, from a tile's top: one gap below the token row. */
export const CHIPS_TOP = tokenRowY + CONTENT.pawnRadius + CONTENT.pawnGap;

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

/**
 * The location whose tile holds `point`, if any: where a dragged piece is let go. Where tiles
 * overlap (two locations given one cell), the one drawn last is on top, so it wins.
 */
export function tileAt(cells: Record<InstanceId, GridCell>, point: Point): InstanceId | undefined {
  const tiles = Object.entries(cells) as [InstanceId, GridCell][];
  return tiles.reverse().find(([, cell]) => {
    const { x, y } = tileOrigin(cell);
    return point.x >= x && point.x <= x + TILE.width && point.y >= y && point.y <= y + TILE.height;
  })?.[0];
}

/** The centre of the `index`th pawn in the row along a tile's bottom edge, from its top left corner. */
export function pawnOffset(index: number): Point {
  return {
    x: CONTENT.inset + CONTENT.pawnRadius + index * (2 * CONTENT.pawnRadius + CONTENT.pawnGap),
    y: TILE.height - CONTENT.inset - CONTENT.pawnRadius,
  };
}

/** Whether `point` lies on the pawn centred on `centre`: where a dragged enemy is let go to engage. */
export function onPawn(centre: Point, point: Point): boolean {
  return Math.hypot(point.x - centre.x, point.y - centre.y) <= CONTENT.pawnRadius;
}
