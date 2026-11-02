import { useId } from 'react';
import type { CardFaceView, EncounterSetCode } from '@arkham/engine';
import type { Point } from '../map/mapLayout';
import '../symbols/sets.css';
import { PORTRAIT_SCAN } from './cardArt';
import './card_face.css';

/**
 * A card's face as a dialog shows it (`CardDialog`, `CardZoom`, `TreacheryCard`): a `CardFaceView`
 * without the instance it is in play, so a card that is none (the scenario reference card, which
 * the game keeps as `BoardView.reference`) shows the same way.
 */
export type ShownCard = Omit<CardFaceView, 'id'>;

/**
 * How many SVG user units of a drawing a unit of a card scan is: card faces are drawn in scan
 * units (`PORTRAIT_SCAN`, measured on the ArkhamDB scans), and a map tile is half a scan.
 */
export const TILE_PER_SCAN = 0.5;

/** The SVG transform that draws a card face measured in scan units at a tile's size. */
export const SCAN_TO_TILE = `scale(${TILE_PER_SCAN})`;

/**
 * The outline of a portrait card face in scan units, its corners rounded like the printed card's.
 * A path rather than a rounded `rect`, since the map's stylesheet rounds every `rect` its own way.
 */
export const CARD_OUTLINE = (() => {
  const { width, height } = PORTRAIT_SCAN;
  const c = 12;
  const corner = `A ${c} ${c} 0 0 1`;
  return [
    `M ${c} 0 H ${width - c} ${corner} ${width} ${c} V ${height - c}`,
    `${corner} ${width - c} ${height} H ${c} ${corner} 0 ${height - c} V ${c} ${corner} ${c} 0 Z`,
  ].join(' ');
})();

/**
 * The clip that rounds a portrait card face's corners like the printed card's, in the scan units
 * of the face that uses it (`clipPath="url(#card-face-corners)"`). Drawn once per drawing, in its
 * `defs`, beside the other card fills (`CardPatterns`).
 */
export function CardFaceCorners() {
  return (
    <clipPath id="card-face-corners">
      <path d={CARD_OUTLINE} />
    </clipPath>
  );
}

/**
 * What a count circle counts: the stylesheet colours each like its token in the game. Clues on a
 * location and damage on an enemy so far; the agenda's doom and the investigator's horror join
 * with their card faces.
 */
export type CountKind = 'clue' | 'damage';

/**
 * The current count on a printed value, in scan units: a small circle on the value's lower right
 * (the clues left on a location's clue value, the doom on an agenda's threshold, the damage on an
 * enemy's health), so one element shows both. Every card type and every card theme draws it the
 * same way; `data-count` gives its colour, and a count of none fades (`data-empty`). Named for
 * assistive technology by `label`, since the number alone does not say what it counts.
 */
export function CountCircle({
  kind,
  value,
  label,
  centre: { x, y },
  radius = COUNT_RADIUS,
}: {
  kind: CountKind;
  value: number;
  label: string;
  centre: Point;
  radius?: number;
}) {
  return (
    <g role="img" aria-label={label} data-count={kind} data-empty={value === 0 || undefined}>
      <circle cx={x} cy={y} r={radius} />
      <text x={x} y={y}>
        {value}
      </text>
    </g>
  );
}

/**
 * A count circle's radius in scan units: a little larger than the mockup's 9, so the count stays
 * readable on a map tile at its smallest.
 */
const COUNT_RADIUS = 11;

/**
 * The icon of an encounter set (`set`, its `CardStats.encounterCode`) centred on `x`, `y` and
 * filling a circle of `radius`, in the face's units: a span whose CSS mask is the set's picture
 * (`symbols/sets.css`), so it takes the colour its place on the face gives it (`color`). The set
 * medallions, the agenda's and act's title and the scenario card's medallion print it.
 */
export function SetIcon({
  set,
  x,
  y,
  radius,
}: {
  set: EncounterSetCode;
  x: number;
  y: number;
  radius: number;
}) {
  return (
    <foreignObject x={x - radius} y={y - radius} width={2 * radius} height={2 * radius}>
      <span data-encounter-set={set} />
    </foreignObject>
  );
}

/**
 * The round set medallion on its plate, in scan units, as every encounter card prints it on its
 * type line: a dark ring, the pale medallion with an inner ring (where the encounter set's icon
 * goes), and under it the notched plate naming the card's `type`, `plateWidth` wide. The icon of
 * the card's encounter `set` fills the inner ring (`data-encounter-set`, its picture from
 * sets.css); a card without one, or whose set has no icon yet, shows the ring empty. The Eldritch
 * card theme shows an open eye on a medallion without a set icon (`data-part` eye, hidden
 * otherwise). Decoration and the type word only, so it is no image of its own.
 */
