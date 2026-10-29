import { PORTRAIT_SCAN } from '../catalog/cardArt';
import { mirrored, scrollPath, starPath, type ScrollEnd } from '../catalog/cardFace';
import type { Point } from '../map/mapLayout';

/**
 * Where an enemy card prints its parts, in scan units (`PORTRAIT_SCAN`), measured on the ArkhamDB
 * scans of The Gathering's enemies and checked by laying the drawing over them (the card themes
 * design, M3.10): the name plate along the top, the frame's bands hanging from it, the fight,
 * health and evade chevrons on them, the lens of paper with the traits, keywords and victory,
 * the arc that closes the lens over the art, and on it the attack beside the set medallion.
 */
export const ENEMY_FACE = {
  plateBottom: 24,
  name: { x: 150, y: 13, width: 196 },
  /** The lens: the paper from the top down to its arc, which sags `sag` below its ends. */
  lens: { edge: 180, radius: 200 },
  art: { y: 130, height: 273 },
  /** Each chevron: its left and right end, its top, its tip, and where its number sits. */
  fight: { left: 57, right: 137, top: 43, tip: 79, number: 54 },
  evade: { left: 163, right: 243, top: 43, tip: 79, number: 54 },
  health: { left: 99, right: 201, top: 25, tip: 82, number: 54 },
  /** The skill each is tested against, on its outer side, and the damage on the health. */
  fightIcon: { x: 64, y: 70 },
  evadeIcon: { x: 236, y: 70 },
  statIcon: 16,
  damage: { x: 166, y: 72 },
  /** The text: the traits line, then the keywords, then the victory points above the arc. */
  traits: { x: 16, y: 86, width: 268, height: 18 },
  text: { x: 30, y: 106, width: 240, height: 60 },
  victory: { x: 50, y: 196, width: 200, height: 18 },
  medallion: { x: 148, y: 226, radius: 14, plateWidth: 50 },
  /** The attack's hearts left of the medallion and brains right of it, the nearest first. */
  attack: { heartX: 114, brainX: 187, y: 232, step: 18, stagger: 5 },
  heartScale: 0.52,
  brainScale: 0.62,
  footer: 16,
} as const;

const { width, height } = PORTRAIT_SCAN;
const { lens, plateBottom } = ENEMY_FACE;

/** The lens's arc, from its right end to its left one, `drop` lower. */
function lensArc(drop: number): string {
  const y = lens.edge + drop;
  return `M ${width} ${y} A ${lens.radius} ${lens.radius} 0 0 1 0 ${y}`;
}

/** A chevron from `left` to `right` along `top` to a point at `tip`, `inset` smaller all round. */
function chevron(
  { left, right, top, tip }: { left: number; right: number; top: number; tip: number },
  inset: number,
  tipInset: number,
): string {
  const middle = (left + right) / 2;
  return `M ${left + inset} ${top + inset / 2} H ${right - inset} L ${middle} ${tip - tipInset} Z`;
}

/** The scrolls on the left of the frame, as printed: each mirrored on the right. */
const SCROLLS: readonly [Point, Point, Point, Point, ScrollEnd][] = [
  [
    { x: 62, y: 40 },
    { x: 40, y: 36 },
    { x: 16, y: 40 },
    { x: 14, y: 62 },
    { radius: 10, side: 1, turns: 1.3 },
  ],
  [
    { x: 88, y: 44 },
    { x: 70, y: 52 },
    { x: 46, y: 48 },
    { x: 40, y: 72 },
    { radius: 7, side: -1, turns: 1.4 },
  ],
  [
    { x: 0, y: 34 },
    { x: 22, y: 30 },
    { x: 36, y: 22 },
    { x: 30, y: 12 },
    { radius: 5, side: -1, turns: 1.3 },
  ],
  [
    { x: 4, y: 100 },
    { x: 14, y: 96 },
    { x: 26, y: 90 },
    { x: 22, y: 80 },
    { radius: 5, side: 1, turns: 1.2 },
  ],
];

/**
 * The frame's parts as SVG paths in scan units, each named for the stylesheet (`data-part` in
 * EnemyCard): the art's window, the lens and its rules, the bands, the stars, the name plate and
 * its rules, the scrolls (`OrnamentLine`s), the three layers of each chevron, the star medallion
 * on the health and the footer strip.
 */
export const ENEMY_FRAME = {
  art: `M 0 ${ENEMY_FACE.art.y} H ${width} V ${ENEMY_FACE.art.y + ENEMY_FACE.art.height} H 0 Z`,
  lens: `M 0 0 H ${width} V ${lens.edge} A ${lens.radius} ${lens.radius} 0 0 1 0 ${lens.edge} Z`,
  watermark: starPath(width / 2, 140, 70, 0.55, 5),
  lensSetting: lensArc(0),
  lensRule: lensArc(4),
  lensInner: lensArc(9),
  band: `M 0 26 H ${width} V 60 C 280 50 270 40 250 38 L 50 38 C 30 40 20 50 0 60 Z`,
  wing: `M 0 26 H ${width} V 104 C 288 100 272 88 262 70 L 38 70 C 28 88 12 100 0 104 Z`,
  stars: [
    starPath(30, 58, 4.5),
    starPath(42, 52, 3),
    starPath(270, 58, 4.5),
    starPath(258, 52, 3),
  ].join(' '),
  plate: `M 0 0 H ${width} V ${plateBottom} H 0 Z`,
  plateSetting: `M 0 ${plateBottom + 0.5} H ${width}`,
  plateRule: `M 0 ${plateBottom + 4.5} H ${width}`,
  scrolls: SCROLLS.flatMap(([from, bend1, bend2, to, end]) => [
    scrollPath(from, bend1, bend2, to, end),
    scrollPath(mirrored(from), mirrored(bend1), mirrored(bend2), mirrored(to), {
      ...end,
      side: end.side === 1 ? -1 : 1,
    }),
  ]),
  ...(Object.fromEntries(
    (['fight', 'evade', 'health'] as const).map((stat) => [
      stat,
      {
        setting: chevron(ENEMY_FACE[stat], 0, 0),
        rim: chevron(ENEMY_FACE[stat], 3, 4),
        fill: chevron(ENEMY_FACE[stat], 7, 10),
      },
    ]),
  ) as Record<'fight' | 'evade' | 'health', { setting: string; rim: string; fill: string }>),
  healthStar: starPath(width / 2, 30, 7.5, 0.35),
  sideStars: [starPath(0, lens.edge, 20, 0.45), starPath(width, lens.edge, 20, 0.45)].join(' '),
  footer: `M 0 ${height - ENEMY_FACE.footer} H ${width} V ${height} H 0 Z`,
} as const;
