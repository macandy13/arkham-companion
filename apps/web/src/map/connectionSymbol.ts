import type { LocationSymbol } from '@arkham/engine';

/**
 * The outline of a connection symbol (`LocationSymbol`) as SVG path data, centred on the origin
 * and `size` units from its centre to its edge: simple shapes of our own, which the stylesheet
 * strokes in the light colour of the printed corner disc, rather than the printed glyphs.
 */
export function connectionGlyph(symbol: LocationSymbol, size: number): string {
  const s = size;
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
  }
}
