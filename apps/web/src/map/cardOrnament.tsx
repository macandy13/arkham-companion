import { ART_WINDOW, CONTENT, TILE } from './mapLayout';

/** How far the ornament's rules sit inside the tile's edge and outside the art window. */
const RULE = { edge: 5, art: 3, corner: 4, bracket: 10, diamond: 3 } as const;

const centre = TILE.width / 2;
const artRight = ART_WINDOW.x + ART_WINDOW.width;
const artBottom = ART_WINDOW.y + ART_WINDOW.height;

/** A small diamond centred on (`x`, `y`), the ornament's recurring jewel. */
function diamond(x: number, y: number, size: number = RULE.diamond): string {
  return `M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`;
}

/** The outline of the rectangle (`x`, `y`, `width`, `height`) with its corners cut by `cut`. */
function cutRectangle(x: number, y: number, width: number, height: number, cut: number): string {
  const right = x + width;
  const bottom = y + height;
  return [
    `M ${x + cut} ${y} H ${right - cut} L ${right} ${y + cut} V ${bottom - cut}`,
    `L ${right - cut} ${bottom} H ${x + cut} L ${x} ${bottom - cut} V ${y + cut} Z`,
  ].join(' ');
}

/** The inner rule along the tile's edge, with cut corners and a jewel in each. */
const EDGE_RULE = cutRectangle(
  RULE.edge,
  RULE.edge,
  TILE.width - 2 * RULE.edge,
  TILE.height - 2 * RULE.edge,
  RULE.corner,
);
const EDGE_JEWELS = (() => {
  const near = RULE.edge + RULE.corner;
  const right = TILE.width - near;
  const bottom = TILE.height - near;
  const size = RULE.diamond - 1;
  return [
    diamond(near, near, size),
    diamond(right, near, size),
    diamond(near, bottom, size),
    diamond(right, bottom, size),
  ].join(' ');
})();

/**
 * A swirl in each corner inside the edge rule: two quarter arcs, a large and a small one, bowed
 * towards the corner, like the filigree in the corners of the game's book pages.
 */
const CORNER_SWIRLS = (() => {
  const near = RULE.edge + RULE.art;
  const far = { x: TILE.width - near, y: TILE.height - near };
  return [RULE.bracket, RULE.bracket / 2 + 1]
    .flatMap((r) => [
      `M ${near} ${near + r} A ${r} ${r} 0 0 1 ${near + r} ${near}`,
      `M ${far.x - r} ${near} A ${r} ${r} 0 0 1 ${far.x} ${near + r}`,
      `M ${near} ${far.y - r} A ${r} ${r} 0 0 0 ${near + r} ${far.y}`,
      `M ${far.x - r} ${far.y} A ${r} ${r} 0 0 0 ${far.x} ${far.y - r}`,
    ])
    .join(' ');
})();

/**
 * The name banner: a ribbon across the top with notched ends, behind the name and the edit
 * button, like the banner a printed location card carries its name on.
 */
function banner(inset: number): string {
  const left = CONTENT.inset + inset;
  const right = TILE.width - CONTENT.inset - inset;
  const top = RULE.edge + RULE.art + inset;
  const bottom = CONTENT.band - RULE.art - inset;
  const middle = (top + bottom) / 2;
  const notch = RULE.bracket / 2;
  return [
    `M ${left} ${top} H ${right} L ${right - notch} ${middle} L ${right} ${bottom}`,
    `H ${left} L ${left + notch} ${middle} Z`,
  ].join(' ');
}
const BANNER = banner(0);
/** A second rule just inside the banner's edge, so the ribbon reads as embossed. */
const BANNER_RULE = banner(2);

