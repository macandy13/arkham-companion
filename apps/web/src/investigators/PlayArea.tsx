import { useTranslation } from 'react-i18next';
import type { BoardView, CardFaceView, InvestigatorView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { SmallCard } from './ThreatArea';

/**
 * The cards an investigator controls (their `playArea` zone, `InvestigatorView.controls`), such as
 * Lita Chantler after a Parley, as a row of small cards under their card, as they lie beside it
 * on the table; a tap on one opens it on the card shell (`SmallCard`). Nothing while they control none.
 */
export function PlayArea({
  board,
  investigator,
  cards,
  actions,
  busy,
}: {
  board: BoardView;
  /** Who controls the cards. */
  investigator: InvestigatorView;
  cards: readonly CardFaceView[];
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  if (cards.length === 0) return null;
  return (
    <ul aria-label={t('investigators.playArea')}>
      {cards.map((card) => (
        <SmallCard
          key={card.id}
          heldIn="playArea"
          owner={investigator}
          board={board}
          card={card}
          actions={actions}
          busy={busy}
        />
      ))}
    </ul>
  );
}
