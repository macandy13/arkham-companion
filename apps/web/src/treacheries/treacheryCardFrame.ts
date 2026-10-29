import { range } from '@arkham/util';
import { PORTRAIT_SCAN } from '../catalog/cardArt';
import { mirrored, scrollPath, starPath, type ScrollEnd } from '../catalog/cardFace';
import type { Point } from '../map/mapLayout';

/**
 * Where a treachery card prints its parts, in scan units (`PORTRAIT_SCAN`), measured on the
 * ArkhamDB scans of The Gathering's treacheries and checked by laying the drawing over them (the
 * card themes design, M3.10): the art behind a keyhole window in the frame, the set medallion on
 * the frame's foot, the beaded band over the page, and on the page the name between the two star
 * corners and the traits under it.
 */
export const TREACHERY_FACE = {
  art: { y: 0, height: 244 },
  medallion: { x: 150, y: 211, radius: 14, plateWidth: 78 },
  band: { y: 236, height: 10 },
  page: 246,
  corner: { size: 22, star: 7 },
  name: { x: 150, y: 256, width: 230 },
  traits: { x: 24, y: 268, width: 252, height: 18 },
  /** The beads along the window's edge and on the band: how far apart and how big. */
  beads: { step: 3.4, chain: 1.1, band: 1 },
  footer: 16,
} as const;

const { width, height } = PORTRAIT_SCAN;
const { band, page, corner, beads } = TREACHERY_FACE;

/** The keyhole window the art shows through: a rounded arch, a waist, and a wide foot. */
const WINDOW =
  'M 40 0 H 260 C 262 18 270 36 282 46 L 243 111 L 290 238 H 10 L 57 111 L 18 46 C 30 36 38 18 40 0 Z';

/** The left bead chain beside the window, as straight runs between its corners. */
const CHAIN: readonly Point[] = [
  { x: 36, y: 0 },
  { x: 13, y: 46 },
  { x: 51, y: 111 },
  { x: 4, y: 238 },
];

/** Beads every `step` along the runs between `points`. */
function beadsAlong(points: readonly Point[], step: number): Point[] {
  const runs = points.flatMap((to, index) => {
    const from = points[index - 1];
    return from ? [{ from, to }] : [];
  });
  return runs.flatMap(({ from, to }) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return range(Math.ceil(length / step)).map((bead) => {
      const along = (bead * step) / length;
      return { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
    });
  });
}

/** Round beads of `radius` at `points`, as one path. */
function beadPath(points: readonly Point[], radius: number): string {
  const arc = `a ${radius} ${radius} 0 1 0`;
  return points
    .map(
      ({ x, y }) =>
        `M ${(x - radius).toFixed(1)} ${y.toFixed(1)} ${arc} ${2 * radius} 0 ${arc} ${-2 * radius} 0`,
    )
    .join(' ');
}

/** The volutes on the left of the window's waist, as printed: each mirrored on the right. */
const VOLUTES: readonly [Point, Point, Point, Point, ScrollEnd][] = [
  [
    { x: 46, y: 100 },
    { x: 30, y: 94 },
    { x: 20, y: 80 },
    { x: 24, y: 66 },
    { radius: 7, side: 1, turns: 1.4 },
  ],
  [
    { x: 40, y: 108 },
    { x: 22, y: 108 },
    { x: 8, y: 116 },
    { x: 10, y: 130 },
    { radius: 6, side: -1, turns: 1.3 },
  ],
  [
    { x: 46, y: 116 },
    { x: 38, y: 128 },
    { x: 36, y: 140 },
    { x: 26, y: 150 },
    { radius: 5, side: 1, turns: 1.2 },
  ],
];

const chainBeads = beadsAlong(CHAIN, beads.step);
const bandBeads = range(Math.ceil((width - 4) / beads.step)).map((index) => ({
  x: 4 + index * beads.step,
  y: band.y + band.height / 2,
}));

/**
 * The frame's parts as SVG paths in scan units, each named for the stylesheet (`data-part` in
 * TreacheryCard): the art's area, the window and the stone around it (filled even-odd, so the art
 * shows through), the bead chains and the thread under them, the volutes (`OrnamentLine`s), the
 * notched plates and rules on the foot, the band with its beads, the page, its star corners and
 * the footer strip.
 */
export const TREACHERY_FRAME = {
  art: `M 0 0 H ${width} V ${TREACHERY_FACE.art.height} H 0 Z`,
  window: WINDOW,
  stone: `M 0 0 H ${width} V ${TREACHERY_FACE.art.height} H 0 Z ${WINDOW}`,
  chains: beadPath([...chainBeads, ...chainBeads.map((bead) => mirrored(bead))], beads.chain),
  thread: [CHAIN, CHAIN.map((point) => mirrored(point))]
    .map((points, side) => {
      const shift = side === 0 ? -3 : 3;
      return `M ${points.map(({ x, y }) => `${x + shift} ${y}`).join(' L ')}`;
    })
    .join(' '),
  volutes: VOLUTES.flatMap(([from, bend1, bend2, to, end]) => [
    scrollPath(from, bend1, bend2, to, end),
    scrollPath(mirrored(from), mirrored(bend1), mirrored(bend2), mirrored(to), {
      ...end,
      side: end.side === 1 ? -1 : 1,
    }),
  ]),
  plates:
    'M 24 216 H 64 L 70 222 H 30 Z M 70 222 H 92 L 86 216 M 276 216 H 236 L 230 222 H 270 Z M 230 222 H 208 L 214 216',
  footRule: 'M 10 232 H 110 M 190 232 H 290',
  band: `M 0 ${band.y} H ${width} V ${band.y + band.height} H 0 Z`,
  bandBeads: beadPath(bandBeads, beads.band),
  page: `M 0 ${page} H ${width} V ${height} H 0 Z`,
  corners: `M 0 ${page} H ${corner.size} V ${page + corner.size} H 0 Z M ${width - corner.size} ${page} H ${width} V ${page + corner.size} H ${width - corner.size} Z`,
  cornerStars: [
    starPath(corner.size / 2 - 1, page + corner.size / 2 - 1, corner.star),
    starPath(width - corner.size / 2 + 1, page + corner.size / 2 - 1, corner.star),
  ].join(' '),
  footer: `M 0 ${height - TREACHERY_FACE.footer} H ${width} V ${height} H 0 Z`,
} as const;
