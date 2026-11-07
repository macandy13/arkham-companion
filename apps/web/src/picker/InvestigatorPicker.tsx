import type { CardCatalog } from '@arkham/carddata';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_IMAGE_HOST } from '../catalog/cardImageUrl';
import { InvestigatorSheet } from './InvestigatorSheet';
import { PickerFilterBar } from './PickerFilterBar';
import { applyPickerFilters, moveSeat, seatNumber, type PickerFilters } from './pickerLogic';
import { PortraitPages } from './PortraitPages';
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
 * Investigator picker (product.md "UI concept", MD.3d2): the search and filter control and the
 * investigators' portraits in pages of ten (`PortraitPages`), each picked one numbered in pick
 * order. Tapping a portrait opens the detail sheet over the screen: "Select" there takes the next
 * free seat; a picked investigator's sheet makes them the lead investigator or removes them. Only
 * the lead's seat matters to the rules, so there is no other reordering.
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
  const visible = applyPickerFilters(catalog.investigators, filters, ownedPacks);
  const open = openCode === undefined ? undefined : byCode.get(openCode);

  function closeSheet() {
    setOpenCode(undefined);
  }

  function changeSeats(next: string[]) {
    onSeatsChange(next);
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
          onSelect={() => changeSeats([...seats, open.code])}
          onMakeLead={() => changeSeats(moveSeat(seats, seats.indexOf(open.code), 0))}
          onRemove={() => changeSeats(seats.filter((code) => code !== open.code))}
          onShowOtherChapter={() => setOpenCode(open.otherChapterCode)}
          onClose={closeSheet}
        />
      )}
    </section>
  );
}
