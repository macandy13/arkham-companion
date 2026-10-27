import { useTranslation } from 'react-i18next';
import type { BoardView, CardPlaceView, InvestigatorId } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { DrawnCard } from './drawnCards';

/**
 * Tells the players which encounter cards the last step drew and where each went
 * (`OpenGame.drawnCards`): "Crypt Chill for Roland Banks: discard pile". Most draws resolve within
 * one step, so this is the only place the players see them; it stays until dismissed or the next
 * step.
 */
export function DrawnCardsNotice({
  board,
  drawn,
  onDismiss,
}: {
  board: BoardView;
  drawn: readonly DrawnCard[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const nameOf = (investigator: InvestigatorId) => board.investigator(investigator).name;

  const describePlace = (place: CardPlaceView): string => {
    switch (place.kind) {
      case 'encounterDeck':
      case 'encounterDiscard':
      case 'setAside':
      case 'victoryDisplay':
      case 'resolving':
      case 'elsewhere':
        return t(`encounter.place.${place.kind}`);
      case 'threatArea':
      case 'engaged':
        return t(`encounter.place.${place.kind}`, { name: nameOf(place.investigator) });
      case 'atLocation':
        return t('encounter.place.atLocation', { location: place.location });
      case 'attachedTo':
        return t('encounter.place.attachedTo', { card: place.card });
      default:
        return assertNever(place);
    }
  };

  return (
    <aside role="status" aria-label={t('encounter.drawnLabel')}>
      <ul>
        {drawn.map(({ card, drawnFor, place }) => (
          <li key={card.id}>
            {drawnFor === undefined
              ? t('encounter.went', { card: card.name, place: describePlace(place) })
              : t('encounter.wentFor', {
                  card: card.name,
                  name: nameOf(drawnFor),
                  place: describePlace(place),
                })}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onDismiss}>
        {t('notice.dismiss')}
      </button>
    </aside>
  );
}
