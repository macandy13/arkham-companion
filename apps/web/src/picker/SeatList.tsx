import type { InvestigatorDef } from '@arkham/carddata';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moveSeat } from './pickerLogic';

interface SeatListProps {
  readonly seats: readonly InvestigatorDef[];
  readonly onSeatsChange: (codes: string[]) => void;
}

/**
 * The seated investigators in play order; the first seat is the lead investigator.
 * Reordering works by drag and drop and, for keyboard and screen reader users, by the
 * move up/down buttons.
 */
export function SeatList({ seats, onSeatsChange }: SeatListProps) {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = useState<number>();
  const codes = seats.map((s) => s.code);

  return (
    <section aria-labelledby="picker-seats-heading">
      <h3 id="picker-seats-heading">{t('picker.seats')}</h3>
      {seats.length === 0 ? (
        <p>{t('picker.noSeats')}</p>
      ) : (
        <ol>
          {seats.map((investigator, index) => (
            <li
              key={investigator.code}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== undefined) onSeatsChange(moveSeat(codes, dragIndex, index));
                setDragIndex(undefined);
              }}
            >
              <span>{investigator.name}</span>
              {index === 0 && <small>{t('picker.lead')}</small>}
              <button
                type="button"
                disabled={index === 0}
                aria-label={t('picker.moveUp', { name: investigator.name })}
                onClick={() => onSeatsChange(moveSeat(codes, index, index - 1))}
              >
                {t('picker.up')}
              </button>
              <button
                type="button"
                disabled={index === seats.length - 1}
                aria-label={t('picker.moveDown', { name: investigator.name })}
                onClick={() => onSeatsChange(moveSeat(codes, index, index + 1))}
              >
                {t('picker.down')}
              </button>
              <button
                type="button"
                aria-label={t('picker.remove', { name: investigator.name })}
                onClick={() => onSeatsChange(codes.filter((c) => c !== investigator.code))}
              >
                {t('picker.removeShort')}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