/** A second rule around the art window, and an L-shaped bracket on each of its corners. */
const ART_RULE = cutRectangle(
  ART_WINDOW.x - RULE.art,
  ART_WINDOW.y - RULE.art,
  ART_WINDOW.width + 2 * RULE.art,
  ART_WINDOW.height + 2 * RULE.art,
  RULE.art,
);
const ART_BRACKETS = (() => {
  const b = RULE.bracket;
  const left = ART_WINDOW.x - RULE.art;
  const right = artRight + RULE.art;
  const top = ART_WINDOW.y - RULE.art;
  const bottom = artBottom + RULE.art;
  return [
    `M ${left} ${top + b} V ${top} H ${left + b}`,
    `M ${right - b} ${top} H ${right} V ${top + b}`,
    `M ${left} ${bottom - b} V ${bottom} H ${left + b}`,
    `M ${right - b} ${bottom} H ${right} V ${bottom - b}`,
  ].join(' ');
})();

/** The pendant hanging from the banner into the art: a chevron with a jewel under it. */
const PENDANT = (() => {
  const half = CONTENT.pawnRadius;
  const top = CONTENT.band - RULE.art;
  return `M ${centre - half} ${top} L ${centre} ${top + half} L ${centre + half} ${top} Z`;
})();
const PENDANT_JEWEL = diamond(centre, CONTENT.band - RULE.art + CONTENT.pawnRadius + RULE.diamond);

/**
 * The divider under the art, like a book's chapter rule: two rules running out from a jewel to
 * small curls, between the art and the pieces' rows.
 */
const DIVIDER_Y = artBottom + RULE.art + 2 * RULE.diamond + 2;
const DIVIDER = (() => {
  const gap = 2 * RULE.diamond;
  const reach = ART_WINDOW.width / 2 - RULE.bracket;
  const curl = RULE.diamond;
  const y = DIVIDER_Y;
  return [
    `M ${centre - gap} ${y} H ${centre - reach}`,
    `q ${-curl} 0 ${-curl} ${-curl} q 0 ${-curl} ${curl} ${-curl} q ${curl / 2} 0 ${curl / 2} ${curl / 2}`,
    `M ${centre + gap} ${y} H ${centre + reach}`,
    `q ${curl} 0 ${curl} ${-curl} q 0 ${-curl} ${-curl} ${-curl} q ${-curl / 2} 0 ${-curl / 2} ${curl / 2}`,
  ].join(' ');
})();
const DIVIDER_JEWEL = diamond(centre, DIVIDER_Y);

/**
 * The text box under the divider, where the pieces stand: a rule with rounded upper corners, like
 * the box a printed card's text sits in.
 */
const TEXT_BOX = (() => {
  const left = CONTENT.inset;
  const right = TILE.width - CONTENT.inset;
  const top = DIVIDER_Y + 2 * RULE.diamond;
  const bottom = TILE.height - CONTENT.inset;
  const r = RULE.bracket;
  return [
    `M ${left} ${bottom} V ${top + r} A ${r} ${r} 0 0 1 ${left + r} ${top}`,
    `H ${right - r} A ${r} ${r} 0 0 1 ${right} ${top + r} V ${bottom} Z`,
  ].join(' ');
})();

/**
 * The ornament of a location tile drawn in the style of the printed cards and the game's books,
 * our own drawing (no FFG art): an inner rule along the edge with jewelled and swirled corners,
 * the embossed name banner, a bracketed second rule around the art window, a pendant hanging from
 * the banner, a chapter-rule divider under the art and the text box below it. It is decoration only (`aria-hidden`); `data-ornament` lets
 * the stylesheet ink it and hide it under a whole card scan. Each part is a `path` with
 * `data-part`, so the stylesheet can fill the banner, the box and the jewels and only stroke the rules.
 */
export function LocationOrnament() {
  return (
    <g aria-hidden="true" data-ornament="">
      <path data-part="box" d={TEXT_BOX} />
      <path
        data-part="rule"
        d={`${EDGE_RULE} ${CORNER_SWIRLS} ${ART_RULE} ${ART_BRACKETS} ${DIVIDER}`}
      />
      <path data-part="banner" d={BANNER} />
      <path data-part="rule" d={BANNER_RULE} />
      <path data-part="jewel" d={`${EDGE_JEWELS} ${PENDANT} ${PENDANT_JEWEL} ${DIVIDER_JEWEL}`} />
    </g>
  );
}
