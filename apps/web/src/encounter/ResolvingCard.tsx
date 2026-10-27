import { useTranslation } from 'react-i18next';
import type { BoardView, ResolvingCardView } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import './encounter.css';

/**
 * The encounter card being resolved (`BoardView.resolving`), shown at the top of the decision
 * dialog its revelation opened: its picture large once it has loaded (without one, its name says
 * what it is), whom it was drawn for, and a badge per keyword (surge,
 * peril, …), so the players see what they drew while they answer.
 */
export function ResolvingCard({ board, card }: { board: BoardView; card: ResolvingCardView }) {
  const { t } = useTranslation();
  const picture = useCardPicture(card.image);
  const caption =
    card.drawnBy === undefined
      ? card.name
      : t('encounter.drawnFor', { card: card.name, name: board.investigator(card.drawnBy).name });
  return (
    <figure data-part="resolving" data-picture={picture?.shown ? 'shown' : undefined}>
      {picture && (
        <img src={picture.url} alt={card.name} onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <figcaption>{caption}</figcaption>
      {card.keywords.length > 0 && (
        <ul aria-label={t('encounter.keywords')}>
          {card.keywords.map(({ name }) => (
            <li key={name} data-keyword={name}>
              {t(`keyword.${name}`)}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
