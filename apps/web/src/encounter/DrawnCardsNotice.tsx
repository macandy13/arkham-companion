import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardPlaceView, EncounterCardView, InvestigatorId } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import type { GameActions } from '../state/gameActions';
import { CardMoves } from './CardMoves';
import type { DrawnCard } from './drawnCards';

/**
 * Tells the players which encounter cards the last step drew and where each went
 * (`OpenGame.drawnCards`): "Crypt Chill for Roland Banks: discard pile". Most draws resolve within
 * one step, so this is the only place the players see them; it stays until dismissed or the next
 * step. A tap on a line opens the places the players can put that card (`CardMoves`), for when
 * the engine left part of its revelation to them.
 */
export function DrawnCardsNotice({
  board,
  drawn,
  actions,
  busy,
  onSpawn,
  onDismiss,
}: {
  board: BoardView;
  drawn: readonly DrawnCard[];
  actions: GameActions;
  busy: boolean;
  onSpawn: (card: EncounterCardView) => void;
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
          <DrawnLine
            key={card.id}
            board={board}
            card={card}
            actions={actions}
            busy={busy}
            onSpawn={onSpawn}
          >
            {drawnFor === undefined
              ? t('encounter.went', { card: card.name, place: describePlace(place) })
              : t('encounter.wentFor', {
                  card: card.name,
                  name: nameOf(drawnFor),
                  place: describePlace(place),
                })}
          </DrawnLine>
        ))}
      </ul>
      <button type="button" onClick={onDismiss}>
        {t('notice.dismiss')}
      </button>
    </aside>
  );
}

/** One line of the notice (`children`) that opens `card`'s moves when tapped, rendered only while open. */
function DrawnLine({
  board,
  card,
  actions,
  busy,
  onSpawn,
  children,
}: {
  board: BoardView;
  card: EncounterCardView;
  actions: GameActions;
  busy: boolean;
  onSpawn: (card: EncounterCardView) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>{children}</summary>
        {open && (
          <CardMoves board={board} card={card} actions={actions} busy={busy} onSpawn={onSpawn} />
        )}
      </details>
    </li>
  );
}
