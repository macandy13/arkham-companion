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

/** The size a landscape card scan (an agenda or act) is drawn at, `PORTRAIT_SCAN` turned. */
export const LANDSCAPE_SCAN = { width: 419, height: 300 } as const;

/**
 * Where a location card's art is, on either side: the whole width from just under the top edge
 * to a little below the shroud and clue circles (about 6 % to 56 % of the height), the same area
 * of the card the tile's art window covers (`ART_WINDOW`, a tile being half a scan), so the parts
 * of the printed template inside it (the pendant under the name, the location icon and the
 * circles) fall under the tile's own ornament. It sits there on every location of every cycle
 * (checked on real scans, M3.12c in the M3 task file). Rings some cards draw across their art
 * stay, as they are part of it.
 */
export const LOCATION_ART: ScanArea = { x: 0, y: 0.057, width: 1, height: 0.506 };

/**
 * Where an enemy card's art is: the whole width from under its traits (about 31 % of the height)
 * to above the artist's credit at the foot, the area the enemy face's art window covers
 * (`ENEMY_FACE.art`), so the printed lens, stats and text fall under the face's own.
 */
export const ENEMY_ART: ScanArea = { x: 0, y: 130 / 419, width: 1, height: 273 / 419 };

/**
 * Where a treachery card's art is: the whole width from the top edge down to the beaded band over
 * its page (about 58 % of the height), the area the treachery face's keyhole frame lies over
 * (`TREACHERY_FACE.art`), so the printed frame and medallion fall under the face's own.
 */
export const TREACHERY_ART: ScanArea = { x: 0, y: 0, width: 1, height: 244 / 419 };

/**
 * Where an agenda's art is on its landscape scan: the left of the card, from the top edge to the
 * foot, beside the open book the agenda face draws over the rest (`BOOK_FACE.art`). An act prints
 * the same layout mirrored (`ACT_ART`).
 */
export const AGENDA_ART: ScanArea = { x: 0, y: 0, width: 174 / 419, height: 1 };

/** Where an act's art is on its landscape scan: the agenda's (`AGENDA_ART`) mirrored, on the right. */
export const ACT_ART: ScanArea = { x: 245 / 419, y: 0, width: 174 / 419, height: 1 };

/**
 * The square round an investigator's face on the landscape scan of their card's front, for the
 * pawn's avatar: about a quarter in from the left and a third down, a little over a quarter of
 * the card's width across (measured on Roland Banks and the other Core Set investigators).
 */
export const INVESTIGATOR_AVATAR: ScanArea = {
  x: 45 / 419,
  y: 56 / 300,
  width: 110 / 419,
  height: 110 / 300,
};

/**
 * The square round the figure in an enemy card's art, for its token's avatar: half the card's
 * width across, centred about four fifths of the way down (79 %), where the art shows the enemy
 * on every Core Set enemy.
 */
export const ENEMY_AVATAR: ScanArea = {
  x: 75 / 300,
  y: 256 / 419,
  width: 150 / 300,
  height: 150 / 419,
};

/**
 * The SVG `viewBox` that shows `area` of a portrait scan drawn at `PORTRAIT_SCAN` size (or of a
 * landscape one at `LANDSCAPE_SCAN`, given as `scan`); with `preserveAspectRatio="xMidYMid slice"`
 * the art fills its window and keeps its proportions. Whole units are close enough for a crop and
 * keep the attribute short.
 */
export function artViewBox(
  area: ScanArea,
  scan: { width: number; height: number } = PORTRAIT_SCAN,
): string {
  const { width, height } = scan;
  return [area.x * width, area.y * height, area.width * width, area.height * height]
    .map(Math.round)
    .join(' ');
}
