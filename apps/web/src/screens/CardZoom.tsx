import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardFaceView } from '@arkham/engine';
import { sentences } from '@arkham/util';
import { useCardPicture } from '../catalog/cardImages';
import { TreacheryCard } from '../treacheries/TreacheryCard';
import { useBackCloses } from './useBackCloses';
import './card_zoom.css';

/**
 * One card picked up to read (`CardFaceView`), as big as a zoomed card: a treachery's front drawn
 * as its card (`TreacheryCard`); any other card or side as its picture once it has loaded, and
 * under the picture, for a card without one or until it loads, what the card data says of it in
 * our own frame: its name, type and traits. A card with a back turns over with a button. It
 * opens from the card shell's card (`CardDialog`) and from a location's attached cards; reading
 * it changes nothing in the game, so it offers no actions (the shell's page does). A native modal
 * `<dialog>` brings focus trapping and Escape. On a phone it fills the screen and the back
 * gesture closes it too (`useBackCloses`).
 */
export function CardZoom({ card, onClose }: { card: CardFaceView; onClose: () => void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const close = useBackCloses(onClose);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const picture = useCardPicture(side === 'front' ? card.image : card.backImage);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // React passes `cancel` on to the dialogs around it, and Escape here closes only the zoom.
        event.stopPropagation();
        close();
      }}
      data-dialog="card-zoom"
    >
      <button type="button" data-icon="close" aria-label={t('cardZoom.close')} onClick={close} />
      {card.type === 'treachery' && side === 'front' ? (
        <TreacheryCard card={card} titleId={titleId} />
      ) : (
        <article data-card={card.type} data-picture={picture?.shown ? 'shown' : undefined}>
          {picture && (
            <img
              src={picture.url}
              alt={t(`cardZoom.picture.${side}`, { name: card.name })}
              onLoad={picture.onLoad}
              onError={picture.onError}
            />
          )}
          <h2 id={titleId}>{card.name}</h2>
          <p>{t(`cardZoom.type.${card.type}`)}</p>
          {card.traits.length > 0 && <p>{sentences(card.traits)}</p>}
        </article>
      )}
      {card.backImage !== undefined && (
        <button type="button" onClick={() => setSide(side === 'front' ? 'back' : 'front')}>
          {t(side === 'front' ? 'cardZoom.showBack' : 'cardZoom.showFront')}
        </button>
      )}
    </dialog>
  );
}