export function SetMedallion({
  centre: { x, y },
  radius,
  plateWidth,
  type,
  set,
}: {
  centre: Point;
  radius: number;
  plateWidth: number;
  type: string;
  set?: EncounterSetCode | undefined;
}) {
  const top = y + radius + 1;
  const bottom = top + PLATE_HEIGHT;
  const middle = (top + bottom) / 2;
  const left = x - plateWidth / 2;
  const right = x + plateWidth / 2;
  const innerRadius = radius - 3.5;
  const iconRadius = innerRadius * SET_ICON;
  return (
    <g data-medallion="">
      <circle data-part="setting" cx={x} cy={y} r={radius + 2.5} />
      <circle data-part="medallion" cx={x} cy={y} r={radius} />
      <circle data-part="inner" cx={x} cy={y} r={innerRadius} />
      <g data-part="eye">
        <path data-part="eye-white" d={lens(x, y, radius * EYE.width, radius * EYE.height)} />
        <circle data-part="iris" cx={x} cy={y} r={radius * EYE.iris} />
        <path data-part="pupil" d={lens(x, y, radius * EYE.iris, radius * EYE.pupil, 'upright')} />
      </g>
      {set && <SetIcon set={set} x={x} y={y} radius={iconRadius} />}
      <path
        data-part="plate"
        d={`M ${left} ${top} H ${right} L ${right + 5} ${middle} L ${right} ${bottom} H ${left} L ${left - 5} ${middle} Z`}
      />
      <path
        data-part="lines"
        d={`M ${left + 2} ${top + 2} H ${right - 2} M ${left + 2} ${bottom - 2} H ${right - 2}`}
      />
      <text x={x} y={middle}>
        {type}
      </text>
    </g>
  );
}

/** The type plate's height under a set medallion, in scan units, as printed. */
const PLATE_HEIGHT = 13;

/** How much of the inner ring's radius the encounter set icon fills, as printed. */
const SET_ICON = 0.85;

/**
 * The Eldritch medallion's eye, in parts of the medallion's radius: half the almond's width and
 * height, the iris's radius and half the slit pupil's width (the pupil is as tall as the iris).
 */
const EYE = { width: 0.8, height: 0.42, iris: 0.34, pupil: 0.09 } as const;

/**
 * A lens of two arcs (quadratic curves) centred on (`x`, `y`), `half` from its middle to each tip
 * and `bulge` to each side: an almond lying on its side, or `upright`, as a cat's pupil.
 */
function lens(
  x: number,
  y: number,
  half: number,
  bulge: number,
  orientation: 'lying' | 'upright' = 'lying',
): string {
  const at = (along: number, across: number) =>
    orientation === 'lying'
      ? `${round(x + along)} ${round(y + across)}`
      : `${round(x + across)} ${round(y + along)}`;
  // A quadratic curve reaches half way to its control point, so the control lies twice as far out.
  return `M ${at(-half, 0)} Q ${at(0, -2 * bulge)} ${at(half, 0)} Q ${at(0, 2 * bulge)} ${at(-half, 0)} Z`;
}

/**
 * The stars of the Eldritch card theme's night sky on a card's page, in scan units: `count`
 * four-pointed stars spread evenly over a `scan` sized card by the R2 sequence (a fixed, even
 * scatter that needs no randomness, so every card shows the same sky), alternating in size.
 */
export function skyStars(scan: { width: number; height: number }, count = SKY_STARS): string {
  return Array.from({ length: count }, (_, index) => {
    const x = ((0.5 + (index + 1) * R2.x) % 1) * scan.width;
    const y = ((0.5 + (index + 1) * R2.y) % 1) * scan.height;
    const radius = STAR_SIZES[index % STAR_SIZES.length] ?? 1;
    return starPath(x, y, radius, 0.3, 4);
  }).join(' ');
}

/** How many stars a card's night sky holds, and their sizes in turn, in scan units. */
const SKY_STARS = 36;
const STAR_SIZES = [2, 3.5, 1.5, 2.5] as const;

/** The R2 sequence's steps (the inverses of the plastic number and its square). */
const R2 = { x: 0.7548776662466927, y: 0.5698402909980532 } as const;

/**
 * The night sky over a card's page in the Eldritch card theme: the stars of `skyStars`, clipped
 * to the page's outline `page` (a path in scan units of a `scan` sized card), drawn over the page
 * and under its text. Hidden in the other themes (`data-night-sky`); the page's own gradient,
 * darkest at its edges, is the sky's vignette. Decoration only.
 */
export function NightSky({
  page,
  scan = PORTRAIT_SCAN,
}: {
  page: string;
  scan?: { width: number; height: number };
}) {
  const clipId = useId();
  return (
    <g data-night-sky="" aria-hidden="true">
      <clipPath id={clipId}>
        <path d={page} />
      </clipPath>
      <path clipPath={`url(#${clipId})`} d={skyStars(scan)} />
    </g>
  );
}

