/** The stroke of the n-th tally mark, jittered a little so the marks look drawn by hand. */
function wobble(n: number): number {
  return ((n * 37) % 7) / 3 - 1;
}

/** Width of one hand-drawn stroke and of the gap that closes a group of five, in viewBox units. */
const STROKE_STEP = 7;
const GROUP_GAP = 8;

/**
 * A count kept the way players keep trauma on the paper log: tally marks, four strokes crossed by
 * a fifth. Drawn as an image named by `label` (e.g. "Physical trauma: 2"), since the strokes
 * carry no text.
 */
export function Tally({ count, label }: { readonly count: number; readonly label: string }) {
  let x = 4;
  let path = '';
  for (let i = 0; i < count; i++) {
    if (i % 5 === 4) {
      path += `M${x - 4 * STROKE_STEP - 2 + wobble(i)} 19L${x - 2} 6`;
      x += GROUP_GAP;
      continue;
    }
    path += `M${x + wobble(i)} 3L${x + wobble(i + 3) * 0.6} 23`;
    x += STROKE_STEP;
  }
  return (
    <svg viewBox={`0 0 ${Math.max(x, 1)} 26`} role="img" aria-label={label}>
      <path d={path} />
    </svg>
  );
}
