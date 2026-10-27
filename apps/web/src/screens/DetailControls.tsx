import { useLayoutEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { DetailTarget } from './useDetailView';

/**
 * The detail view's controls over the board (`board`, the `#board` element), which the stylesheet
 * turns into three rows snapped vertically, the header's places (its four cards and the victory
 * display) and the investigator panels each snapped sideways: the × that closes it (`onClose`).
 * As it opens it scrolls to its `target`, the card or panel the players tapped.
 */
export function DetailControls({
  board,
  target,
  onClose,
}: {
  board: RefObject<HTMLElement | null>;
  target: DetailTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useLayoutEffect(() => {
    const row = board.current?.querySelector<HTMLElement>(
      target.row === 'cards' ? ':scope > header' : ':scope > #investigators',
    );
    const item = row?.querySelector<HTMLElement>(
      target.row === 'cards' ? `:scope > [data-slot='${target.card}']` : ':scope > [data-focus]',
    );
    row?.scrollIntoView?.({ block: 'start' });
    item?.scrollIntoView?.({ block: 'nearest', inline: 'start' });
  }, [board, target]);
  return (
    <button
      type="button"
      data-icon="close"
      data-detail="close"
      aria-label={t('detail.close')}
      onClick={onClose}
    />
  );
}
