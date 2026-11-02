import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { sentences } from '@arkham/util';
import { PORTRAIT_SCAN, TREACHERY_ART, artViewBox } from '../catalog/cardArt';
import {
  CARD_OUTLINE,
  NightSky,
  OrnamentLine,
  SetMedallion,
  type ShownCard,
} from '../catalog/cardFace';
import { useCardPicture } from '../catalog/cardImages';
import { shrinkAround, useShrinkToFit } from '../map/useShrinkToFit';
import { TREACHERY_FACE, TREACHERY_FRAME } from './treacheryCardFrame';
import './treacheries.css';

/** The hatch's cell in scan units, as on the enemy card's art while it has no picture. */
const HATCH = 40;

/**
 * A treachery's front drawn as its card, in scan units, laid out as the printed treachery card
 * (`TREACHERY_FACE`, our own drawing of it, no FFG art): its art through the keyhole window of
 * the frame, cut from the card's picture once that has loaded (a hatch until then, and for good
 * offline), the bead chains and volutes around the window, the set medallion on the frame's foot,
 * and on the page its name, a heading with `titleId` so the dialog showing the card is named by
 * it, and its traits as HTML in a `foreignObject`. In the card pictures theme the whole picture
 * lies over the face once loaded (`data-picture`); the face stays under it for assistive
 * technology. The card text isn't in the card data, so the page shows no more than that.
 */
export function TreacheryCard({ card, titleId }: { card: ShownCard; titleId: string }) {
  const { t } = useTranslation();
  const clipId = useId();
  const pageId = useId();
  const hatchId = useId();
  const name = useRef<SVGTextElement>(null);
  const scale = useShrinkToFit(name, TREACHERY_FACE.name.width, card.name);
  const picture = useCardPicture(card.image);
  const { width, height } = PORTRAIT_SCAN;
  const nameCentre = { x: TREACHERY_FACE.name.x, y: TREACHERY_FACE.name.y };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      data-card="treachery"
      data-picture={picture?.shown ? 'shown' : undefined}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={CARD_OUTLINE} />
        </clipPath>
        {/* The stylesheet colours the stops and the hatch, like the enemy card's fills. */}
        <radialGradient id={pageId} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" />
          <stop offset="1" />
        </radialGradient>
        <pattern id={hatchId} width={HATCH} height={HATCH} patternUnits="userSpaceOnUse">
          <rect width={HATCH} height={HATCH} />
          <path d={`M 0 ${HATCH} L ${HATCH} 0`} />
        </pattern>
      </defs>
      <g clipPath={`url(#${clipId})`} aria-hidden="true">
        <path data-part="art" d={TREACHERY_FRAME.art} fill={`url(#${hatchId})`} />
        {picture && (
          <svg
            x={0}
            {...TREACHERY_FACE.art}
            width={width}
            viewBox={artViewBox(TREACHERY_ART)}
            preserveAspectRatio="xMidYMid slice"
          >
            <image
              href={picture.url}
              {...PORTRAIT_SCAN}
              preserveAspectRatio="none"
              onLoad={picture.onLoad}
              onError={picture.onError}
            />
          </svg>
        )}
        <path data-part="stone" d={TREACHERY_FRAME.stone} />
        <path data-part="window-rule" d={TREACHERY_FRAME.window} />
        <path data-part="window-setting" d={TREACHERY_FRAME.window} />
        <path data-part="beads" d={TREACHERY_FRAME.chains} />
        <path data-part="thread" d={TREACHERY_FRAME.thread} />
        {TREACHERY_FRAME.volutes.map((d) => (
          <OrnamentLine key={d} d={d} />
        ))}
        <path data-part="ornament-rule" d={TREACHERY_FRAME.plates} />
        <path data-part="ornament-rule" d={TREACHERY_FRAME.footRule} />
        <path data-part="band" d={TREACHERY_FRAME.band} />
        <path data-part="beads" d={TREACHERY_FRAME.bandBeads} />
        <path data-part="page" d={TREACHERY_FRAME.page} fill={`url(#${pageId})`} />
        <NightSky page={TREACHERY_FRAME.page} />
        <path data-part="corner" d={TREACHERY_FRAME.corners} />
        <path data-part="corner-star" d={TREACHERY_FRAME.cornerStars} />
        <path data-part="footer" d={TREACHERY_FRAME.footer} />
      </g>
      <SetMedallion
        centre={TREACHERY_FACE.medallion}
        radius={TREACHERY_FACE.medallion.radius}
        plateWidth={TREACHERY_FACE.medallion.plateWidth}
        type={t('cardZoom.type.treachery')}
        set={card.encounterSet}
      />
      <text
        id={titleId}
        ref={name}
        role="heading"
        aria-level={2}
        {...nameCentre}
        transform={shrinkAround(nameCentre, scale)}
      >
        {card.name}
      </text>
      {card.traits.length > 0 && (
        <foreignObject {...TREACHERY_FACE.traits}>
          <p data-part="traits">{sentences(card.traits)}</p>
        </foreignObject>
      )}
      <path data-part="edge" d={CARD_OUTLINE} />
      {picture && (
        <image
          href={picture.url}
          {...PORTRAIT_SCAN}
          preserveAspectRatio="none"
          clipPath={`url(#${clipId})`}
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
    </svg>
  );
}
