import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, EncounterCardView } from '@arkham/engine';
import { matchingFirst } from '@arkham/util';
import { useCardPicture } from '../catalog/cardImages';
import type { GameActions } from '../state/gameActions';
import { CardMoves } from './CardMoves';

/** Where the encounter dialog opens (`EncounterDialog.start`): on the deck or on one of its piles. */
export type EncounterPile = 'deck' | HeaderPileKind;

/** The piles the header fans beside its cards (`HeaderPile`), each opening the dialog on itself. */
export type HeaderPileKind = 'discard' | 'setAside' | 'victoryDisplay';

/**
 * The encounter piles in full, opened from the header's deck or one of its piles: how many cards are
 * left in the deck with a "Draw for …" button per active investigator (the one whose turn it is
 * first), as player cards and effects make an investigator draw outside the mythos phase, then the
 * discard pile (top first), the set-aside cards and the victory display
 * as lists that open and close (`details`), each card with a small picture and its name. Opened
 * from a pile (`start`), that pile's list starts open. A tap on a card opens the places the
 * players can put it (`CardMoves`), for a revelation the engine left to them. A draw closes the dialog, so the card resolves
 * in front of the players (its decisions in the decision dialog); nothing is drawn while a step is
 * queued (`busy`), while the players adjust the board (`adjusting`, since a draw is play, not a
 * correction) or when deck and discard pile are both empty. A native modal `<dialog>` brings
 * focus trapping and Escape.
 */
export function EncounterDialog({
  board,
  start,
  actions,
  busy,
  adjusting,
  onClose,
}: {
  board: BoardView;
  start: EncounterPile;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const { deckCount, discard, setAside, victoryDisplay } = board.encounter;
  const drawers = matchingFirst(
    board.investigators.filter((investigator) => investigator.status === 'active'),
    (investigator) => investigator.id === board.turn,
  );
  const empty = deckCount === 0 && discard.length === 0;
  const moves = (card: EncounterCardView) => (
    <CardMoves board={board} card={card} actions={actions} busy={busy} />
  );

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="encounter">
      <button type="button" data-icon="close" aria-label={t('encounter.close')} onClick={onClose} />
      <h2 id={titleId}>{t('header.encounterDeck')}</h2>
      <p>{t('header.encounterDeckCount', { count: deckCount })}</p>
      <footer>
        {drawers.map((investigator) => (
          <button
            key={investigator.id}
            type="button"
            disabled={busy || adjusting || empty}
            onClick={() => {
              onClose();
              void actions.drawEncounter(investigator.id);
            }}
          >
            {t('encounter.drawFor', { name: investigator.name })}
          </button>
        ))}
      </footer>
      <CardList
        title={t('encounter.discard')}
        cards={discard}
        open={start === 'discard'}
        moves={moves}
      />
      <CardList
        title={t('encounter.setAside')}
        cards={setAside}
        open={start === 'setAside'}
        moves={moves}
      />
      <CardList
        title={t('encounter.victoryDisplay')}
        cards={victoryDisplay}
        open={start === 'victoryDisplay'}
        moves={moves}
      />
    </dialog>
  );
}

/**
 * One pile as a list that opens and closes, titled with its name and count; `open` is how it
 * starts. Empty, it says so instead of listing.
 */
function CardList({
  title,
  cards,
  open,
  moves,
}: {
  title: string;
  cards: readonly EncounterCardView[];
  open: boolean;
  moves: (card: EncounterCardView) => ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <details open={open}>
      <summary>{t('encounter.pile', { pile: title, count: cards.length })}</summary>
      {cards.length === 0 ? (
        <p>{t('encounter.empty')}</p>
      ) : (
        <ul>
          {cards.map((card) => (
            <CardEntry key={card.id} card={card} moves={moves} />
          ))}
        </ul>
      )}
    </details>
  );
}

/**
 * One card of a pile: a small picture of its front (the card art pattern until it loads, or when
 * the card data has none), its name and, where it has them, its victory points. A tap opens the
 * places the players can put it (`moves`, rendered only while open).
 */
function CardEntry({
  card,
  moves,
}: {
  card: EncounterCardView;
  moves: (card: EncounterCardView) => ReactNode;
}) {
  const { t } = useTranslation();
  const picture = useCardPicture(card.image);
  const [open, setOpen] = useState(false);
  return (
    <li data-picture={picture?.shown ? 'shown' : undefined}>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          {picture && (
            <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
          )}
          {card.name}
          {card.victory !== undefined && (
            <data value={card.victory}>{t('encounter.victory', { count: card.victory })}</data>
          )}
        </summary>
        {open && moves(card)}
      </details>
    </li>
  );
}
