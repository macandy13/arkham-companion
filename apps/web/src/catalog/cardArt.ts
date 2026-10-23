/**
 * An area of a card scan, in fractions of the scan's width and height from its top left corner,
 * so it holds for every scan size ArkhamDB serves (about 300 × 419, some 750 × 1050).
 */
export interface ScanArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The size a portrait card scan is drawn at before its art is cut out, in SVG user units: the
 * usual ArkhamDB scan size. Larger scans have the same 5 : 7 shape, so they stretch to it by
 * less than 1 %.
 */
export const PORTRAIT_SCAN = { width: 300, height: 419 } as const;

/**
 * Where a location card's art is, on either side, without the printed template around it: below
 * the name band's ornament, above the location icon over the shroud and clue circles, and in from
 * the card's edge (the art runs on behind them from about 7 % to 52 % of the height). It sits there
 * on every location of every cycle (checked on real scans, M3.12c in the M3 task file); the
 * "frames" look cuts it out. Rings some cards draw across their art stay, as they are part of it.
 */
export const LOCATION_ART: ScanArea = { x: 0.02, y: 0.125, width: 0.96, height: 0.33 };

/**
 * The SVG `viewBox` that shows `area` of a portrait scan drawn at `PORTRAIT_SCAN` size; with
 * `preserveAspectRatio="xMidYMid slice"` the art fills its window and keeps its proportions.
 * Whole units are close enough for a crop and keep the attribute short.
 */
export function portraitArtViewBox(area: ScanArea): string {
  const { width, height } = PORTRAIT_SCAN;
  return [area.x * width, area.y * height, area.width * width, area.height * height]
    .map(Math.round)
    .join(' ');
}
