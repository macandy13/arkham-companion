import type { Point } from '../map/mapLayout';
import { PORTRAIT_SCAN } from './cardArt';

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
 * What a count circle counts: the stylesheet colours each like its token in the game. Only clues
 * so far; the agenda's doom and the enemy's and investigator's damage and horror join with their
 * card faces.
 */
export type CountKind = 'clue';

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
 * The round set medallion on its plate, in scan units, as every encounter card prints it on its
 * type line: a dark ring, the pale medallion with an inner ring (where the encounter set's icon
 * goes once the app has them, M3.10m), and under it the notched plate naming the card's `type`,
 * `plateWidth` wide. Decoration and the type word only, so it is no image of its own.
 */
export function SetMedallion({
  centre: { x, y },
  radius,
  plateWidth,
  type,
}: {
  centre: Point;
  radius: number;
  plateWidth: number;
  type: string;
}) {
  const top = y + radius + 1;
  const bottom = top + PLATE_HEIGHT;
  const middle = (top + bottom) / 2;
  const left = x - plateWidth / 2;
  const right = x + plateWidth / 2;
  return (
    <g data-medallion="">
      <circle data-part="setting" cx={x} cy={y} r={radius + 2.5} />
      <circle data-part="medallion" cx={x} cy={y} r={radius} />
      <circle data-part="inner" cx={x} cy={y} r={radius - 3.5} />
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
