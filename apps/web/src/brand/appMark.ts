/**
 * The app mark (MD.4, design language "Screens"): a brass ring with the zodiac's 36 ticks and an
 * eight-point star, drawn on a 100 × 100 grid. One geometry for the icon files
 * `scripts/app_icon.ts` writes and the screens that draw the mark, so it is the same everywhere.
 * It has no imports, so `node scripts/app_icon.ts` can load it without a bundler.
 */

/** Side of the square the mark is drawn in. */
export const MARK_SIZE = 100;

/** One of the ring's ticks, from the inner ring outwards; every third one is long. */
export interface MarkTick {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly long: boolean;
}

/** How many ticks the ring has: one per ten degrees, as on a zodiac dial. */
export const MARK_TICK_COUNT = 36;

const CENTRE = MARK_SIZE / 2;
const INNER_RADIUS = 38;
const SHORT_RADIUS = 42;
const OUTER_RADIUS = 46;

/** Rounded to a hundredth, so the files the script writes stay short and stable. */
const round = (value: number) => Math.round(value * 100) / 100;

/** The ticks clockwise from the top, so the loading ring fills the way a clock hand turns. */
export const MARK_TICKS: readonly MarkTick[] = Array.from({ length: MARK_TICK_COUNT }, (_, i) => {
  const angle = ((i * 10 - 90) * Math.PI) / 180;
  const long = i % 3 === 0;
  const outer = long ? OUTER_RADIUS : SHORT_RADIUS;
  return {
    x1: round(CENTRE + INNER_RADIUS * Math.cos(angle)),
    y1: round(CENTRE + INNER_RADIUS * Math.sin(angle)),
    x2: round(CENTRE + outer * Math.cos(angle)),
    y2: round(CENTRE + outer * Math.sin(angle)),
    long,
  };
});

/** The rings' radii: the outer rim and the inner ring the ticks stand on. */
export const MARK_RINGS = { outer: OUTER_RADIUS, inner: INNER_RADIUS } as const;

/**
 * The icon's colours: the night table and the brass of the playmat (tokens.css
 * `--color-background`, `--color-brass-light`). The manifest takes the ground too, so the splash
 * screen and the icons can't drift apart.
 */
export const MARK_COLOURS = { ground: '#0b1614', ink: '#d9b86e' } as const;

/** The star's four long points. */
export const MARK_STAR = 'M50 22 L55 45 L78 50 L55 55 L50 78 L45 55 L22 50 L45 45 Z';
/** The four short points between the long ones, drawn rotated by 45° and fainter. */
export const MARK_STAR_SHORT = 'M50 34 L53 47 L66 50 L53 53 L50 66 L47 53 L34 50 L47 47 Z';

/** The small hole at the star's centre, cut from both stars (`fill-rule="evenodd"`). */
export const MARK_EYE = 'M54 50 A4 4 0 1 0 46 50 A4 4 0 1 0 54 50 Z';

/** Line widths: the outer rim, the inner ring, a long tick and a short one. */
export const MARK_STROKES = { rim: 1.6, ring: 1, long: 1.2, short: 0.7 } as const;

/**
 * The mark as a standalone SVG document in `ink` on a `ground` square, for the icon files.
 * `inset` shrinks the mark into the square's middle, as a maskable icon's safe zone needs.
 */
export function appMarkSvg({
  ink,
  ground,
  inset = 0,
}: {
  ink: string;
  ground: string;
  inset?: number;
}): string {
  const scale = 1 - 2 * inset;
  const offset = MARK_SIZE * inset;
  const ticks = MARK_TICKS.map(
    (t) =>
      `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke-width="${t.long ? MARK_STROKES.long : MARK_STROKES.short}"/>`,
  ).join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}">`,
    `<rect width="${MARK_SIZE}" height="${MARK_SIZE}" fill="${ground}"/>`,
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${ink}">`,
    `<circle cx="${CENTRE}" cy="${CENTRE}" r="${OUTER_RADIUS}" stroke-width="${MARK_STROKES.rim}"/>`,
    `<circle cx="${CENTRE}" cy="${CENTRE}" r="${INNER_RADIUS}" stroke-width="${MARK_STROKES.ring}"/>`,
    ticks,
    `<path d="${MARK_STAR} ${MARK_EYE}" fill="${ink}" fill-rule="evenodd" stroke="none"/>`,
    `<path d="${MARK_STAR_SHORT} ${MARK_EYE}" transform="rotate(45 ${CENTRE} ${CENTRE})" fill="${ink}" fill-rule="evenodd" stroke="none" opacity=".55"/>`,
    `</g></svg>`,
  ].join('');
}
