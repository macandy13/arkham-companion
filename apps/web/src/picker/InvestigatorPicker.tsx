import type { CardCatalog } from '@arkham/carddata';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_IMAGE_HOST } from '../catalog/cardImageUrl';
import { InvestigatorSheet } from './InvestigatorSheet';
import { PickerFilterBar } from './PickerFilterBar';
import { applyPickerFilters, seatNumber, type PickerFilters } from './pickerLogic';
import { PortraitPages } from './PortraitPages';
import { SeatList } from './SeatList';
import './picker.css';

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
 * Investigator picker (product.md "UI concept"): the search and filter control, the seat list and
 * the investigators' portraits in pages of ten (`PortraitPages`). Tapping a portrait opens the
 * detail sheet over the screen; "select" there assigns the next free seat.
 */
export function InvestigatorPicker({
  catalog,
  seats,
  onSeatsChange,
  ownedPacks,
  maxSeats = DEFAULT_MAX_SEATS,
  imageHost = CARD_IMAGE_HOST,
}: InvestigatorPickerProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [openCode, setOpenCode] = useState<string>();

  const byCode = new Map(catalog.investigators.map((i) => [i.code, i]));
  const imageUrl = (src: string) => `${imageHost}${src}`;
  const seated = seats.flatMap((code) => byCode.get(code) ?? []);
  const visible = applyPickerFilters(catalog.investigators, filters, ownedPacks);
  const open = openCode === undefined ? undefined : byCode.get(openCode);

  function closeSheet() {
    setOpenCode(undefined);
  }

  function select(code: string) {
    onSeatsChange([...seats, code]);
    closeSheet();
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
        <PortraitPages
          // A new filter starts again on the first page, so the list never opens on an empty page.
          key={JSON.stringify(filters)}
          investigators={visible}
          seats={seats}
          imageUrl={imageUrl}
          onOpen={setOpenCode}
        />
      )}
      {open && (
        <InvestigatorSheet
          investigator={open}
          otherChapter={open.otherChapterCode ? byCode.get(open.otherChapterCode) : undefined}
          seatNumber={seatNumber(seats, open.code)}
          seatsFull={seats.length >= maxSeats}
          imageUrl={imageUrl}
          onSelect={() => select(open.code)}
          onShowOtherChapter={() => setOpenCode(open.otherChapterCode)}
          onClose={closeSheet}
        />
      )}
    </section>
  );
}
