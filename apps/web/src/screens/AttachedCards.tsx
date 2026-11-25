import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  attachPlayerCard,
  type BoardView,
  type CardFaceView,
  type CardName,
  type CardStats,
  type InstanceId,
  move,
} from '@arkham/engine';
import { attachableCards } from '@arkham/scenarios';
import type { GameActions } from '../state/gameActions';
import { useCardPicture } from '../catalog/cardImages';
import { TuckedCardsContext } from './CardDialog';
import { CardZoom } from './CardZoom';
import { encounterDiscard } from '@arkham/engine';

/**
 * The cards attached to a location or an enemy (`host`), fanned as small cards across the bottom
 * edge of its details, half outside the page, like cards tucked under it (ME.31b): in a card
 * dialog they go to its `TuckedCardsContext` slot, since the scrolling page would cut them off;
 * in the phone's location mode they stay in place. A card opens large to read, its picture saying
 * what it does (`CardZoom`), with Discard under it, as a Forced ability or a card says
 * (a performed `MoveCard` onto the encounter discard). A dashed card at the end attaches a player card the players
 * attached at the table (`AttachCardDialog`), one of those that attach to a card of the host's
 * type (`attachableCards`). Nothing is tapped while a step is queued (`busy`).
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
  const tucked = useContext(TuckedCardsContext);
  const [zoomed, setZoomed] = useState<CardFaceView>();
  const [attaching, setAttaching] = useState(false);
  const cards = board.cardsIn({ kind: 'attachedTo', hostId: host });
  const { name, type } = board.cardFace(host);
  const attachable = type === 'enemy' || type === 'location' ? attachableCards(type) : [];
  if (cards.length === 0 && attachable.length === 0) return null;
  const fan = (
    <section aria-labelledby={titleId} data-part="attached">
      <h3 id={titleId}>{t('attached.title')}</h3>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <AttachedCard card={card} onOpen={() => setZoomed(card)} />
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
      {zoomed && (
        <CardZoom card={zoomed} onClose={() => setZoomed(undefined)}>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setZoomed(undefined);
              void actions.perform(move(zoomed.id, encounterDiscard, 'top'));
            }}
          >
            {t('attached.discardCard', { card: zoomed.name })}
          </button>
        </CardZoom>
      )}
      {attaching && (
        <AttachCardDialog
          host={name}
          cards={attachable}
          onAttach={(card) => void actions.perform(attachPlayerCard(host, card.code))}
          onClose={() => setAttaching(false)}
        />
      )}
    </section>
  );
  return tucked ? createPortal(fan, tucked) : fan;
}

/** One attached card in the fan: its picture, or its name on the card's pattern until that loads. */
function AttachedCard({ card, onOpen }: { card: CardFaceView; onOpen: () => void }) {
  const { t } = useTranslation();
  const picture = useCardPicture(card.image);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={t('cardZoom.open', { name: card.name })}
      data-picture={picture?.shown ? 'shown' : undefined}
      onClick={onOpen}
    >
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <span>{card.name}</span>
    </button>
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
