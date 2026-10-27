import { useTranslation } from 'react-i18next';
import type { BoardView, EncounterCardView, InvestigatorId } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { GameActions } from '../state/gameActions';
import { cardMoves, type CardMove } from './cardMoves';

/**
 * A button per move that fits `card` (`cardMoves`), for the players to put it where a revelation
 * the engine left to them says: each one step (`GameActions.moveEncounterCard`), so one undo takes
 * it back. Spawn hands the enemy to `onSpawn` instead, which lets the players tap the location on
 * the map, where the engine spawns and engages it by the rules. Like the other moves, it carries
 * out a card effect the engine left to the players, so it stays open while they adjust the board.
 * Nothing is tapped while a step is queued (`busy`).
 */
export function CardMoves({
  board,
  card,
  actions,
  busy,
  onSpawn,
}: {
  board: BoardView;
  card: EncounterCardView;
  actions: GameActions;
  busy: boolean;
  onSpawn: (card: EncounterCardView) => void;
}) {
  const { t } = useTranslation();
  const nameOf = (investigator: InvestigatorId) => board.investigator(investigator).name;

  const label = (move: CardMove): string => {
    switch (move.to) {
      case 'spawn':
        return t('encounter.move.spawn');
      case 'discard':
        return t('encounter.move.discard');
      case 'setAside':
        return t('encounter.move.setAside');
      case 'threatArea':
        return t('encounter.move.threatArea', { name: nameOf(move.investigator) });
      default:
        return assertNever(move);
    }
  };

  return (
    <menu aria-label={t('encounter.move.label', { card: card.name })}>
      {cardMoves(board, card).map((move) => {
        return (
          <li key={JSON.stringify(move)}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                move.to === 'spawn' ? onSpawn(card) : void actions.moveEncounterCard(card.id, move)
              }
            >
              {label(move)}
            </button>
          </li>
        );
      })}
    </menu>
  );
}
