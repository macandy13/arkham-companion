import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type BoardView,
  type CardFaceView,
  type CardImagePath,
  type CardName,
  type EncounterSetCode,
} from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import { CardActions, cardActionsOn } from './ActionRow';
import { CounterBubble, type BubbleCount } from './CounterBubble';
import { BookFace } from './BookFace';
import { DetailsDialog, useDecisionHost } from './DetailsDialog';
import type { HeaderCardKind } from './useDetailView';
import { useDoubleTap } from './useDoubleTap';

/**
 * One place of the header: the playmat's `label` over the card or cards (`children`) that lie
 * there. The label names the place for screen readers too. With `onOpen` (the phone's compact
 * view), a tap anywhere in the place, its buttons included, opens the detail view on its `card`
 * instead: the tap is caught before it reaches them.
 */
export function HeaderSlot({
  label,
  card,
  onOpen,
  children,
}: {
  label: string;
  card?: HeaderCardKind;
  onOpen?: ((card: HeaderCardKind) => void) | undefined;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      data-slot={card}
      onClickCapture={
        card &&
        onOpen &&
        ((event) => {
          event.stopPropagation();
          onOpen(card);
        })
      }
    >
      <p id={id}>{label}</p>
      {children}
    </section>
  );
}

/**
 * The landscape card of the agenda or act (`kind`) in the header: its face printing `threshold`,
 * its name and, as `children`, its token and plate. A tap on the card, or on its name, which is a button for the
 * keyboard, calls `onOpen`; a tap on the plate's buttons only does what the button says. Without
 * `onOpen` (the card shown full) the name is plain text and a tap does nothing. With `bubble` a
 * double tap on the card opens the − / + bubble of its count (`CounterBubble`, M6.10),
 * so a single tap opens the card only once no second one came (`useDoubleTap`).
 */
export function HeaderCard({
  kind,
  name,
  image,
  set,
  threshold,
  onOpen,
  bubble,
  children,
}: {
  kind: 'agenda' | 'act';
  name: CardName;
  image: CardImagePath | undefined;
  set: EncounterSetCode | undefined;
  threshold: number | undefined;
  onOpen: (() => void) | undefined;
  bubble?: { title: string; counts: readonly BubbleCount[] } | undefined;
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<Element>();
  const tap = useDoubleTap<HTMLDivElement>(setAnchor, onOpen);
  const onCard = bubble ? tap : onOpen;
  // Beside the face, not in it: React passes the bubble's clicks up through the portal.
  return (
    <>
      <CardFace
        kind={kind}
        image={image}
        set={set}
        threshold={threshold}
        onClick={
          onCard &&
          ((event) => {
            if (!(event.target instanceof Element && event.target.closest('button'))) onCard(event);
          })
        }
      >
        <h2>
          {onOpen ? (
            <button type="button" onClick={onOpen}>
              {name}
            </button>
          ) : (
            name
          )}
        </h2>
        {children}
      </CardFace>
      {anchor && bubble && (
        <CounterBubble
          anchor={anchor}
          title={bubble.title}
          counts={bubble.counts}
          onClose={() => setAnchor(undefined)}
        />
      )}
    </>
  );
}

/**
 * The agenda or act (`kind`) opened from the header, on the card shell (`DetailsDialog`, MD.6b2):
 * - the landscape card over the page, the same face as in the header with its `token`, tapped to
 *   read it whole (`CardZoom`);
 * - what it is as the kicker, its name as the title;
 * - its count on the page (`value`: the doom in play, the clues that count towards advancing);
 * - the card actions it offers the investigator whose turn it is;
 * - the act's advances (`advances`): Advance as the dialog's one primary, and "Advance by hand".
 * A card action keeps it open and shows the decision it raises in place of its page
 * (`useDecisionHost`); Advance closes it first, since the act it was about is gone. The card text
 * joins it once the card data has text.
 */
export function BookDetails({
  kind,
  board,
  card,
  threshold,
  token,
  value,
  advances,
  onClose,
}: {
  kind: 'agenda' | 'act';
  board: BoardView;
  card: CardFaceView;
  threshold: number | undefined;
  token: ReactNode;
  value?: { name: string; count: number; threshold?: number };
  advances?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const hosted = useDecisionHost();
  const offered = cardActionsOn(board, card.id);
  return (
    <DetailsDialog
      board={board}
      hosted={hosted}
      name="book"
      card={card}
      drawn={
        <CardFace kind={kind} image={card.image} set={card.encounterSet} threshold={threshold}>
          {/* Inside the card's button, so its name is no second heading; the page's title is. */}
          <span data-part="name">{card.name}</span>
          {token}
        </CardFace>
      }
      kicker={t(`header.${kind}`)}
      title={card.name}
      onClose={onClose}
    >
      {value && (
        <dl>
          <div>
            <dt>{value.name}</dt>
            <dd>
              {value.threshold === undefined
                ? value.count
                : t('header.countOf', { count: value.count, threshold: value.threshold })}
            </dd>
          </div>
        </dl>
      )}
      {(offered.length > 0 || advances) && (
        <footer>
          {offered.length > 0 && (
            <CardActions board={board} offered={offered} onUse={hosted.host} />
          )}
          {advances}
        </footer>
      )}
    </DetailsDialog>
  );
}

/**
 * The face of the agenda or act (`kind`), holding its name, token and plate (`children`): in the
 * Exact card theme our drawing of the printed card (`BookFace`) with its `threshold` on the disc,
 * the art cut from its picture (`image`) once it has loaded (`data-picture`), the name on the
 * page and the token as the count on the disc. In the card pictures theme the whole picture lies
 * over the drawing once loaded, and the stylesheet hides the name the picture prints; the token
 * and plate stay, since their count and buttons are live.
 */
function CardFace({
  kind,
  image,
  set,
  threshold,
  onClick,
  children,
}: {
  kind: 'agenda' | 'act';
  image: CardImagePath | undefined;
  set: EncounterSetCode | undefined;
  threshold: number | undefined;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const picture = useCardPicture(image, 'landscape');
  return (
    <div data-card={kind} data-picture={picture?.shown ? 'shown' : undefined} onClick={onClick}>
      <BookFace kind={kind} picture={picture} threshold={threshold} set={set} />
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      {children}
    </div>
  );
}
