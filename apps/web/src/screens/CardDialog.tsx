import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardFaceView, CardType, InvestigatorView } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import { InvestigatorArt } from '../investigators/InvestigatorArt';
import { CardZoom } from './CardZoom';
import './card_dialog.css';

/** The cards printed sideways, which stand over the page rather than beside it. */
const LANDSCAPE: ReadonlySet<CardType> = new Set<CardType>(['agenda', 'act']);

/**
 * The shell of an in-game dialog (MD.2a, the design language's "card beside the page"): a modal
 * `<dialog>` holding the card it is about and a page of the guide with the title, its kicker and
 * the dialog's own content (`children`). On a tablet the card stands beside the page, a sideways
 * card (agenda, act) over it; without a card, the investigator who acts (`actor`) stands large
 * over the page instead, and with one they sit small in the kicker. On a phone held upright the
 * page is a sheet along the bottom with the card peeking out beside its title (card_dialog.css).
 * The card is a button that opens it whole (`CardZoom`), since on a phone only its top shows.
 * Opening and closing stay the caller's: the shell opens as a modal when it mounts and passes on
 * `cancel` (Escape), so a dialog that must be answered can refuse it; one the players may leave
 * gets an × (`onClose`).
 */
export function CardDialog({
  name,
  card,
  actor,
  kicker,
  title,
  onCancel,
  onClose,
  children,
}: {
  /** The dialog's `data-dialog`, which its own stylesheet styles its content by. */
  name: string;
  card?: CardFaceView;
  actor?: InvestigatorView;
  kicker?: ReactNode;
  title: ReactNode;
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  /** For a dialog the players may leave: the × in the page's corner. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const [zoomed, setZoomed] = useState(false);
  const layout = card === undefined ? (actor ? 'portrait' : 'page') : orientationOf(card);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onCancel}
      data-dialog={name}
      data-shell={layout}
    >
      {card && <SubjectCard card={card} onOpen={() => setZoomed(true)} />}
      {card === undefined && actor && <InvestigatorArt image={actor.image} />}
      <article>
        {onClose && (
          <button
            type="button"
            data-icon="close"
            aria-label={t('cardZoom.close')}
            title={t('cardZoom.close')}
            onClick={onClose}
          />
        )}
        <hgroup>
          {kicker !== undefined && (
            <p>
              {card && actor && <InvestigatorArt image={actor.image} />}
              {kicker}
            </p>
          )}
          <h2 id={titleId}>{title}</h2>
        </hgroup>
        {children}
      </article>
      {zoomed && card && <CardZoom card={card} onClose={() => setZoomed(false)} />}
    </dialog>
  );
}

function orientationOf(card: CardFaceView): 'beside' | 'above' {
  return LANDSCAPE.has(card.type) ? 'above' : 'beside';
}

/**
 * The card a dialog is about, its picture once it has loaded; until then, and for good without
 * one, its name on the card's pattern says what it is.
 */
function SubjectCard({ card, onOpen }: { card: CardFaceView; onOpen: () => void }) {
  const { t } = useTranslation();
  const picture = useCardPicture(card.image);
  return (
    <button
      type="button"
      data-part="subject"
      data-picture={picture?.shown ? 'shown' : undefined}
      aria-label={t('cardZoom.open', { name: card.name })}
      onClick={onOpen}
    >
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <span>{card.name}</span>
    </button>
  );
}
