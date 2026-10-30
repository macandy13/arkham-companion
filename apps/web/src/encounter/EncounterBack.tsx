import { useId } from 'react';
import { PORTRAIT_SCAN } from '../catalog/cardArt';
import { CARD_OUTLINE, mirrored, scrollPath, starPath, tapered } from '../catalog/cardFace';
import type { Point } from '../map/mapLayout';
import './encounter_back.css';

/**
 * Where the encounter card back prints its picture, in portrait scan units (`PORTRAIT_SCAN`), as
 * on the printed back: a night sky hanging from the top edge as a dark half disc with stars, in it
 * an eye in a triangle with pale rays writhing out round it, beams of light falling from the eye
 * down the card, a dark body standing in them with tentacles curling up on both sides, and the
 * ground across the foot. The deck's count sits on the body (the header's round token).
 */
export const ENCOUNTER_BACK = {
  sky: { x: 150, y: -25, radius: 155 },
  eye: { x: 150, y: 114, glow: 22, rays: 21, rayFrom: 24, rayTo: 98, triangle: 17, pupil: 6 },
  beams: { count: 13, spread: 130 },
  body: { top: 150, topWidth: 44, footWidth: 128 },
  ground: { y: 352, rise: 34 },
  tentacleWidth: 26,
} as const;

/** The stars in the night sky: centre and radius. */
const STARS: readonly (Point & { radius: number })[] = [
  { x: 36, y: 36, radius: 6 },
  { x: 62, y: 98, radius: 4 },
  { x: 26, y: 72, radius: 3 },
  { x: 258, y: 28, radius: 5 },
  { x: 246, y: 92, radius: 6 },
  { x: 276, y: 62, radius: 3 },
];

/**
 * The tentacles on the left, each as a whiplash scroll from its root by the body to its curled
 * tip; the right ones mirror them. Listed back to front, as they overlap.
 */
const TENTACLES: readonly { curve: [Point, Point, Point, Point]; curl: number; side: 1 | -1 }[] = [
  {
    curve: [
      { x: 128, y: 262 },
      { x: 104, y: 238 },
      { x: 98, y: 202 },
      { x: 116, y: 180 },
    ],
    curl: 6,
    side: -1,
  },
  {
    curve: [
      { x: 124, y: 338 },
      { x: 78, y: 312 },
      { x: 56, y: 252 },
      { x: 86, y: 214 },
    ],
    curl: 9,
    side: -1,
  },
  {
    curve: [
      { x: 118, y: 398 },
      { x: 56, y: 386 },
      { x: 14, y: 316 },
      { x: 40, y: 262 },
    ],
    curl: 11,
    side: -1,
  },
  {
    curve: [
      { x: 112, y: 430 },
      { x: 52, y: 430 },
      { x: 8, y: 392 },
      { x: 18, y: 352 },
    ],
    curl: 8,
    side: -1,
  },
];

