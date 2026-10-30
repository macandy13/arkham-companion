import { useId } from 'react';
import { ACT_ART, AGENDA_ART, LANDSCAPE_SCAN, artViewBox } from '../catalog/cardArt';
import { NightSky, OrnamentLine, mirrored, scrollPath } from '../catalog/cardFace';
import type { CardPicture } from '../catalog/cardImages';
import type { Point } from '../map/mapLayout';
import './book_face.css';

/**
 * Where an agenda card prints its parts, in landscape scan units (`LANDSCAPE_SCAN`), measured on
 * the ArkhamDB scans of The Gathering's agendas and checked by laying the drawing over them (the
 * card themes design, M3.10): the art down the left, the book's dark cover beside it, the stack of
 * page edges, the top page with its title ornaments, the threshold disc on the page's corner by
 * the art and the footer strip. An act prints the same layout mirrored (`facing`), with a
 * magnifier's handle on its disc.
 */
export const BOOK_FACE = {
  art: { left: 0, right: 174 },
  cover: { left: 158, bottom: 286 },
  page: { left: 180, right: 412, top: 7, bottom: 280, corner: 10 },
  /** The page edges under the top page: how many, and how much each one steps in. */
  stack: {
    count: 5,
    left: 166,
    right: 414,
    top: 2,
    bottom: 284,
    stepX: 2.6,
    stepRight: 0.4,
    stepY: 1.2,
  },
  middle: 301,
  /**
   * The threshold disc, drawn a third larger than printed so its number stays readable on the
   * header's small cards.
   */
  disc: { x: 205, y: 252, radius: 23, setting: 26 },
  handle: { from: 12, to: 34, rise: 18 },
  footer: 14,
} as const;

const { width, height } = LANDSCAPE_SCAN;

/** Which way the book faces: an agenda's art on the left, an act's mirrored on the right. */
type BookKind = 'agenda' | 'act';

/** `x` on an agenda, or across the card's middle on an act. */
function across(kind: BookKind, x: number): number {
  return kind === 'act' ? width - x : x;
}

/** A rectangle from `left` to `right` (either way round) and `top` to `bottom`, its corners rounded by `corner`. */
function roundedRect(
  left: number,
  right: number,
  top: number,
  bottom: number,
  corner: number,
): string {
  const x0 = Math.min(left, right);
  const x1 = Math.max(left, right);
  const arc = `A ${corner} ${corner} 0 0 1`;
  return [
    `M ${x0 + corner} ${top} H ${x1 - corner} ${arc} ${x1} ${top + corner} V ${bottom - corner}`,
    `${arc} ${x1 - corner} ${bottom} H ${x0 + corner} ${arc} ${x0} ${bottom - corner}`,
    `V ${top + corner} ${arc} ${x0 + corner} ${top} Z`,
  ].join(' ');
}

/** The scroll that curls out from the title on its left, as printed; mirrored for its right. */
const EYEBROW: [Point, Point, Point, Point] = [
  { x: 248, y: 18 },
  { x: 236, y: 12 },
  { x: 218, y: 12 },
  { x: 206, y: 20 },
];

/** The book's parts as SVG paths in scan units for `kind`, each named for the stylesheet. */
function bookPaths(kind: BookKind) {
  const x = (value: number) => across(kind, value);
  const { art, cover, page, stack } = BOOK_FACE;
  const middle = x(BOOK_FACE.middle);
  const disc = { x: x(BOOK_FACE.disc.x), y: BOOK_FACE.disc.y };
  // The eyebrows sit around the agenda's middle, so an act mirrors them with the whole card.
  const flip = (point: Point) => (kind === 'act' ? mirrored(point, width) : point);
  const eyebrow = (points: Point[], side: 1 | -1) => {
    const [from, bend1, bend2, to] = points.map(flip) as [Point, Point, Point, Point];
    return scrollPath(from, bend1, bend2, to, {
      radius: 3.5,
      side: kind === 'act' ? (side === 1 ? -1 : 1) : side,
      turns: 1.1,
    });
  };
  const rightEyebrow = EYEBROW.map((point) => mirrored(point, 2 * BOOK_FACE.middle));
  const fan = [0, 1, 2]
    .map(
      (index) =>
        `M ${middle - 16} 36 L ${middle - 56 + index * 4} ${31 + index * 4} M ${middle + 16} 36 L ${middle + 56 - index * 4} ${31 + index * 4}`,
    )
    .join(' ');
  const { from, to, rise } = BOOK_FACE.handle;
  return {
    art: roundedRect(x(art.left), x(art.right), 0, height, 0),
    cover: roundedRect(x(cover.left), x(width), 0, cover.bottom, 0),
    stack: Array.from({ length: stack.count }, (_, index) =>
      roundedRect(
        x(stack.left + index * stack.stepX),
        x(stack.right - index * stack.stepRight),
        stack.top + index * stack.stepY,
        stack.bottom - index * stack.stepY,
        12 - index,
      ),
    ),
    page: roundedRect(x(page.left), x(page.right), page.top, page.bottom, page.corner),
    watermark: [70, 50]
      .map(
        (size) =>
          `M ${middle} ${190 - size} L ${middle + size} 190 L ${middle} ${190 + size} L ${middle - size} 190 Z`,
      )
      .join(' '),
    eyebrows: [eyebrow(EYEBROW, 1), eyebrow(rightEyebrow, -1)],
    brackets: `M ${middle - 13} 22 Q ${middle - 20} 32 ${middle - 13} 42 M ${middle + 13} 22 Q ${middle + 20} 32 ${middle + 13} 42`,
    setMark: { x: middle, y: 32 },
    fan,
    disc,
    handle:
      kind === 'act'
        ? `M ${disc.x - from} ${disc.y + from} L ${disc.x - to} ${disc.y + from + rise}`
        : undefined,
    footer: `M 0 ${height - BOOK_FACE.footer} H ${width} V ${height} H 0 Z`,
  };
}

