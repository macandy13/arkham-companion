import { useTranslation } from 'react-i18next';
import { byId, type BoardView, type EncounterCardView, type InvestigatorId } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { GameActions } from '../state/gameActions';
import { cardMoves, type CardMove } from './cardMoves';

/**
 * A button per move that fits `card` (`cardMoves`), for the players to put it where a revelation
 * the engine left to them says: each one step (`GameActions.moveEncounterCard`), so one undo takes
 * it back. Nothing is tapped while a step is queued (`busy`).
 */
export function CardMoves({
  board,
  card,
  actions,
  busy,
}: {
  board: BoardView;
  card: EncounterCardView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const nameOf = (investigator: InvestigatorId) => board.investigator(investigator).name;

  const label = (move: CardMove): string => {
    switch (move.to) {
      case 'discard':
        return t('encounter.move.discard');
      case 'setAside':
        return t('encounter.move.setAside');
      case 'threatArea':
        return t('encounter.move.threatArea', { name: nameOf(move.investigator) });
      case 'location': {
        const location = board.location(byId(move.location)).name;
        return move.engagedWith === undefined
          ? t('encounter.move.spawn', { location })
          : t('encounter.move.spawnEngaged', { location, name: nameOf(move.engagedWith) });
      }
      default:
        return assertNever(move);
    }
  };

  return (
    <menu aria-label={t('encounter.move.label', { card: card.name })}>
      {cardMoves(board, card).map((move) => {
        const text = label(move);
        return (
          <li key={JSON.stringify(move)}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void actions.moveEncounterCard(card.id, move)}
            >
              {text}
            </button>
          </li>
        );
      })}
    </menu>
  );
}
