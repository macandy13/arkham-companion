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
 * Where a tile's contents sit, in SVG user units from its top left corner, laid out like the
 * printed card (a tile is half an ArkhamDB scan, so the card's parts keep their places): the name
 * plate runs along the top, `band` deep, with the edit button at its left end where the card
 * prints its connection icon; the shroud and the clues sit on the left and right edges where the
 * art ends (`SHROUD_CENTRE`, `CLUES_CENTRE`), doom under the clues; attachments peek out at the
 * right edge as small cards (`attachmentOrigin`), and pawns and enemies stand in rows along the
 * bottom edge where the card prints its connection circles (`pawnOffset`). Tokens and pieces
 * share one radius, so every round thing on a tile is one size.
 */
export const CONTENT = { inset: 10, band: 19, pawnRadius: 14, pawnGap: 6 } as const;

/**
 * The corners of the lead investigator's marker on a pawn centred on `pawn`: a pentagon, point up,
 * like the game's lead investigator token, on the pawn's upper right edge, so the initial stays
 * readable.
 */
export function leadMarkerPoints(pawn: Point): Point[] {
  const centre = {
    x: pawn.x + CONTENT.pawnRadius * Math.SQRT1_2,
    y: pawn.y - CONTENT.pawnRadius * Math.SQRT1_2,
  };
  return Array.from({ length: 5 }, (_, corner) => {
    const angle = -Math.PI / 2 + (corner * 2 * Math.PI) / 5;
    return {
      x: centre.x + LEAD_MARKER_RADIUS * Math.cos(angle),
      y: centre.y + LEAD_MARKER_RADIUS * Math.sin(angle),
    };
  });
}

/** How far the lead marker's corners reach from its centre: half a pawn, so it reads as a badge. */
const LEAD_MARKER_RADIUS = CONTENT.pawnRadius / 2;

/**
 * The height of the line the shroud and clues sit on, where the art ends: 8/15 of the tile's
 * height, as on the printed card.
 */
const TOKEN_LINE = (TILE.height * 8) / 15;

/**
 * The centre of a tile's shroud token, on its left edge where the art ends, as on the printed card.
 * Its ring reaches a little past the edge, as the printed circle does.
 */
export const SHROUD_CENTRE: Point = { x: CONTENT.pawnRadius, y: TOKEN_LINE };

/** The centre of a tile's clue token, on its right edge where the art ends, as on the printed card. */
export const CLUES_CENTRE: Point = { x: TILE.width - CONTENT.pawnRadius, y: TOKEN_LINE };

/** The centre of a tile's doom token, right under its clues. */
export const DOOM_CENTRE: Point = {
  x: CLUES_CENTRE.x,
  y: CLUES_CENTRE.y + 2 * CONTENT.pawnRadius + CONTENT.pawnGap,
};

/** The top of the art window: just under the top edge, about 6 % of the card, as on the printed card. */
const ART_TOP = 12;

/**
 * Where the "frames" look shows a location's art on its tile: the printed card's art area, the
 * whole width from just under the top edge to a little below the shroud and clues. The name plate
 * and the type line (`LocationOrnament`) lie over its top and bottom edge, as they do on the card.
 */
export const ART_WINDOW = {
  x: 0,
  y: ART_TOP,
  width: TILE.width,
  height: TOKEN_LINE + CONTENT.pawnGap - ART_TOP,
} as const;

/**
 * How wide a location's name may run on its name plate: centred, clear of the edit button in the
 * top left corner by a gap on each side, and as far from the right edge.
 */
export const NAME_WIDTH = TILE.width - 2 * (2 * CONTENT.pawnRadius + CONTENT.pawnGap);

/**
 * How much a name `width` units wide at its normal size must shrink to fit `room` units: 1 when it
 * fits, so short names keep their size and only long ones get smaller.
 */
export function shrinkToFit(width: number, room: number): number {
  return width > room ? room / width : 1;
}

/**
 * A card attached to a location, drawn small (a fifth of a card's size, rounded to whole units)
 * and turned a little, peeking out past the tile's right edge below the name band.
 */
export const ATTACHMENT = { width: 30, height: 42, turn: 8, step: 14 } as const;

/**
 * How far past a tile's right edge the drawing reaches, so the attachments of a tile in the last
 * column are not cut off: half an attachment plus its turn, rounded up to a whole card width.
 */
const ATTACHMENT_OVERHANG = ATTACHMENT.width;

/**
 * The top left corner of the `index`th attachment on a tile: half of it past the right edge, each
 * one a `step` lower than the one before, so a few stay told apart.
 */
export function attachmentOrigin(index: number): Point {
  return {
    x: TILE.width - ATTACHMENT.width / 2,
    y: CONTENT.band + CONTENT.pawnGap + index * ATTACHMENT.step,
  };
}

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
    width: Math.max(...origins.map(({ x }) => x)) + TILE.width + ATTACHMENT_OVERHANG,
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

/** How many pieces stand side by side in a row along a tile's bottom edge. */
const PIECES_PER_ROW = 4;

/**
 * The centre of the `index`th piece standing on a tile, from its top left corner: investigators
 * first, then enemies, in rows of `PIECES_PER_ROW` along the bottom edge, each further row above
 * the one before.
 */
export function pawnOffset(index: number): Point {
  const column = index % PIECES_PER_ROW;
  const row = Math.floor(index / PIECES_PER_ROW);
  const step = 2 * CONTENT.pawnRadius + CONTENT.pawnGap;
  return {
    x: CONTENT.inset + CONTENT.pawnRadius + column * step,
    y: TILE.height - CONTENT.inset - CONTENT.pawnRadius - row * step,
  };
}

/** Whether `point` lies on the pawn centred on `centre`: where a dragged enemy is let go to engage. */
export function onPawn(centre: Point, point: Point): boolean {
  return Math.hypot(point.x - centre.x, point.y - centre.y) <= CONTENT.pawnRadius;
}

/**
 * How far, in CSS pixels, the pointer may move between pressing and letting go for a tap; further,
 * it was a pan of the map or a piece dragged. A finger on a phone wobbles a few pixels.
 */
const TAP_SLOP = 8;

/** Whether a press at screen point `pressed`, let go at `released`, is a tap rather than a pan or a drag. */
export function isTap(pressed: Point, released: Point): boolean {
  return Math.hypot(released.x - pressed.x, released.y - pressed.y) <= TAP_SLOP;
}
