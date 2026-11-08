import type { LocationSymbol } from '@arkham/engine';
import { assertNever } from '@arkham/util';

/**
 * The outline of a connection symbol (`LocationSymbol`) as SVG path data, centred on the origin
 * and `s` units from its centre to its edge: simple shapes of our own, which the stylesheet
 * strokes in the light colour of the printed corner disc, rather than the printed glyphs.
 */
export function connectionGlyph(symbol: LocationSymbol, s: number): string {
  switch (symbol) {
    case 'circle':
      return `M ${-s} 0 A ${s} ${s} 0 1 0 ${s} 0 A ${s} ${s} 0 1 0 ${-s} 0 Z`;
    case 'square':
      return `M ${-s} ${-s} H ${s} V ${s} H ${-s} Z`;
    case 'triangle':
      return `M 0 ${-s} L ${s} ${s} H ${-s} Z`;
    case 'plus':
      return `M ${-s} 0 H ${s} M 0 ${-s} V ${s}`;
    case 'diamond':
      return `M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`;
    case 'tilde':
      return `M ${-s} ${s / 3} C ${-s / 2} ${-s} ${s / 2} ${s} ${s} ${-s / 3}`;
    case 'moon':
      return crescent(s);
    case 'hourglass':
      return `M ${-s * 0.7} ${-s} H ${s * 0.7} L ${s * 0.15} 0 L ${s * 0.7} ${s} H ${-s * 0.7} L ${-s * 0.15} 0 Z`;
    case 't':
      return `M ${-s} ${-s * 0.7} H ${s} M 0 ${-s * 0.7} V ${s}`;
    case 'double_slash':
      return `M ${-s * 0.9} ${s * 0.5} L ${-s * 0.2} ${-s * 0.7} M ${s * 0.2} ${s * 0.7} L ${s * 0.9} ${-s * 0.5}`;
    case 'heart':
      return `M 0 ${s} C ${-s * 1.3} 0 ${-s * 0.7} ${-s * 1.2} 0 ${-s * 0.4} C ${s * 0.7} ${-s * 1.2} ${s * 1.3} 0 0 ${s} Z`;
    case 'star':
      return star(s);
    case 'spade':
      return `M 0 ${-s} C ${s * 1.2} ${-s * 0.1} ${s * 0.8} ${s * 0.75} 0 ${s * 0.25} C ${-s * 0.8} ${s * 0.75} ${-s * 1.2} ${-s * 0.1} 0 ${-s} Z M 0 ${s * 0.25} L ${s * 0.35} ${s} H ${-s * 0.35} Z`;
    case 'clover':
      return clover(s);
    default:
      return assertNever(symbol);
  }
}

/** A five-pointed star, point up, its inner corners at 40 % of its reach. */
function star(s: number): string {
  const corners = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const reach = i % 2 === 0 ? s : s * 0.4;
    return `${(reach * Math.cos(angle)).toFixed(2)} ${(reach * Math.sin(angle)).toFixed(2)}`;
  });
  return `M ${corners.join(' L ')} Z`;
}

/** A clover of three round leaves, one up and two at the sides, on a short stem. */
function clover(s: number): string {
  const r = s * 0.42;
  const leaf = (x: number, y: number) =>
    `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} Z`;
  return [
    leaf(0, -s * 0.5),
    leaf(-s * 0.5, s * 0.1),
    leaf(s * 0.5, s * 0.1),
    `M 0 ${s * 0.1} V ${s}`,
  ].join(' ');
}

/**
 * A crescent opening to the right, as the moon is printed: the outer arc round the left from 60°
 * above to 60° below the centre, back up along a flatter inner arc.
 */
function crescent(s: number): string {
  const tipX = s / 2;
  const tipY = s * Math.sin(Math.PI / 3);
  const inner = s * 0.9;
  return `M ${tipX} ${-tipY} A ${s} ${s} 0 1 0 ${tipX} ${tipY} A ${inner} ${inner} 0 0 1 ${tipX} ${-tipY} Z`;
}
