import { PORTRAIT_SCAN } from '../catalog/cardArt';
import { CARD_OUTLINE, NightSky } from '../catalog/cardFace';

/**
 * Where a location card prints its parts, in scan units (`PORTRAIT_SCAN`), measured on the
 * ArkhamDB scans of The Gathering's locations and checked by laying the drawing over them (the
 * card themes design, M3.10): the name plate along the top over the frame's band, the pendant
 * hanging from the band, the page that arches up into the art, the set medallion with its type
 * plate on the page's edge, the shroud and clue discs at the ends of that edge, the clue count on
 * the clue disc's lower right, the foot with the connection sockets, the footer strip and the
 * card's rounded edge.
 */
export const LOCATION_FACE = {
  plateBottom: 28,
  bandBottom: 40,
  name: { x: 150, y: 15, width: 196 },
  pendant: { half: 38, depth: 24, inlayHalf: 22, inlayDepth: 14 },
  pageEdge: { y: 238, lift: 22 },
  medallion: { x: 148, y: 203, radius: 14, plateWidth: 82 },
  shroud: { x: 28, y: 226 },
  clues: { x: 272, y: 226 },
  disc: { radius: 21, setting: 25 },
  count: { x: 254, y: 244 },
  doom: { x: 272, y: 282 },
  foot: { y: 380, lift: 28 },
  sockets: { y: 391, first: 69, step: 38.6, count: 6, radius: 15, setting: 17.5 },
  footer: 16,
} as const;

const { width, height } = PORTRAIT_SCAN;
const middle = width / 2;

/**
 * An arch from the left edge at `y` to the right edge, its handles `lift` higher, as the printed
 * page and foot curve (its top lies 3/4 of `lift` higher).
 */
function arch(y: number, lift: number): string {
  return `M 0 ${y} C 70 ${y - lift} 230 ${y - lift} ${width} ${y}`;
}

/** The pendant: a chevron hanging from the name plate into the band, with an inlaid one. */
function chevron(half: number, depth: number): string {
  const top = LOCATION_FACE.plateBottom;
  return `M ${middle - half} ${top} L ${middle} ${top + depth} L ${middle + half} ${top}`;
}

const PAGE_EDGE = arch(LOCATION_FACE.pageEdge.y, LOCATION_FACE.pageEdge.lift);
const FOOT_EDGE = arch(LOCATION_FACE.foot.y, LOCATION_FACE.foot.lift);
const BELOW = `V ${height} H 0 Z`;

/** The connection sockets along the foot, where a printed card shows the symbols it connects to. */
const SOCKETS = Array.from(
  { length: LOCATION_FACE.sockets.count },
  (_, index) => LOCATION_FACE.sockets.first + index * LOCATION_FACE.sockets.step,
);

/**
 * The frame of a location card in the Exact card theme, in scan units: our own drawing of the
 * printed layout (`LOCATION_FACE`), no FFG art. It lies over the art, which shows through above
 * the page. Decoration only (`aria-hidden`); `data-ornament` lets the stylesheet colour it for the
 * card theme and the tile's side and hide it under a whole card picture. Each part is named by
 * `data-part`, so the stylesheet fills the paper and the frame and only strokes the rules, and
 * shows the settings of the shroud and clue discs only on the revealed side, which prints them.
 */
export function LocationOrnament() {
  const { plateBottom, bandBottom, pendant, disc, sockets } = LOCATION_FACE;
  return (
    <g aria-hidden="true" data-ornament="">
      <path data-part="frame" d={`M 0 0 H ${width} V ${bandBottom} H 0 Z`} />
      <path data-part="plate" d={`M 0 0 H ${width} V ${plateBottom} H 0 Z`} />
      <path data-part="dark-rule" d={`M 0 ${plateBottom + 0.5} H ${width}`} />
      <path data-part="rule" d={`M 0 ${bandBottom - 2} H ${width}`} />
      <path data-part="pendant" d={`${chevron(pendant.half, pendant.depth)} Z`} />
      <path data-part="rule" d={chevron(pendant.inlayHalf, pendant.inlayDepth)} />
      <path data-part="page" d={`${PAGE_EDGE} ${BELOW}`} />
      <NightSky page={`${PAGE_EDGE} ${BELOW}`} />
      <path data-part="page-setting" d={PAGE_EDGE} />
      <path data-part="page-band" d={PAGE_EDGE} />
      <path data-part="rule" d={arch(LOCATION_FACE.pageEdge.y - 5, LOCATION_FACE.pageEdge.lift)} />
      {[LOCATION_FACE.shroud, LOCATION_FACE.clues].map(({ x, y }) => (
        <circle key={x} data-part="disc-setting" cx={x} cy={y} r={disc.setting} />
      ))}
      <path data-part="frame" d={`${FOOT_EDGE} ${BELOW}`} />
      <path data-part="dark-rule" d={FOOT_EDGE} />
      <path data-part="rule" d={arch(LOCATION_FACE.foot.y - 5, LOCATION_FACE.foot.lift)} />
      {SOCKETS.map((x) => (
        <g key={x} data-part="socket">
          <circle cx={x} cy={sockets.y} r={sockets.setting} />
          <circle cx={x} cy={sockets.y} r={sockets.radius} />
        </g>
      ))}
      <path data-part="footer" d={`M 0 ${height - LOCATION_FACE.footer} H ${width} ${BELOW}`} />
      <path data-part="edge" d={CARD_OUTLINE} />
    </g>
  );
}
