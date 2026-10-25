import { CARD } from '../map/mapLayout';

/**
 * Where the parts of an enemy card are, in SVG user units on a card the size of a location tile
 * (`CARD`, half a scan), placed as the printed enemy card has them: the name plate along the top
 * over a dark band, the fight, health and evade shields hanging from that band, the text box, the
 * arched type line with its medallion, the attack and the type plate, and the art below it.
 */
export const ENEMY_CARD = {
  width: CARD.short,
  height: CARD.long,
  corner: 8,
  plateEdge: 17,
  plateRise: 7,
  plateSwoop: 30,
  bandBottom: 27,
  gilt: 2,
  /**
   * The shields' centres, each in the middle of a third of the card so the numbers on them line up
   * in three equal columns: fight left, health in the middle (a size larger), evade right.
   */
  stats: { y: 33, fightX: 25, evadeX: 125, radius: 12, healthRadius: 15 },
  /** Traits, keywords and victory points, between the shields and the type line. */
  textBox: { x: 10, y: 50, width: 130, height: 70 },
  typeLine: { end: 128, rise: 5, medallion: 6, plateHalf: 21, plateTop: 130.5, notch: 2.5 },
  artTop: 139,
} as const;

const { width, height, corner: c } = ENEMY_CARD;
const middle = width / 2;

/** The top edge, round at both corners. */
const TOP_EDGE = `M 0 ${c} A ${c} ${c} 0 0 1 ${c} 0 H ${width - c} A ${c} ${c} 0 0 1 ${width} ${c}`;

/** The name plate's lower edge `drop` units lower, from its right end to its left one. */
function plateEdgeLeftwards(drop: number): string {
  const { plateEdge, plateRise, plateSwoop } = ENEMY_CARD;
  const y = plateEdge + drop;
  return [
    `C ${width - 6} ${y} ${width - 15} ${y} ${width - plateSwoop} ${y}`,
    `H ${plateSwoop} C 15 ${y} 6 ${y} 0 ${plateRise + drop}`,
  ].join(' ');
}

/** A circle centred on (`x`, `y`) as a path. */
function circle(x: number, y: number, r: number): string {
  return `M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} A ${r} ${r} 0 1 1 ${x - r} ${y} Z`;
}

/** A shield centred on (`x`, `y`): flat sides, a gently arched top and a point at the foot. */
function shield(x: number, y: number, r: number): string {
  const top = y - r * 0.75;
  const side = y + r * 0.15;
  return [
    `M ${x - r} ${top} Q ${x} ${y - r * 1.15} ${x + r} ${top} V ${side}`,
    `Q ${x + r * 0.9} ${y + r * 0.85} ${x} ${y + r * 1.15}`,
    `Q ${x - r * 0.9} ${y + r * 0.85} ${x - r} ${side} Z`,
  ].join(' ');
}

/** The type line's top edge `drop` units lower: an arch across the card, highest in the middle. */
function typeLineArch(drop: number): string {
  const { end, rise } = ENEMY_CARD.typeLine;
  return `M 0 ${end + drop} Q ${middle} ${end + drop - 2 * rise} ${width} ${end + drop}`;
}

const { stats, typeLine, artTop, bandBottom, gilt } = ENEMY_CARD;
const medallionY = typeLine.end - typeLine.rise;

/**
 * The frame's parts as SVG paths, each named for the stylesheet (`data-part` in EnemyCard): it
 * fills the plates, bands and shields and only strokes the gilt rules and the edge.
 */
export const ENEMY_FRAME = {
  card: `${TOP_EDGE} V ${height - c} A ${c} ${c} 0 0 1 ${width - c} ${height} H ${c} A ${c} ${c} 0 0 1 0 ${height - c} Z`,
  textBox: `M 0 ${bandBottom} H ${width} V ${typeLine.end} H 0 Z`,
  watermark: [circle(middle, 95, 22), circle(middle, 95, 19)].join(' '),
  band: `${TOP_EDGE} V ${bandBottom} H 0 Z`,
  plate: `${TOP_EDGE} ${plateEdgeLeftwards(0)} Z`,
  topGilt: [
    `M ${width} ${ENEMY_CARD.plateRise} ${plateEdgeLeftwards(0)}`,
    `M ${width} ${ENEMY_CARD.plateRise + gilt} ${plateEdgeLeftwards(gilt)}`,
    `M 0 ${bandBottom} H ${width}`,
  ].join(' '),
  fight: shield(stats.fightX, stats.y, stats.radius),
  health: shield(middle, stats.y, stats.healthRadius),
  evade: shield(stats.evadeX, stats.y, stats.radius),
  typeLine: `${typeLineArch(0)} V ${artTop} H 0 Z`,
  typeGilt: [typeLineArch(0), typeLineArch(gilt), `M 0 ${artTop} H ${width}`].join(' '),
  medallion: circle(middle, medallionY, typeLine.medallion),
  jewel: `M ${middle} ${medallionY - 2.5} L ${middle + 2.5} ${medallionY} L ${middle} ${medallionY + 2.5} L ${middle - 2.5} ${medallionY} Z`,
  typePlate: (() => {
    const { plateHalf, plateTop, notch } = typeLine;
    const y = (plateTop + artTop) / 2;
    const left = middle - plateHalf;
    const right = middle + plateHalf;
    return `M ${left} ${plateTop} H ${right} L ${right - notch} ${y} L ${right} ${artTop} H ${left} L ${left + notch} ${y} Z`;
  })(),
} as const;

/** The middle of the name plate, where the enemy's name sits. */
export const NAME_CENTRE = { x: middle, y: ENEMY_CARD.plateEdge / 2 + 1 } as const;

/** The middle of the type plate, where "Enemy" sits. */
export const TYPE_CENTRE = { x: middle, y: (typeLine.plateTop + artTop) / 2 } as const;
