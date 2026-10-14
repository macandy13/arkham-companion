import type { CardCatalog } from '@arkham/carddata';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InvestigatorSheet } from './InvestigatorSheet';
import { PickerFilterBar } from './PickerFilterBar';
import { applyPickerFilters, type PickerFilters } from './pickerLogic';
import { SeatList } from './SeatList';
import './picker.css';

/** ArkhamDB serves card images for every language from the English host. */
const DEFAULT_IMAGE_HOST = 'https://arkhamdb.com';

/** Seats at the table; the core game supports up to four investigators. */
const DEFAULT_MAX_SEATS = 4;

const NO_FILTERS: PickerFilters = { search: '', factions: [], onlyOwned: false };

interface InvestigatorPickerProps {
  readonly catalog: CardCatalog;
  /** Investigator codes in seat order; the picker is controlled so the wizard owns the state. */
  readonly seats: readonly string[];
  readonly onSeatsChange: (codes: string[]) => void;
  /** Pack codes the player owns (settings, M2.4); without it the "my collection" filter is hidden. */
  readonly ownedPacks?: ReadonlySet<string>;
  readonly maxSeats?: number;
  /** Prefix for the host-relative image paths of the catalog. */
  readonly imageHost?: string;
}

/**
 * Investigator picker (architecture §11): a filterable portrait grid, a detail sheet and the
 * seat list. Tapping a portrait opens the sheet; "select" there assigns the next free seat.
 */
export function InvestigatorPicker({
  catalog,
  seats,
  onSeatsChange,
  ownedPacks,
  maxSeats = DEFAULT_MAX_SEATS,
  imageHost = DEFAULT_IMAGE_HOST,
}: InvestigatorPickerProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [openCode, setOpenCode] = useState<string>();

  const byCode = new Map(catalog.investigators.map((i) => [i.code, i]));
  const imageUrl = (src: string) => `${imageHost}${src}`;
  const seated = seats.flatMap((code) => byCode.get(code) ?? []);
  const visible = applyPickerFilters(catalog.investigators, filters, ownedPacks);
  const open = openCode === undefined ? undefined : byCode.get(openCode);

  function select(code: string) {
    onSeatsChange([...seats, code]);
    setOpenCode(undefined);
  }

  return (
    <section id="investigator-picker" aria-labelledby="picker-heading">
      <h2 id="picker-heading">{t('picker.title')}</h2>
      <PickerFilterBar
        filters={filters}
        packs={catalog.packs}
        canFilterByCollection={ownedPacks !== undefined}
        onChange={setFilters}
      />
      <SeatList seats={seated} onSeatsChange={onSeatsChange} />
      {visible.length === 0 ? (
        <p>{t('picker.noResults')}</p>
      ) : (
        <ul aria-label={t('picker.portraits')}>
          {visible.map((investigator) => (
            <li key={investigator.code}>
              <button type="button" onClick={() => setOpenCode(investigator.code)}>
                {investigator.imageSrc && (
                  <img
                    src={imageUrl(investigator.imageSrc)}
                    alt=""
                    loading="lazy"
                    onError={(e) => e.currentTarget.setAttribute('hidden', '')}
                  />
                )}
                <span>{investigator.name}</span>
                <small data-chapter={investigator.chapter}>
                  {t('picker.chapterBadge', { n: investigator.chapter })}
                </small>
                {seats.includes(investigator.code) && (
                  <small>{t('picker.seated', { n: seats.indexOf(investigator.code) + 1 })}</small>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <InvestigatorSheet
          investigator={open}
          otherChapter={open.otherChapterCode ? byCode.get(open.otherChapterCode) : undefined}
          seatNumber={seats.includes(open.code) ? seats.indexOf(open.code) + 1 : undefined}
          seatsFull={seats.length >= maxSeats}
          imageUrl={imageUrl}
          onSelect={() => select(open.code)}
          onShowOtherChapter={() => setOpenCode(open.otherChapterCode)}
          onClose={() => setOpenCode(undefined)}
        />
      )}
    </section>
  );
}
