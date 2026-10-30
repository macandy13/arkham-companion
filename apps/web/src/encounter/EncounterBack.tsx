import { useId } from 'react';
import { PORTRAIT_SCAN } from '../catalog/cardArt';
import {
  CARD_OUTLINE,
  OrnamentLine,
  insetOutline,
  mirrored,
  scrollPath,
  starPath,
} from '../catalog/cardFace';
import type { Point } from '../map/mapLayout';
import './encounter_back.css';

/**
 * Where the encounter card back prints its parts, in portrait scan units (`PORTRAIT_SCAN`), as on
 * the card themes design (M3.10): an inner rule round the dark field, a whiplash scroll in each
 * corner, and the medallion in the middle, a ticked ring round an eight-pointed star whose centre
 * is left free for the deck's count (the header's round token sits there).
 */
export const ENCOUNTER_BACK = {
  rule: { inset: 14, corner: 8 },
  medallion: { outer: 96, inner: 86, ticks: 32, star: 78, starInner: 0.5, seat: 46 },
} as const;

/** The top left corner's scroll, from the left edge to its spiral under the top rule. */
const CORNER_SCROLL: [Point, Point, Point, Point] = [
  { x: 26, y: 96 },
  { x: 24, y: 48 },
  { x: 44, y: 28 },
  { x: 92, y: 32 },
];

/** A point turned upside down across the card's middle, for the lower corners. */
function flipped({ x, y }: Point): Point {
  return { x, y: PORTRAIT_SCAN.height - y };
}

/** The four corner scrolls, the top left one mirrored across and down the card. */
function cornerScrolls(): string[] {
  const variants: [(point: Point) => Point, 1 | -1][] = [
    [(point) => point, 1],
    [(point) => mirrored(point), -1],
    [(point) => flipped(point), -1],
    [(point) => flipped(mirrored(point)), 1],
  ];
  return variants.map(([place, side]) => {
    const [from, bend1, bend2, to] = CORNER_SCROLL.map(place) as [Point, Point, Point, Point];
    return scrollPath(from, bend1, bend2, to, { radius: 7, side, turns: 1.3 });
  });
}

/** The medallion's ring as two circles and the ticks between them, centred on the card. */
function ringPath(centre: Point): string {
  const { outer, inner, ticks } = ENCOUNTER_BACK.medallion;
  const circle = (radius: number) =>
    `M ${centre.x - radius} ${centre.y} a ${radius} ${radius} 0 1 0 ${2 * radius} 0 a ${radius} ${radius} 0 1 0 ${-2 * radius} 0`;
  const tickLines = Array.from({ length: ticks }, (_, index) => {
    const angle = (index / ticks) * 2 * Math.PI;
    const point = (radius: number) =>
      `${(centre.x + Math.cos(angle) * radius).toFixed(2)} ${(centre.y + Math.sin(angle) * radius).toFixed(2)}`;
    return `M ${point(inner)} L ${point(outer)}`;
  });
  return [circle(outer), circle(inner), ...tickLines].join(' ');
}

/**
 * The encounter card back in the card themes, in portrait scan units: our own drawing of the
 * printed back (`ENCOUNTER_BACK`, no FFG art) on its dark field, shaded lighter towards the
 * medallion. The header's encounter deck lays its count over it (`EncounterPiles`), so this is
 * decoration only (`aria-hidden`).
 */
export function EncounterBack() {
  const fieldId = useId();
  const clipId = useId();
  const { width, height } = PORTRAIT_SCAN;
  const centre = { x: width / 2, y: height / 2 };
  const { rule, medallion } = ENCOUNTER_BACK;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-face="encounter-back"
    >
      <defs>
        {/* The stylesheet colours the stops, like the faces' paper. */}
        <radialGradient id={fieldId} cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" />
          <stop offset="1" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={CARD_OUTLINE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path data-part="field" d={CARD_OUTLINE} fill={`url(#${fieldId})`} />
        {cornerScrolls().map((d) => (
          <OrnamentLine key={d} d={d} />
        ))}
      </g>
      <path data-part="rule" d={insetOutline(rule.inset, rule.corner)} />
      <path
        data-part="star"
        d={starPath(centre.x, centre.y, medallion.star, medallion.starInner)}
      />
      <path data-part="ring" d={ringPath(centre)} />
      <circle data-part="seat" cx={centre.x} cy={centre.y} r={medallion.seat} />
    </svg>
  );
}
