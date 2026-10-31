import { useTranslation } from 'react-i18next';
import type { BoardView, ResolvingCardView } from '@arkham/engine';
import './encounter.css';

/**
 * What the decision dialog says of the encounter card being resolved (`BoardView.resolving`), whose
 * revelation opened it: whom it was drawn for and a badge per keyword (surge, peril, …), so the
 * players see what they drew while they answer. The card itself stands beside the page
 * (`DecisionView.card`).
 */
export function ResolvingCard({ board, card }: { board: BoardView; card: ResolvingCardView }) {
  const { t } = useTranslation();
  const caption =
    card.drawnBy === undefined
      ? card.name
      : t('encounter.drawnFor', { card: card.name, name: board.investigator(card.drawnBy).name });
  return (
    <section data-part="resolving">
      <p>{caption}</p>
      {card.keywords.length > 0 && (
        <ul aria-label={t('encounter.keywords')}>
          {card.keywords.map(({ name }) => (
            <li key={name} data-keyword={name}>
              {t(`keyword.${name}`)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
