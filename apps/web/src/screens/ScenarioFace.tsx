import { useId } from 'react';
import { PORTRAIT_SCAN } from '../catalog/cardArt';
import {
  CARD_OUTLINE,
  OrnamentLine,
  insetOutline,
  mirrored,
  scrollPath,
} from '../catalog/cardFace';
import type { Point } from '../map/mapLayout';
import './scenario_face.css';

/**
 * Where a scenario reference card prints its frame, in portrait scan units (`PORTRAIT_SCAN`),
 * measured on the ArkhamDB scan of The Gathering's reference card (the card themes design,
 * M3.10): the dark frame with its inner rule, the dark band across the top with the half wheel
 * hanging from its middle and a serpent coiling in from each corner, and the set medallion between
 * two rules under it. The title, the difficulty and the rows below are HTML laid over the drawing
 * (game.css), since they wrap and the title is the screen's heading.
 */
export const SCENARIO_FACE = {
  frame: 12,
  rule: { inset: 9, corner: 6 },
  band: 34,
  wheel: { y: 4, outer: 42, inner: 31, spokes: 12 },
  medallion: { x: 150, y: 62, radius: 8, rule: 30, gap: 14 },
} as const;

/** The left serpent's body, from the frame's corner to its coiled head by the wheel, as printed. */
const SERPENT: [Point, Point, Point, Point] = [
  { x: 10, y: 44 },
  { x: 30, y: 14 },
  { x: 70, y: 12 },
  { x: 98, y: 26 },
];

/** The frame's parts as SVG paths in scan units, each named for the stylesheet. */
function framePaths() {
  const { width } = PORTRAIT_SCAN;
  const middle = width / 2;
  const { band, wheel, medallion } = SCENARIO_FACE;
  const spokes = Array.from({ length: wheel.spokes + 1 }, (_, index) => {
    const angle = (index / wheel.spokes) * Math.PI;
    const point = (radius: number) =>
      `${(middle + Math.cos(angle) * radius).toFixed(2)} ${(wheel.y + Math.sin(angle) * radius).toFixed(2)}`;
    return `M ${point(wheel.inner)} L ${point(wheel.outer)}`;
  }).join(' ');
  const halfCircle = (radius: number) =>
    `M ${middle - radius} ${wheel.y} A ${radius} ${radius} 0 0 0 ${middle + radius} ${wheel.y}`;
  const serpent = (points: Point[], side: 1 | -1) => {
    const [from, bend1, bend2, to] = points as [Point, Point, Point, Point];
    return scrollPath(from, bend1, bend2, to, { radius: 5, side, turns: 1.2 });
  };
  const ruleY = medallion.y + 2;
  // Where the wheel's rim meets the band's lower edge, so the band hangs round the wheel.
  const reach = Math.sqrt(wheel.outer ** 2 - (band - wheel.y) ** 2);
  const [right, left] = [middle + reach, middle - reach].map((x) => x.toFixed(2));
  return {
    band: `M 0 0 H ${width} V ${band} H ${right} A ${wheel.outer} ${wheel.outer} 0 0 1 ${left} ${band} H 0 Z`,
    wheel: `${halfCircle(wheel.outer - 2)} ${halfCircle(wheel.inner)} ${spokes}`,
    serpents: [
      serpent(SERPENT, 1),
      serpent(
        SERPENT.map((point) => mirrored(point)),
        -1,
      ),
    ],
    rules: [
      `M ${middle - medallion.gap - medallion.rule} ${ruleY} H ${middle - medallion.gap}`,
      `M ${middle + medallion.gap} ${ruleY} H ${middle + medallion.gap + medallion.rule}`,
    ].join(' '),
  };
}

/**
 * The frame of a scenario reference card in the Exact card theme, in portrait scan units: our own
 * drawing of the printed one (`SCENARIO_FACE`, no FFG art) on its paper. The card lays its title,
 * difficulty and rows over it in HTML (GameHeader `ScenarioCard`), so this is decoration only
 * (`aria-hidden`).
 */
export function ScenarioFace() {
  const paperId = useId();
  const clipId = useId();
  const { width, height } = PORTRAIT_SCAN;
  const paths = framePaths();
  const { medallion, rule } = SCENARIO_FACE;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-face="scenario"
    >
      <defs>
        {/* The stylesheet colours the stops, like the other faces' paper. */}
        <radialGradient id={paperId} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0" />
          <stop offset="1" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={CARD_OUTLINE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path data-part="paper" d={CARD_OUTLINE} fill={`url(#${paperId})`} />
        <path data-part="band" d={paths.band} />
        <path data-part="wheel" d={paths.wheel} />
        {paths.serpents.map((d) => (
          <OrnamentLine key={d} d={d} />
        ))}
        <path data-part="frame" d={CARD_OUTLINE} />
      </g>
      <path data-part="rule" d={insetOutline(rule.inset, rule.corner)} />
      <path data-part="rule" d={paths.rules} />
      <circle data-part="medallion" cx={medallion.x} cy={medallion.y} r={medallion.radius} />
    </svg>
  );
}
