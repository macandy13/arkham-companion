import {
  MARK_EYE,
  MARK_RINGS,
  MARK_SIZE,
  MARK_STAR,
  MARK_STAR_SHORT,
  MARK_STROKES,
  MARK_TICK_COUNT,
  MARK_TICKS,
} from './appMark';
import './mark.css';

const CENTRE = MARK_SIZE / 2;
const VIEW_BOX = `0 0 ${MARK_SIZE} ${MARK_SIZE}`;

/** Props of `Ticks`. */
interface TicksProps {
  /** How many ticks are lit: the first ones, clockwise from the top. */
  readonly lit: number;
}

/** The ring's ticks; the first `lit` are lit and the one after them is next. */
function Ticks({ lit }: TicksProps) {
  return (
    <>
      {MARK_TICKS.map((tick, i) => (
        <line
          key={i}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          strokeWidth={tick.long ? MARK_STROKES.long : MARK_STROKES.short}
          data-lit={i < lit || undefined}
          data-next={i === lit || undefined}
        />
      ))}
    </>
  );
}

/** Props of `AppMark`. */
export interface AppMarkProps {
  /** How many of the 36 ticks are lit; all of them when left out. */
  readonly lit?: number;
}

/**
 * The app mark (MD.4) drawn in the current colour, from the geometry the icon files share
 * (`appMark.ts`). The loading screen lights its ticks one step at a time (`lit`); CSS dims the
 * unlit ones and lets the next one pulse unless the player asked for reduced motion.
 */
export function AppMark({ lit = MARK_TICK_COUNT }: AppMarkProps) {
  return (
    <svg viewBox={VIEW_BOX} data-mark="" aria-hidden="true">
      <circle cx={CENTRE} cy={CENTRE} r={MARK_RINGS.outer} strokeWidth={MARK_STROKES.rim} />
      <circle cx={CENTRE} cy={CENTRE} r={MARK_RINGS.inner} strokeWidth={MARK_STROKES.ring} />
      <Ticks lit={lit} />
      <path d={`${MARK_STAR} ${MARK_EYE}`} fillRule="evenodd" />
      <path
        d={`${MARK_STAR_SHORT} ${MARK_EYE}`}
        transform={`rotate(45 ${CENTRE} ${CENTRE})`}
        fillRule="evenodd"
        data-short=""
      />
    </svg>
  );
}

/** A third of the ring lit, so its turning reads as a hand going round. */
const SPINNER_LIT = MARK_TICK_COUNT / 3;

/**
 * The mark's ticks at the size of a line of text, as the inline spinner beside "Loading …" on
 * paper (MD.4b). At that size the rims would close the ring, so only the ticks are drawn, made
 * bold by CSS. It turns one tick at a time; with reduced motion it stands still.
 */
export function Spinner() {
  return (
    <svg viewBox={VIEW_BOX} data-spinner="" aria-hidden="true">
      <Ticks lit={SPINNER_LIT} />
    </svg>
  );
}