/**
 * The face of an agenda or act (`kind`) in the Exact card theme, in landscape scan units: our own
 * drawing of the printed layout (`BOOK_FACE`, no FFG art), the art cut from the card's `picture`
 * once it has loaded (a hatch until then, and for good offline), the open book beside it with its
 * page edges, the title's scrolls and set mark, and the threshold disc printing `threshold`. The
 * header card lays its name, its count and its buttons over it in HTML (GameHeader `CardFace`), so
 * this is decoration only (`aria-hidden`): the count's token names the threshold for assistive
 * technology.
 */
export function BookFace({
  kind,
  picture,
  threshold,
}: {
  kind: BookKind;
  picture: CardPicture | undefined;
  threshold: number | undefined;
}) {
  const pageId = useId();
  const paths = bookPaths(kind);
  const artArea = kind === 'act' ? ACT_ART : AGENDA_ART;
  const { disc } = paths;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-face="book"
    >
      <defs>
        {/* The stylesheet colours the stops, like the other faces' paper. */}
        <radialGradient id={pageId} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" />
          <stop offset="1" />
        </radialGradient>
      </defs>
      <path data-part="art" d={paths.art} />
      {picture && (
        <svg
          x={across(kind, kind === 'act' ? BOOK_FACE.art.right : BOOK_FACE.art.left)}
          y={0}
          width={BOOK_FACE.art.right - BOOK_FACE.art.left}
          height={height}
          viewBox={artViewBox(artArea, LANDSCAPE_SCAN)}
          preserveAspectRatio="xMidYMid slice"
        >
          <image
            href={picture.url}
            {...LANDSCAPE_SCAN}
            preserveAspectRatio="none"
            onLoad={picture.onLoad}
            onError={picture.onError}
          />
        </svg>
      )}
      <path data-part="cover" d={paths.cover} />
      {paths.stack.map((d, index) => (
        <path key={d} data-part={index % 2 === 0 ? 'page-edge' : 'page-edge-shade'} d={d} />
      ))}
      <path data-part="page" d={paths.page} fill={`url(#${pageId})`} />
      <NightSky page={paths.page} scan={LANDSCAPE_SCAN} />
      <path data-part="watermark" d={paths.watermark} />
      {paths.eyebrows.map((d) => (
        <OrnamentLine key={d} d={d} />
      ))}
      <path data-part="ink-line" d={paths.brackets} />
      <circle data-part="set-mark" cx={paths.setMark.x} cy={paths.setMark.y} r={4} />
      <path data-part="fine-line" d={paths.fan} />
      {paths.handle && (
        <g data-part="handle">
          <path d={paths.handle} />
          <path d={paths.handle} />
        </g>
      )}
      <circle data-part="disc-setting" cx={disc.x} cy={disc.y} r={BOOK_FACE.disc.setting} />
      <circle data-part="disc" data-kind={kind} cx={disc.x} cy={disc.y} r={BOOK_FACE.disc.radius} />
      {threshold !== undefined && (
        <text x={disc.x} y={disc.y}>
          {threshold}
        </text>
      )}
      <path data-part="footer" d={paths.footer} />
    </svg>
  );
}
