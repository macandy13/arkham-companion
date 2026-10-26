import type { InvestigatorDef } from '@arkham/carddata';
import { SKILL_NAMES } from '@arkham/engine';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { seatNumber } from './pickerLogic';

/**
 * Portraits on one page of the picker: two rows of five. The stylesheet lays the list out in the
 * same pages (`--picker-columns` and the `10n + …` rows in `picker.css`), so change both together.
 */
export const PORTRAITS_PER_PAGE = 10;

interface PortraitPagesProps {
  /** The investigators to show, already filtered and in alphabetical order (`applyPickerFilters`). */
  readonly investigators: readonly InvestigatorDef[];
  /** Investigator codes in seat order, to mark the seated ones. */
  readonly seats: readonly string[];
  readonly imageUrl: (src: string) => string;
  readonly onOpen: (code: string) => void;
}

/**
 * The investigators as pages of portraits, two rows of five, read row by row and page by page
 * like a book. One list holds them all, so screen readers read them in order; the stylesheet
 * places every tenth one on a new page beside the last, and the list scrolls sideways a page at a
 * time, with a swipe or its arrows.
 */
export function PortraitPages({ investigators, seats, imageUrl, onOpen }: PortraitPagesProps) {
  const { t } = useTranslation();
  const pages = useRef<HTMLUListElement>(null);
  // The strip snaps to whole pages, so a scroll by its width always ends on the next one.
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
              <small>{t(`picker.faction.${investigator.factionCode}`)}</small>
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
 * What a portrait tells about its investigator besides name and class, as on the card: the four skills in the order the
 * card prints them, then health and sanity, each a value after its icon. The stylesheet draws the
 * icons and keeps each value's name for screen readers only, so the portrait's button names them.
 */
function Stats({ investigator }: { investigator: InvestigatorDef }) {
  const { t } = useTranslation();
  return (
    <>
      <small>
        {SKILL_NAMES.map((skill) => (
          <span key={skill} data-skill={skill}>
            <span>{t(`skill.${skill}`)}</span> {investigator.skills[skill]}
          </span>
        ))}
      </small>
      <small>
        <span data-stat="health">
          <span>{t('picker.health')}</span> {investigator.health}
        </span>
        <span data-stat="sanity">
          <span>{t('picker.sanity')}</span> {investigator.sanity}
        </span>
      </small>
    </>
  );
}

/** The seat a portrait's investigator holds, if any. */
function SeatBadge({ n }: { n: number | undefined }) {
  const { t } = useTranslation();
  return n === undefined ? null : <small>{t('picker.seated', { n })}</small>;
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
