import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardFaceView } from '@arkham/engine';
import { sentences } from '@arkham/util';
import { useCardPicture } from '../catalog/cardImages';
import { useBackCloses } from './useBackCloses';
import './card_zoom.css';

/**
 * One card picked up to read (`CardFaceView`), as big as a zoomed card: its picture once it has
 * loaded, and under the picture, for a card without one or until it loads, what the card data
 * says of it in our own frame: its name, type and traits. A card with a back turns over with a
 * button. Under it, as `children`, the action row of what the card offers the investigator whose
 * turn it is (`CardActions`), when it offers anything, given the zoom's own `close` for the
 * actions that close it; reading it alone changes nothing in the game. A native modal `<dialog>`
 * brings focus trapping and Escape. On a phone it fills the screen and the back gesture closes it
 * too (`useBackCloses`), which is why its actions close it through `close`.
 */
export function CardZoom({
  card,
  onClose,
  children,
}: {
  card: CardFaceView;
  onClose: () => void;
  children?: (close: () => void) => ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const close = useBackCloses(onClose);
  const actionRow = children?.(close);
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
      {card.backImage !== undefined && (
        <button type="button" onClick={() => setSide(side === 'front' ? 'back' : 'front')}>
          {t(side === 'front' ? 'cardZoom.showBack' : 'cardZoom.showFront')}
        </button>
      )}
      {actionRow && <footer>{actionRow}</footer>}
    </dialog>
  );
}
