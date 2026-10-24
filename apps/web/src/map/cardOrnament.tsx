import { ART_WINDOW, CLUES_CENTRE, CONTENT, pawnOffset, TILE } from './mapLayout';

/**
 * The parts of a location card's frame, in SVG user units on a tile, placed where the printed
 * card has them (a tile is half a scan): the rounded corner the frame follows, the name plate's
 * lowest edge, the dark band under it, the pendant hanging from that band, the arched type line
 * across the foot of the art with its medallion and type plate, and the arched band at the foot
 * that holds the pieces.
 */
const FRAME = {
  corner: 8,
  plateEdge: CONTENT.band,
  plateRise: 8,
  plateSwoop: 38,
  bandBottom: CONTENT.band + 6,
  pendant: { half: 24, inlayHalf: 14, depth: 12, inlayDepth: 7, wing: 9 },
  typeLine: { rise: 6, medallion: 10, plateHalf: 34, plateHeight: 9, notch: 3 },
  footRise: 38,
  footEnd: 16,
  gilt: 2.5,
} as const;

const width = TILE.width;
const height = TILE.height;
const middle = width / 2;
const artBottom = ART_WINDOW.y + ART_WINDOW.height;

/** A small diamond centred on (`x`, `y`), the frame's jewel. */
function diamond(x: number, y: number, size: number): string {
  return `M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`;
}

/** A circle centred on (`x`, `y`) as a path, so every part of the frame is a `path`. */
function circle(x: number, y: number, r: number): string {
  return `M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} A ${r} ${r} 0 1 1 ${x - r} ${y} Z`;
}

/** The top edge of the card, round at both corners, from its left edge to its right one. */
const TOP_EDGE = (() => {
  const c = FRAME.corner;
  return `M 0 ${c} A ${c} ${c} 0 0 1 ${c} 0 H ${width - c} A ${c} ${c} 0 0 1 ${width} ${c}`;
})();

/**
 * The name plate's lower edge `drop` units lower, drawn on from its right end to its left one:
 * flat under the name, sweeping up into both top corners like the printed plate.
 */
function plateEdgeLeftwards(drop: number): string {
  const y = FRAME.plateEdge + drop;
  const end = FRAME.plateRise + drop;
  const swoop = FRAME.plateSwoop;
  return [
    `C ${width - 10} ${y} ${width - 20} ${y} ${width - swoop} ${y}`,
    `H ${swoop} C 20 ${y} 10 ${y} 0 ${end}`,
  ].join(' ');
}

/** The name plate's lower edge `drop` units lower, as a line of its own. */
function plateEdge(drop: number): string {
  return `M ${width} ${FRAME.plateRise + drop} ${plateEdgeLeftwards(drop)}`;
}

/** The dark band along the top that the name plate lies on. */
const TOP_BAND = `${TOP_EDGE} V ${FRAME.bandBottom} H 0 Z`;

/** The name plate: parchment from the top edge down to its sweeping lower edge. */
const NAME_PLATE = `${TOP_EDGE} ${plateEdgeLeftwards(0)} Z`;

/** The gilt rules of the top band: along the plate's edge, engraved across the band, and its foot. */
const TOP_GILT = [
  plateEdge(0),
  plateEdge(FRAME.gilt),
  `M 0 ${FRAME.bandBottom} H ${width}`,
].join(' ');

/** The double rule under the name, as the printed plate underlines it. */
const NAME_RULE = (() => {
  const y = FRAME.plateEdge - FRAME.gilt;
  const reach = middle - FRAME.plateSwoop;
  return `M ${middle - reach} ${y} H ${middle + reach} M ${middle - reach / 2} ${y - 1.5} H ${middle + reach / 2}`;
})();

/**
 * The pendant hanging from the top band into the art: a wide chevron with small wings and an
 * inlaid chevron in the band's colour, where an unrevealed card shows a keyhole (`KEYHOLE`).
 */
