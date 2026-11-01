import { useId } from 'react';
import type { CardImagePath } from '@arkham/engine';
import { LANDSCAPE_SCAN, artViewBox, type ScanArea } from '../catalog/cardArt';
import { useCardPicture } from '../catalog/cardImages';
import type { Point } from './mapLayout';

/** How much of a token's radius its picture fills, so the token's own ring stays round it. */
const PICTURE_INSET = 0.86;

/**
 * The avatar on a round token (an investigator's pawn, an enemy token) centred on `centre` with
 * `radius`: the `area` of its card's picture (`image`, a scan of `scan` size) cut to a circle,
 * shown once it has loaded (`data-picture`). Until then, and for good when it fails or the scan
 * is turned the wrong way, the token shows its initial. Decoration only: the token is named.
 */
export function TokenPicture({
  image,
  area,
  scan,
  centre,
  radius,
}: {
  image: CardImagePath | undefined;
  area: ScanArea;
  scan: { width: number; height: number };
  centre: Point;
  radius: number;
}) {
  const clipId = useId();
  const picture = useCardPicture(image, scan === LANDSCAPE_SCAN ? 'landscape' : 'portrait');
  if (!picture) return null;
  const inner = radius * PICTURE_INSET;
  return (
    <g data-part="avatar" data-picture={picture.shown ? 'shown' : undefined}>
      <clipPath id={clipId}>
        <circle cx={centre.x} cy={centre.y} r={inner} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <svg
          x={centre.x - inner}
          y={centre.y - inner}
          width={2 * inner}
          height={2 * inner}
          viewBox={artViewBox(area, scan)}
          preserveAspectRatio="xMidYMid slice"
        >
          <image
            href={picture.url}
            {...scan}
            preserveAspectRatio="none"
            onLoad={picture.onLoad}
            onError={picture.onError}
          />
        </svg>
      </g>
    </g>
  );
}
