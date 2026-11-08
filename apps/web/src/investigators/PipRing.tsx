import { range } from '@arkham/util';

/**
 * The widest gap between two pips, in degrees: wide enough to tell the pips apart, while a large
 * maximum takes narrower gaps so its pips keep some length.
 */
const MAX_GAP = 12;

/**
 * Health or sanity as a ring of pips around the printed heart or brain (`Stat` in
 * `InvestigatorBar`): one arc per point of the `max`, clockwise from the top, the last `taken` of
 * them marked `data-taken` (the damage or horror taken), so the stylesheet greys them and the ring
 * shows at a glance how much is left. Drawn in the symbol's SVG on a circle of `radius` round its
 * centre; decoration only, as the symbol's image says what is left. Both counts are whole points
 * of 0 or more; more taken than the maximum greys every pip.
 */
export function PipRing({ max, taken, radius }: { max: number; taken: number; radius: number }) {
  const step = 360 / max;
  const gap = Math.min(MAX_GAP, step / 3);
  return (
    <g data-pips="">
      {range(max).map((i) => (
        <path
          key={i}
          data-taken={i >= max - taken || undefined}
          d={arc(radius, i * step + gap / 2, (i + 1) * step - gap / 2)}
        />
      ))}
    </g>
  );
}

/** An arc of the circle of `radius` round the origin from `from` to `to` degrees, clockwise from the top. */
function arc(radius: number, from: number, to: number): string {
  const [x1, y1] = onCircle(radius, from);
  const [x2, y2] = onCircle(radius, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

function onCircle(radius: number, degrees: number): [number, number] {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [round(radius * Math.cos(angle)), round(radius * Math.sin(angle))];
}

/** Keeps the path short: a hundredth of a unit is far below a pixel at any size the symbol shows. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