/**
 * An eight-pointed star (or one of `points` points) centred on (`x`, `y`), `radius` to its tips
 * and `inner` of that to the notches between them, as the printed frames scatter them.
 */
export function starPath(x: number, y: number, radius: number, inner = 0.4, points = 8): string {
  const corners = Array.from({ length: 2 * points }, (_, index) => {
    const angle = (index / (2 * points)) * 2 * Math.PI - Math.PI / 2;
    const reach = index % 2 === 0 ? radius : radius * inner;
    return `${round(x + Math.cos(angle) * reach)} ${round(y + Math.sin(angle) * reach)}`;
  });
  return `M ${corners.join(' L ')} Z`;
}

/** How a whiplash scroll ends: its spiral's first radius, which way it turns and how often. */
export interface ScrollEnd {
  radius: number;
  side: 1 | -1;
  turns: number;
}

/**
 * A whiplash scroll, the printed frames' Art Nouveau ornament, as a path: an S-curve from `from`
 * through the control points `bend1` and `bend2` to `to`, which then winds into a spiral of
 * `end.turns` turns that tightens towards its centre, on the curve's left (`side` 1) or right.
 */
export function scrollPath(
  from: Point,
  bend1: Point,
  bend2: Point,
  to: Point,
  end: ScrollEnd,
): string {
  const curve = Array.from({ length: CURVE_STEPS + 1 }, (_, step) => {
    const t = step / CURVE_STEPS;
    const u = 1 - t;
    const along = (key: 'x' | 'y') =>
      u * u * u * from[key] +
      3 * u * u * t * bend1[key] +
      3 * u * t * t * bend2[key] +
      t * t * t * to[key];
    return { x: along('x'), y: along('y') };
  });
  const length = Math.hypot(to.x - bend2.x, to.y - bend2.y) || 1;
  const tangent = { x: (to.x - bend2.x) / length, y: (to.y - bend2.y) / length };
  const centre = {
    x: to.x - tangent.y * end.side * end.radius,
    y: to.y + tangent.x * end.side * end.radius,
  };
  const start = Math.atan2(to.y - centre.y, to.x - centre.x);
  // The spiral turns the way the curve was heading, so the line runs on without a kink.
  const direction = -Math.sin(start) * tangent.x + Math.cos(start) * tangent.y >= 0 ? 1 : -1;
  const spiral = Array.from({ length: SPIRAL_STEPS }, (_, step) => {
    const angle = ((step + 1) / SPIRAL_STEPS) * end.turns * 2 * Math.PI;
    const reach = end.radius * Math.exp(-SPIRAL_TIGHTENING * angle);
    return {
      x: centre.x + reach * Math.cos(start + direction * angle),
      y: centre.y + reach * Math.sin(start + direction * angle),
    };
  });
  return `M ${[...curve, ...spiral].map(({ x, y }) => `${round(x)} ${round(y)}`).join(' L ')}`;
}

/** A scroll mirrored across the middle of a card `width` wide, for the frame's other side. */
export function mirrored(point: Point, width: number = PORTRAIT_SCAN.width): Point {
  return { x: width - point.x, y: point.y };
}

/** How finely a scroll's curve and spiral are drawn: enough steps that no corner shows. */
const CURVE_STEPS = 24;
const SPIRAL_STEPS = 60;

/** How fast a scroll's spiral closes in, per radian, as the printed ones do. */
const SPIRAL_TIGHTENING = 0.2;

/** A coordinate to two decimals, which keeps a path short without a visible step. */
function round(value: number): string {
  return value.toFixed(2);
}

/** The points of a path drawn of straight segments, as `scrollPath` returns it. */
function pathPoints(d: string): Point[] {
  const numbers = d.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
  return Array.from({ length: numbers.length / 2 }, (_, index) => ({
    x: numbers[2 * index] ?? 0,
    y: numbers[2 * index + 1] ?? 0,
  }));
}

/**
 * A tentacle as a filled outline round its centre line `d` (a path of straight segments, as
 * `scrollPath` draws it), `width` wide at its root and tapering to a point at its tip: the
 * encounter back's tentacles and the Eldritch card theme's ornament. A stroke keeps one width.
 */
