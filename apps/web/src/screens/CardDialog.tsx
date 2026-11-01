import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardFaceView, CardType, InvestigatorView } from '@arkham/engine';
import type { ShownCard } from '../catalog/cardFace';
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
 * The cards of the decisions that wait after this one (`waiting`, the next enemies to attack) fan
 * out behind it.
 * Opening and closing stay the caller's: the shell opens as a modal when it mounts and passes on
 * `cancel` (Escape), so a dialog that must be answered can refuse it; one the players may leave
 * gets an × (`onClose`), and one that must be answered can be lowered out of the board's way
 * (`lowered`, `onLower`), so the players can adjust the board on the game screen or pick a
 * location on the map first. The caller keeps whether it is lowered, since picking on the map
 * lowers it too.
 */
export function CardDialog({
  name,
  card,
  drawn,
  waiting = [],
  actor,
  kicker,
  title,
  onCancel,
  onClose,
  lowered = false,
  onLower,
  children,
}: {
  /** The dialog's `data-dialog`, which its own stylesheet styles its content by. */
  name: string;
  card?: ShownCard;
  /**
   * The card drawn in place of its picture, when the dialog has a drawing of it that lays the
   * picture over itself once loaded (an enemy's `EnemyCard`, a location's `LocationCard`), so it reads offline too.
   */
  drawn?: ReactNode;
  /** The cards behind `card`, next first (`DecisionView.waiting`). */
  waiting?: readonly CardFaceView[];
  actor?: InvestigatorView;
  kicker?: ReactNode;
  title: ReactNode;
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  /** For a dialog the players may leave: the × in the page's corner. */
  onClose?: () => void;
  /** Whether the dialog is lowered to a strip along the bottom, where the board takes taps. */
  lowered?: boolean;
  /**
   * For a dialog that must be answered but leaves the board in reach (a decision): its grab handle
   * asks to lower it, or to raise it again when it is `lowered`.
   */
  onLower?: (lowered: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    // A modal makes the board inert, so a lowered dialog is shown as a plain one instead.
    if (element.open) element.close();
    if (lowered) element.show();
    else element.showModal();
  }, [lowered]);
  const [zoomed, setZoomed] = useState(false);
  const layout = card === undefined ? (actor ? 'portrait' : 'page') : orientationOf(card);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onCancel}
      data-dialog={name}
      data-shell={layout}
      data-lowered={lowered || undefined}
    >
      {card && (
        <figure data-part="cards">
          {waiting.length > 0 && (
            <ul aria-label={t('cardDialog.waiting')}>
              {waiting.map((each) => (
                <WaitingCard key={each.id} card={each} />
              ))}
            </ul>
          )}
          <SubjectCard card={card} drawn={drawn} onOpen={() => setZoomed(true)} />
        </figure>
      )}
      {card === undefined && actor && <InvestigatorArt image={actor.image} />}
      {/* Lowered, the strip is small, so a tap anywhere on it raises it, not only on the handle. */}
      <article onClick={lowered && onLower ? () => onLower(false) : undefined}>
        {onLower && (
          <button
            type="button"
            data-part="grab"
            aria-label={t(lowered ? 'cardDialog.raise' : 'cardDialog.lower')}
            onClick={(event) => {
              // Lowered, the strip around it raises the dialog too; one request is enough.
              event.stopPropagation();
              onLower(!lowered);
            }}
          />
        )}
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

function orientationOf(card: ShownCard): 'beside' | 'above' {
  return LANDSCAPE.has(card.type) ? 'above' : 'beside';
}

/** A card waiting behind the subject: its picture once it has loaded, else its name. */
function WaitingCard({ card }: { card: CardFaceView }) {
  const picture = useCardPicture(card.image);
  return (
    <li data-picture={picture?.shown ? 'shown' : undefined}>
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <span>{card.name}</span>
    </li>
  );
}

/**
 * The card a dialog is about: its drawing (`drawn`), or its picture once it has loaded; until
 * then, and for good without one, its name on the card's pattern says what it is.
 */
function SubjectCard({
  card,
  drawn,
  onOpen,
}: {
  card: ShownCard;
  drawn: ReactNode;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const label = t('cardZoom.open', { name: card.name });
  if (drawn !== undefined)
    return (
      <button type="button" data-part="subject" aria-label={label} onClick={onOpen}>
        {drawn}
      </button>
    );
  return <PictureCard card={card} label={label} onOpen={onOpen} />;
}

/** The subject card as its picture, or its name on the card's pattern until that has loaded. */
function PictureCard({
  card,
  label,
  onOpen,
}: {
  card: ShownCard;
  label: string;
  onOpen: () => void;
}) {
  const picture = useCardPicture(card.image);
  return (
    <button
      type="button"
      data-part="subject"
      data-picture={picture?.shown ? 'shown' : undefined}
      aria-label={label}
      onClick={onOpen}
    >
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <span>{card.name}</span>
    </button>
  );
}
