import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardFaceView, CardName, CardStats, InstanceId } from '@arkham/engine';
import { attachableCards } from '@arkham/scenarios';
import type { GameActions } from '../state/gameActions';
import { CardZoom } from './CardZoom';

/**
 * The cards attached to a location or an enemy (`host`) on its details' page, in one row: each
 * card's name opens it large to read, its picture saying what it does (`CardZoom`), with a × that
 * discards it, as a Forced ability or a card says (`GameActions.discardCard`), and a + at the end
 * for a player card the players attached at the table (`AttachCardDialog`), one of those that
 * attach to a card of the host's type (`attachableCards`). Nothing is tapped while a step is queued (`busy`).
 */
export function AttachedCards({
  board,
  host,
  actions,
  busy,
}: {
  board: BoardView;
  host: InstanceId;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [zoomed, setZoomed] = useState<CardFaceView>();
  const [attaching, setAttaching] = useState(false);
  const cards = board.cardsIn({ kind: 'attachedTo', hostId: host });
  const { name, type } = board.cardFace(host);
  const attachable = type === 'enemy' || type === 'location' ? attachableCards(type) : [];
  if (cards.length === 0 && attachable.length === 0) return null;
  return (
    <section aria-labelledby={titleId} data-part="attached">
      <h3 id={titleId}>{t('attached.title')}</h3>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={t('cardZoom.open', { name: card.name })}
              onClick={() => setZoomed(card)}
            >
              {card.name}
            </button>
            <button
              type="button"
              data-icon="close"
              aria-label={t('attached.discardCard', { card: card.name })}
              disabled={busy}
              onClick={() => void actions.discardCard(card.id)}
            />
          </li>
        ))}
        {attachable.length > 0 && (
          <li>
            <button
              type="button"
              data-icon="add"
              aria-haspopup="dialog"
              aria-label={t('attached.attach')}
              disabled={busy}
              onClick={() => setAttaching(true)}
            />
          </li>
        )}
      </ul>
      {zoomed && <CardZoom card={zoomed} onClose={() => setZoomed(undefined)} />}
      {attaching && (
        <AttachCardDialog
          host={name}
          cards={attachable}
          onAttach={(card) => void actions.attachPlayerCard(host, card.code)}
          onClose={() => setAttaching(false)}
        />
      )}
    </section>
  );
}

/**
 * The player cards that attach to `host`, by name, to pick the one the players attached at the
 * table, and Cancel. A native modal `<dialog>` over the details brings focus trapping and Escape,
 * which closes only it. It leaves the phone's back gesture to the details (`useBackCloses`),
 * since each card entry's back step closes every card that listens, and this one is small.
 */
function AttachCardDialog({
  host,
  cards,
  onAttach,
  onClose,
}: {
  host: CardName;
  cards: readonly CardStats[];
  onAttach: (card: CardStats) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-dialog="attach-card"
      onCancel={(event) => {
        // React passes `cancel` on to the details around it, and Escape here closes only this one.
        event.stopPropagation();
        onClose();
      }}
    >
      <h2 id={titleId}>{t('attached.attachTo', { host })}</h2>
      <ul>
        {cards.map((card) => (
          <li key={card.code}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onAttach(card);
              }}
            >
              {card.name}
            </button>
          </li>
        ))}
      </ul>
      <footer>
        <button type="button" onClick={onClose}>
          {t('games.cancel')}
        </button>
      </footer>
    </dialog>
  );
}
