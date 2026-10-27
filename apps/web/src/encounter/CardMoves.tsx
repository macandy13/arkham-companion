import { useTranslation } from 'react-i18next';
import type { BoardView, CardPlaceView, EncounterCardView, InvestigatorId } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { GameActions } from '../state/gameActions';
import { cardMoves, type CardMove } from './cardMoves';

/** Where an enemy already is on the map, so it spawns no more. */
const ON_TABLE: ReadonlySet<CardPlaceView['kind']> = new Set(['atLocation', 'engaged']);

/**
 * A button per move that fits `card` (`cardMoves`), for the players to put it where a revelation
 * the engine left to them says: each one step (`GameActions.moveEncounterCard`), so one undo takes
 * it back. An enemy that is not on the map yet also gets a Spawn button: `onSpawn` lets the players
 * tap the location on the map, where the engine spawns and engages it by the rules. Nothing is
 * tapped while a step is queued (`busy`).
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
      {card.type === 'enemy' && !ON_TABLE.has(board.placeOf(card.id).kind) && (
        <li>
          <button type="button" disabled={busy} onClick={() => onSpawn(card)}>
            {t('encounter.move.spawn')}
          </button>
        </li>
      )}
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
