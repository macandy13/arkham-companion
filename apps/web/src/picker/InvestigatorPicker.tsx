import type { CardCatalog, CardCode } from '@arkham/carddata';
import { rotateTo } from '@arkham/util';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_IMAGE_HOST } from '../catalog/cardImageUrl';
import { InvestigatorSheet } from './InvestigatorSheet';
import { PickerFilterBar } from './PickerFilterBar';
import { pickerList, seatNumber, type PickerFilters } from './pickerLogic';
import { PortraitPages } from './PortraitPages';
import './picker.css';

/** Seats at the table; the core game supports up to four investigators. */
const DEFAULT_MAX_SEATS = 4;

const NO_FILTERS: PickerFilters = { search: '', factions: [], onlyOwned: false };

interface InvestigatorPickerProps {
  readonly catalog: CardCatalog;
  /** Investigator codes in seat order; the picker is controlled so the wizard owns the state. */
  readonly seats: readonly CardCode[];
  readonly onSeatsChange: (codes: CardCode[]) => void;
  /** Pack codes the player owns (settings, M2.4); without it the "my collection" filter is hidden. */
  readonly ownedPacks?: ReadonlySet<string>;
  readonly maxSeats?: number;
  /** Prefix for the host-relative image paths of the catalog. */
  readonly imageHost?: string;
}

/**
 * Investigator picker (product.md "UI concept", MD.3d2): the search and filter control and the
 * investigators' portraits in pages (`PortraitPages`), the picked ones first and numbered in seat
 * order (`pickerList`). Tapping a portrait opens the detail sheet over the screen: "Select" there takes the next
 * free seat; a picked investigator's sheet makes them the lead investigator or removes them. The
 * seats are the order round the table, so making one lead turns the table to them rather than
 * moving them alone (Rules Reference, "Player Order"); any other order is picked again.
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
  const [openCode, setOpenCode] = useState<CardCode>();

  const byCode = new Map(catalog.investigators.map((i) => [i.code, i]));
  const imageUrl = (src: string) => `${imageHost}${src}`;
  const visible = pickerList(catalog.investigators, filters, seats, ownedPacks);
  const open = openCode === undefined ? undefined : byCode.get(openCode);

  function closeSheet() {
    setOpenCode(undefined);
  }

  function changeSeats(next: CardCode[]) {
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
          onMakeLead={() => changeSeats(rotateTo(seats, seats.indexOf(open.code)))}
          onRemove={() => changeSeats(seats.filter((code) => code !== open.code))}
          onShowOtherChapter={() => setOpenCode(open.otherChapterCode)}
          onClose={closeSheet}
        />
      )}
    </section>
  );
}
