import { PORTRAIT_SCAN } from '../catalog/cardArt';
import { CardFaceCorners } from '../catalog/cardFace';
import { CONTENT } from './mapLayout';

/**
 * The fills of a tile drawn in the printed cards' style: a hatch for the art area while it has no
 * card image, one per side of a location card, so a revealed tile reads apart from an unrevealed
 * one at a glance; the shading of the name plate (`card-plate`, darker towards its foot) and of
 * the page (`card-page`, lightest in the middle, like the printed paper); and the paper's grain
 * (`card-paper`, a pattern the size of a scan filled by the `card-paper-grain` noise filter:
 * large faint foxing and a fine grain), which the frame lays over its plate and page. They are
 * drawn once per map drawing, in its `defs`; the stylesheet fills each tile's parts by these ids
 * and colours the gradients' stops. The ids are fixed rather than `useId`, since the
 * stylesheet must name them; two drawings mounted at once would repeat them, which is harmless
 * because the patterns are the same.
 */
export function CardPatterns() {
  const size = 2 * CONTENT.inset;
  return (
    <>
      <pattern id="card-art-revealed" width={size} height={size} patternUnits="userSpaceOnUse">
        <rect width={size} height={size} />
        <path d={`M 0 ${size} L ${size} 0`} />
      </pattern>
      <pattern id="card-art-unrevealed" width={size} height={size} patternUnits="userSpaceOnUse">
        <rect width={size} height={size} />
        <path d={`M 0 ${size} L ${size} 0 M 0 0 L ${size} ${size}`} />
      </pattern>
      {/* The grain's sepia sits in the colour matrices, since filter matrices take no CSS colours. */}
      <filter id="card-paper-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.36  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 -1.2 0.6"
          result="foxing"
        />
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.5 -0.15"
        />
        <feMerge>
          <feMergeNode in="foxing" />
          <feMergeNode />
        </feMerge>
      </filter>
      <pattern
        id="card-paper"
        width={PORTRAIT_SCAN.width}
        height={PORTRAIT_SCAN.height}
        patternUnits="userSpaceOnUse"
      >
        <rect width={PORTRAIT_SCAN.width} height={PORTRAIT_SCAN.height} />
      </pattern>
      <linearGradient id="card-plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" />
        <stop offset="1" />
      </linearGradient>
      <radialGradient id="card-page" cx="0.5" cy="0.45" r="0.7">
        <stop offset="0" />
        <stop offset="1" />
      </radialGradient>
      <CardFaceCorners />
    </>
  );
}
