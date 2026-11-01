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
    default:
      return assertNever(symbol);
  }
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
