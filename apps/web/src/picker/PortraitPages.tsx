import type { CardCode, InvestigatorDef } from '@arkham/carddata';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { seatNumber } from './pickerLogic';

/**
 * Portraits on one page of the picker: two rows of five. The stylesheet lays the list out in the
 * same pages (`--picker-columns` and the `10n + …` rows in `picker.css`), so change both together.
 */
export const PORTRAITS_PER_PAGE = 10;

interface PortraitPagesProps {
  /** The investigators to show, already filtered and in order (`pickerList`). */
  readonly investigators: readonly InvestigatorDef[];
  /** Investigator codes in seat order, to mark the seated ones. */
  readonly seats: readonly CardCode[];
  readonly imageUrl: (src: string) => string;
  readonly onOpen: (code: CardCode) => void;
}

/**
 * The investigators as pages of portraits, two rows of five, read row by row and page by page
 * like a book. One list holds them all, so screen readers read them in order; the stylesheet
 * places every tenth one on a new page beside the last, and the list scrolls sideways a page at a
 * time, with a swipe or its arrows. An upright phone has no pages: the portraits run down the page
 * in rows of three and the stylesheet hides the arrows.
 */
export function PortraitPages({ investigators, seats, imageUrl, onOpen }: PortraitPagesProps) {
  const { t } = useTranslation();
  const pages = useRef<HTMLUListElement>(null);
  // A scroll by the strip's width ends on the next page, or on a phone the next unseen column.
  const turn = (direction: -1 | 1) => {
    const strip = pages.current;
    strip?.scrollBy({ left: direction * strip.clientWidth, behavior: 'smooth' });
  };
  const paged = investigators.length > PORTRAITS_PER_PAGE;
  return (
    <div>
      {paged && (
        <button
          type="button"
          data-icon="previous"
          aria-label={t('picker.previousPage')}
          onClick={() => turn(-1)}
        />
      )}
      <ul ref={pages} aria-label={t('picker.portraits')}>
        {investigators.map((investigator) => (
          <li key={investigator.code}>
            <button
              type="button"
              data-faction={investigator.factionCode}
              onClick={() => onOpen(investigator.code)}
            >
              <Portrait src={investigator.imageSrc && imageUrl(investigator.imageSrc)} />
              <span>{investigator.name}</span>
              <small data-class>{t(`picker.faction.${investigator.factionCode}`)}</small>
              <Stats investigator={investigator} />
              <SeatBadge n={seatNumber(seats, investigator.code)} />
            </button>
          </li>
        ))}
      </ul>
      {paged && (
        <button
          type="button"
          data-icon="next"
          aria-label={t('picker.nextPage')}
          onClick={() => turn(1)}
        />
      )}
    </div>
  );
}

/**
 * Health and sanity under the portrait's name, each a value after its icon; the skills are on the
 * detail sheet. The stylesheet draws the icons and keeps each value's name for screen readers
 * only, so the portrait's button names them.
 */
function Stats({ investigator }: { investigator: InvestigatorDef }) {
  const { t } = useTranslation();
  return (
    <small>
      <span data-stat="health">
        <span>{t('picker.health')}</span> {investigator.health}
      </span>
      <span data-stat="sanity">
        <span>{t('picker.sanity')}</span> {investigator.sanity}
      </span>
    </small>
  );
}

/**
 * The seat a portrait's investigator holds, if any: its number on a disc over the portrait
 * (`data-seat`), the words for screen readers.
 */
function SeatBadge({ n }: { n: number | undefined }) {
  const { t } = useTranslation();
  return n === undefined ? null : (
    <small data-seat={n}>
      <span>{t('picker.seated', { n })}</span>
    </small>
  );
}

/**
 * An investigator's portrait: their figure on the picture of their card's front, cut out by the
 * stylesheet once the picture has loaded (`data-picture`). Until then, and for good when it fails, the portrait shows the hatched
 * art area, so a portrait never shows a broken image.
 */
function Portrait({ src }: { src: string | undefined }) {
  const [shown, setShown] = useState(false);
  return (
    <picture data-picture={shown ? 'shown' : undefined}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setShown(true)}
          onError={() => setShown(false)}
        />
      )}
    </picture>
  );
}