export function tapered(d: string, width: number): string {
  const points = pathPoints(d);
  const last = points.length - 1;
  const edge = (side: 1 | -1) =>
    points.map((point, index) => {
      const before = points[Math.max(index - 1, 0)] ?? point;
      const after = points[Math.min(index + 1, last)] ?? point;
      const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
      const half = ((width / 2) * (last - index)) / last;
      return {
        x: point.x - ((after.y - before.y) / length) * half * side,
        y: point.y + ((after.x - before.x) / length) * half * side,
      };
    });
  const outline = [...edge(1), ...edge(-1).reverse()];
  return `M ${outline.map(({ x, y }) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
}

/** How wide an ornament line's tentacle is at its root, in scan units (the Eldritch card theme). */
const TENTACLE_WIDTH = 9;

/**
 * An ornament line of a printed frame, its path `d` in scan units: in the Exact card theme a pale
 * body with a dark outline and a fine highlight, like the printed scrollwork. Three strokes of the
 * same path (`data-part` outline, body, highlight) that the stylesheet widens and colours, so a
 * card theme can restyle every scroll at once; the Eldritch theme shows the tapered tentacle
 * along the same line instead (`data-part` tentacle). Decoration only.
 */
export function OrnamentLine({ d }: { d: string }) {
  return (
    <g data-ornament-line="" aria-hidden="true">
      <path data-part="outline" d={d} />
      <path data-part="body" d={d} />
      <path data-part="highlight" d={d} />
      <path data-part="tentacle" d={tapered(d, TENTACLE_WIDTH)} />
    </g>
  );
}

/**
 * Health as the game prints it, an anatomical heart, centred on (`x`, `y`) and `scale` times its
 * drawing (about 24 scan units tall): the outlined vessels on top, the body, the coronary lines
 * across it.
 * The stylesheet colours it (`data-symbol="heart"`). Decoration only; the card names what it counts.
 */
export function Heart({ centre: { x, y }, scale }: { centre: Point; scale: number }) {
  return (
    <g data-symbol="heart" aria-hidden="true" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path data-part="vessel-outline" d={HEART.vessels} />
      <path data-part="vessels" d={HEART.vessels} />
      <path data-part="body" d={HEART.body} />
      <path data-part="detail" d={HEART.detail} />
    </g>
  );
}

/** Sanity as the game prints it, a brain in side view, drawn like the `Heart`. */
export function Brain({ centre: { x, y }, scale }: { centre: Point; scale: number }) {
  return (
    <g data-symbol="brain" aria-hidden="true" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path data-part="vessel-outline" d={BRAIN.stem} />
      <path data-part="vessels" d={BRAIN.stem} />
      <path data-part="body" d={`${BRAIN.body} ${BRAIN.lobe}`} />
      <path data-part="detail" d={BRAIN.detail} />
    </g>
  );
}

/** The heart's parts, centred on the origin, our own drawing after the printed health icon. */
const HEART = {
  body: 'M-3 -3 C-9 -4.5 -11.5 2 -9.2 7 C-7 11.5 -2 14.2 2.2 13.2 C7.2 12 10.2 7 9.2 1 C8.6 -3 5.2 -5.2 2 -4.2 C0.6 -4.6 -1.4 -4 -3 -3 Z',
  vessels:
    'M-0.8 -3.6 C-2 -9 1 -12.2 5 -11.2 C8 -10.4 8.8 -7.4 7.2 -5.2 M-5.4 -3 L-6.4 -10 M2.4 -4 C3.4 -6.2 6.4 -6.4 9.4 -5.2 M1.2 -10.6 L0.4 -13.8 M4 -11.4 L4.2 -14.6 M6.8 -9.8 L8.4 -12.6',
  detail:
    'M-6.8 0.6 C-3.6 3.6 0.6 3.8 4 8.2 M-0.4 -1.6 C0.8 2.6 3 6 2 11.4 M4.4 -2.6 C6 -0.4 7.4 1 8.6 1.4',
} as const;

/** The brain's parts, centred on the origin, our own drawing after the printed sanity icon. */
const BRAIN = {
  body: 'M-10 2 C-11.6 -3 -8 -8 -3 -8.6 C0 -10.6 5 -10.2 8 -7.2 C11 -5 12.2 -1 10.6 2.6 C9.6 5 7 6 4 6 C2 7.6 -1 7.6 -3 6.6 C-6 7.6 -9.6 5.6 -10 2 Z',
  lobe: 'M2.6 6 C3.8 9.6 8.8 9.8 10 5 C8.6 6.4 6 6.6 4 6 Z',
  stem: 'M2.4 6.4 L1.2 10.6',
  detail:
    'M-7 -4 C-5 -6.4 -3 -3 -1 -5.2 C1 -7.4 3 -4 5 -6.2 C6.4 -7.6 8 -5 8.6 -4 M-8.4 1 C-6.2 -1.2 -4 2.2 -2 0 C0 -2.2 2 1 4 -1 C6 -3 8 0.2 9.6 -1.6 M-6.6 4.4 C-4.4 2.4 -2.2 5.2 0 3.2 C1.6 1.8 3 3.8 5 3 M-2.6 -8.2 C-3.6 -6.4 -1.4 -5.4 -2 -3.2 M3.8 -9.2 C2.8 -6.8 5 -5.6 4.2 -3.4',
} as const;
