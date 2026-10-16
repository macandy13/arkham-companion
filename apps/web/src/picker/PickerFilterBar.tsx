import type { Chapter, PackDef } from '@arkham/carddata';
import { useTranslation } from 'react-i18next';
import { cyclePositions, FACTION_CODES, sortedPacks, type PickerFilters } from './pickerLogic';

interface PickerFilterBarProps {
  readonly filters: PickerFilters;
  readonly packs: readonly PackDef[];
  /** Whether the "my collection" checkbox is offered; it needs the owned packs from settings. */
  readonly canFilterByCollection: boolean;
  readonly onChange: (filters: PickerFilters) => void;
}

/** Search box, class chips and cycle/pack/chapter/collection filters of the investigator picker. */
export function PickerFilterBar({
  filters,
  packs,
  canFilterByCollection,
  onChange,
}: PickerFilterBarProps) {
  const { t } = useTranslation();

  function toggleFaction(code: string) {
    const factions = filters.factions.includes(code)
      ? filters.factions.filter((f) => f !== code)
      : [...filters.factions, code];
    onChange({ ...filters, factions });
  }

  return (
    <form role="search" aria-label={t('picker.filters')} onSubmit={(e) => e.preventDefault()}>
      <label>
        {t('picker.search')}
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </label>
      <fieldset>
        <legend>{t('picker.classes')}</legend>
        {FACTION_CODES.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={filters.factions.includes(code)}
            onClick={() => toggleFaction(code)}
          >
            {t(`picker.faction.${code}`)}
          </button>
        ))}
      </fieldset>
      <label>
        {t('picker.cycle')}
        <select
          value={filters.cyclePosition ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              cyclePosition: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        >
          <option value="">{t('picker.all')}</option>
          {cyclePositions(packs).map((position) => (
            <option key={position} value={position}>
              {t('picker.cycleNumber', { n: position })}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('picker.pack')}
        <select
          value={filters.packCode ?? ''}
          onChange={(e) => onChange({ ...filters, packCode: e.target.value || undefined })}
        >
          <option value="">{t('picker.all')}</option>
          {sortedPacks(packs).map((pack) => (
            <option key={pack.code} value={pack.code}>
              {pack.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('picker.chapter')}
        <select
          value={filters.chapter ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              chapter: e.target.value === '' ? undefined : (Number(e.target.value) as Chapter),
            })
          }
        >
          <option value="">{t('picker.all')}</option>
          <option value="1">{t('picker.chapterBadge', { n: 1 })}</option>
          <option value="2">{t('picker.chapterBadge', { n: 2 })}</option>
        </select>
      </label>
      {canFilterByCollection && (
        <label>
          <input
            type="checkbox"
            checked={filters.onlyOwned}
            onChange={(e) => onChange({ ...filters, onlyOwned: e.target.checked })}
          />
          {t('picker.myCollection')}
        </label>
      )}
    </form>
  );
}