const PENDANT = (() => {
  const { half, depth, wing } = FRAME.pendant;
  const top = FRAME.bandBottom;
  return [
    `M ${middle - half} ${top} H ${middle + half} L ${middle} ${top + depth} Z`,
    `M ${middle - half - wing} ${top} H ${middle - half} L ${middle - half - wing / 2} ${top + wing / 2} Z`,
    `M ${middle + half + wing} ${top} H ${middle + half} L ${middle + half + wing / 2} ${top + wing / 2} Z`,
  ].join(' ');
})();
const PENDANT_INLAY = (() => {
  const { inlayHalf, inlayDepth } = FRAME.pendant;
  const top = FRAME.bandBottom;
  return `M ${middle - inlayHalf} ${top} H ${middle + inlayHalf} L ${middle} ${top + inlayDepth} Z`;
})();
const KEYHOLE = (() => {
  const y = FRAME.bandBottom + 2;
  return `${circle(middle, y, 1.3)} M ${middle - 0.6} ${y + 0.8} H ${middle + 0.6} L ${middle + 1} ${y + 3} H ${middle - 1} Z`;
})();

/**
 * The thin gilt arcs a location's unrevealed side draws across its art: two great circles
 * crossing under the pendant and a rule near each edge. They stand in for the art's own arcs,
 * which a picture of the card already carries.
 */
const VEIL = (() => {
  const r = 78;
  const shift = 7;
  const reach = Math.sqrt(r * r - (width - middle - shift) ** 2);
  const foot = artBottom - 14;
  const top = FRAME.bandBottom;
  return [
    `M 4 ${foot} A ${r} ${r} 0 0 1 ${width} ${foot - reach}`,
    `M ${width - 4} ${foot} A ${r} ${r} 0 0 0 0 ${foot - reach}`,
    `M 7 ${top} V ${foot} M ${width - 7} ${top} V ${foot}`,
  ].join(' ');
})();

/** The top edge of the type line: an arch across the foot of the art, highest in the middle. */
function typeLineArch(drop: number): string {
  const end = artBottom - FRAME.typeLine.plateHeight - 3 + drop;
  return `M 0 ${end} Q ${middle} ${end - 2 * FRAME.typeLine.rise} ${width} ${end}`;
}

/** The type line: the arched band across the foot of the art, under the shroud and clues. */
const TYPE_LINE = `${typeLineArch(0)} V ${artBottom} H 0 Z`;
const TYPE_GILT = [typeLineArch(0), typeLineArch(FRAME.gilt), `M 0 ${artBottom} H ${width}`].join(
  ' ',
);

/** The type line's medallion, where a printed card shows its encounter set's icon. */
const MEDALLION_CENTRE = {
  x: middle,
  y: artBottom - FRAME.typeLine.plateHeight - 3 - FRAME.typeLine.rise,
};
const MEDALLION = circle(MEDALLION_CENTRE.x, MEDALLION_CENTRE.y, FRAME.typeLine.medallion);
const MEDALLION_RING = circle(MEDALLION_CENTRE.x, MEDALLION_CENTRE.y, FRAME.typeLine.medallion - 2.5);
const MEDALLION_JEWEL = diamond(MEDALLION_CENTRE.x, MEDALLION_CENTRE.y, 3.5);

/** The plate on the type line that names the card's type, notched at both ends. */
const TYPE_PLATE = (() => {
  const { plateHalf, plateHeight, notch } = FRAME.typeLine;
  const bottom = artBottom - 1;
  const top = bottom - plateHeight;
  const y = (top + bottom) / 2;
  const left = middle - plateHalf;
  const right = middle + plateHalf;
  return `M ${left} ${top} H ${right} L ${right - notch} ${y} L ${right} ${bottom} H ${left} L ${left + notch} ${y} Z`;
})();

/** Where the type plate's text sits: its middle. */
export const TYPE_PLATE_CENTRE = {
  x: middle,
  y: artBottom - 1 - FRAME.typeLine.plateHeight / 2,
} as const;

/** The magnifier's handle on the clue circle, pointing down to the right as on the printed card. */
const HANDLE = (() => {
  const reach = CONTENT.pawnRadius * Math.SQRT1_2;
  const x = CLUES_CENTRE.x + reach;
  const y = CLUES_CENTRE.y + reach;
  return `M ${x} ${y} L ${width - 1} ${y + 6}`;
})();