/** The back's parts as SVG paths in scan units, each named for the stylesheet. */
function backPaths() {
  const { width, height } = PORTRAIT_SCAN;
  const { eye, beams, body, ground, tentacleWidth } = ENCOUNTER_BACK;
  const around = (angle: number, radius: number): Point => ({
    x: eye.x + Math.cos(angle) * radius,
    y: eye.y + Math.sin(angle) * radius,
  });
  // The rays fan over the eye's upper half, each bending one way then the other like a flame.
  const rays = Array.from({ length: eye.rays }, (_, index) => {
    const angle = Math.PI + ((index + 0.5) / eye.rays) * Math.PI;
    const bend = 0.28 * (index % 2 === 0 ? 1 : -1);
    return scrollPath(
      around(angle, eye.rayFrom),
      around(angle + bend, eye.rayFrom + 20),
      around(angle - bend, eye.rayTo - 20),
      around(angle, eye.rayTo),
      { radius: 4, side: index % 2 === 0 ? 1 : -1, turns: 1.2 },
    );
  });
  const apex = { x: eye.x, y: eye.y + eye.triangle * 0.6 };
  const beamLines = Array.from({ length: beams.count }, (_, index) => {
    const x = width / 2 - beams.spread + (index / (beams.count - 1)) * 2 * beams.spread;
    return `M ${apex.x} ${apex.y} L ${x} ${height}`;
  }).join(' ');
  const tentacles = TENTACLES.flatMap(({ curve, curl, side }) => {
    const [from, bend1, bend2, to] = curve;
    const left = scrollPath(from, bend1, bend2, to, { radius: curl, side, turns: 1.4 });
    const [rFrom, rBend1, rBend2, rTo] = curve.map((point) => mirrored(point)) as typeof curve;
    const right = scrollPath(rFrom, rBend1, rBend2, rTo, {
      radius: curl,
      side: side === 1 ? -1 : 1,
      turns: 1.4,
    });
    return [tapered(left, tentacleWidth), tapered(right, tentacleWidth)];
  });
  const middle = width / 2;
  return {
    ground: `M 0 ${ground.y} Q ${middle} ${ground.y - 2 * ground.rise} ${width} ${ground.y} V ${height} H 0 Z`,
    groundLine: `M 0 ${ground.y + 22} Q ${middle} ${ground.y + 22 - 2 * ground.rise} ${width} ${ground.y + 22}`,
    light: `M ${apex.x} ${apex.y} L ${middle + beams.spread} ${height} H ${middle - beams.spread} Z`,
    beams: beamLines,
    body: [
      `M ${middle - body.topWidth / 2} ${body.top}`,
      `Q ${middle} ${body.top - 14} ${middle + body.topWidth / 2} ${body.top}`,
      `L ${middle + body.footWidth / 2} ${height} H ${middle - body.footWidth / 2} Z`,
    ].join(' '),
    tentacles,
    rays,
    triangle: [
      `M ${eye.x} ${eye.y - eye.triangle}`,
      `L ${eye.x + eye.triangle} ${eye.y + eye.triangle * 0.6}`,
      `H ${eye.x - eye.triangle} Z`,
    ].join(' '),
  };
}

/**
 * The encounter card back in the card themes, in portrait scan units: our own drawing after the
 * printed back (`ENCOUNTER_BACK`, no FFG art) on its aged paper. The header's encounter deck lays
 * its count over it (`EncounterPiles`), so this is decoration only (`aria-hidden`).
 */
export function EncounterBack() {
  const paperId = useId();
  const clipId = useId();
  const { width, height } = PORTRAIT_SCAN;
  const { sky, eye } = ENCOUNTER_BACK;
  const paths = backPaths();
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-face="encounter-back"
    >
      <defs>
        {/* The stylesheet colours the stops, like the faces' paper. */}
        <radialGradient id={paperId} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" />
          <stop offset="1" />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={CARD_OUTLINE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path data-part="paper" d={CARD_OUTLINE} fill={`url(#${paperId})`} />
        <path data-part="light" d={paths.light} />
        <path data-part="beams" d={paths.beams} />
        <path data-part="ground" d={paths.ground} />
        <path data-part="ground-line" d={paths.groundLine} />
        <path data-part="body" d={paths.body} />
        {paths.tentacles.map((d) => (
          <path key={d} data-part="tentacle" d={d} />
        ))}
        <circle data-part="sky" cx={sky.x} cy={sky.y} r={sky.radius} />
        {STARS.map(({ x, y, radius }) => (
          <path key={`${x} ${y}`} data-part="star" d={starPath(x, y, radius)} />
        ))}
        <circle data-part="glow" cx={eye.x} cy={eye.y} r={eye.glow} />
        {paths.rays.map((d) => (
          <path key={d} data-part="ray" d={d} />
        ))}
        <path data-part="triangle" d={paths.triangle} />
        <path data-part="pupil" d={starPath(eye.x, eye.y + 2, eye.pupil)} />
      </g>
    </svg>
  );
}