/** Faint rings in the text box, like the engraved pattern behind a printed card's text. */
const WATERMARK = (() => {
  const y = (artBottom + height - FRAME.footRise) / 2 + 4;
  return [circle(middle, y, 24), circle(middle, y, 20), diamond(middle, y, 12)].join(' ');
})();

/** The card's edge, drawn over the bands and the art so it stays whole, as on the printed card. */
const EDGE = (() => {
  const c = FRAME.corner;
  return `${TOP_EDGE} V ${height - c} A ${c} ${c} 0 0 1 ${width - c} ${height} H ${c} A ${c} ${c} 0 0 1 0 ${height - c} Z`;
})();

/** The text box: the lighter parchment from the type line to the foot. */
const TEXT_BOX = `M 0 ${artBottom} H ${width} V ${height - FRAME.corner} H 0 Z`;

/** The foot's arch, `drop` units lower: from both edges up to its top in the middle. */
function footArch(drop: number): string {
  const end = height - FRAME.footEnd + drop;
  return `M 0 ${end} Q ${middle} ${end - 2 * (FRAME.footRise - FRAME.footEnd)} ${width} ${end}`;
}

/** The foot: the arched dark band along the bottom where the pieces stand. */
const FOOT = (() => {
  const c = FRAME.corner;
  return `${footArch(0)} V ${height - c} A ${c} ${c} 0 0 1 ${width - c} ${height} H ${c} A ${c} ${c} 0 0 1 0 ${height - c} Z`;
})();
const FOOT_GILT = [footArch(0), footArch(FRAME.gilt)].join(' ');

/** A socket in the foot for each piece of the first row, like the printed connection circles. */
const SOCKETS = [0, 1, 2, 3]
  .map((index) => pawnOffset(index))
  .map(({ x, y }) => circle(x, y, CONTENT.pawnRadius))
  .join(' ');

/**
 * The frame of a location tile drawn after the printed location cards, our own drawing (no FFG
 * art): the name plate sweeping up into the top corners over a dark band with gilt rules, a
 * pendant hanging into the art (with a keyhole on the unrevealed side), thin gilt arcs over the
 * unrevealed side's art, the arched type line across the foot of the art with its medallion and
 * type plate, the magnifier handle of the clue circle, the text box with a faint engraving, and
 * the arched foot whose sockets the pieces stand in, and the card's dark edge over all of it. It is decoration only (`aria-hidden`);
 * `data-ornament` lets the stylesheet colour it for the tile's side and hide it under a whole card
 * scan. Each part is a `path` named by `data-part`, so the stylesheet fills the plates and bands
 * and only strokes the rules.
 */
export function LocationOrnament() {
  return (
    <g aria-hidden="true" data-ornament="">
      <path data-part="box" d={TEXT_BOX} />
      <path data-part="watermark" d={WATERMARK} />
      <path data-part="veil" d={VEIL} />
      <path data-part="band" d={TOP_BAND} />
      <path data-part="plate" d={NAME_PLATE} />
      <path data-part="paper" d={`${NAME_PLATE} ${TEXT_BOX}`} />
      <path data-part="gilt" d={TOP_GILT} />
      <path data-part="rule" d={NAME_RULE} />
      <path data-part="pendant" d={PENDANT} />
      <path data-part="inlay" d={PENDANT_INLAY} />
      <path data-part="keyhole" d={KEYHOLE} />
      <path data-part="band" d={TYPE_LINE} />
      <path data-part="gilt" d={TYPE_GILT} />
      <path data-part="medallion" d={MEDALLION} />
      <path data-part="gilt" d={MEDALLION_RING} />
      <path data-part="jewel" d={MEDALLION_JEWEL} />
      <path data-part="pendant" d={TYPE_PLATE} />
      <path data-part="handle" d={HANDLE} />
      <path data-part="band" d={FOOT} />
      <path data-part="gilt" d={FOOT_GILT} />
      <path data-part="socket" d={SOCKETS} />
      <path data-part="edge" d={EDGE} />
    </g>
  );
}
