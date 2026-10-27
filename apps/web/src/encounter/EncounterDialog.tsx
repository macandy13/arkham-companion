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
 * The deck or pile tapped in the header (`start`) in full. Opened on the deck, it shows how many
 * cards are left with a "Draw for …" button per active investigator (the one whose turn it is
 * first), as player cards and effects make an investigator draw outside the mythos phase. A draw
 * closes the dialog, so the card resolves in front of the players (its decisions in the decision
 * dialog); nothing is drawn while a step is queued (`busy`), while the players adjust the board
 * (`adjusting`, since a draw is play, not a correction) or when deck and discard pile are both
 * empty. Opened on a pile, it shows the pile's cards in a row (`PileStrip`) with the places the
 * players can put the chosen one (`CardMoves`), for a revelation the engine left to them; its
 * Spawn closes the dialog and hands the enemy to `onSpawn`, so the players pick the location on
 * the map. A native
 * modal `<dialog>` brings focus trapping and Escape.
 */
export function EncounterDialog({
  board,
  start,
  actions,
  busy,
  adjusting,
  onSpawn,
  onClose,
}: {
  board: BoardView;
  start: EncounterPile;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onSpawn: (card: EncounterCardView) => void;
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
    <CardMoves
      board={board}
      card={card}
      actions={actions}
      busy={busy}
      onSpawn={(enemy) => {
        onClose();
        onSpawn(enemy);
      }}
    />
  );

  const piles = {
    discard: { title: t('encounter.discard'), cards: discard },
    setAside: { title: t('encounter.setAside'), cards: setAside },
    victoryDisplay: { title: t('encounter.victoryDisplay'), cards: victoryDisplay },
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="encounter">
      <button type="button" data-icon="close" aria-label={t('encounter.close')} onClick={onClose} />
      {start === 'deck' ? (
        <>
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
        </>
      ) : (
        <PileStrip
          titleId={titleId}
          title={piles[start].title}
          cards={piles[start].cards}
          moves={moves}
        />
      )}
    </dialog>
  );
}

/** How many cards of a pile the dialog shows side by side; more scroll, a whole card at a time. */
const STRIP_CARDS_SHOWN = 5;

/**
 * One pile as a row of its cards, top card first, like the threat area's: past
 * `STRIP_CARDS_SHOWN` cards the row scrolls by whole cards, with a swipe or its arrows. The card
 * tapped (the top card at first) shows its name, victory points and the places the players can
 * put it (`moves`) under the row. Empty, it says so instead.
 */
function PileStrip({
  titleId,
  title,
  cards,
  moves,
}: {
  titleId: string;
  title: string;
  cards: readonly EncounterCardView[];
  moves: (card: EncounterCardView) => ReactNode;
}) {
  const { t } = useTranslation();
  const strip = useRef<HTMLUListElement>(null);
  const [chosenId, setChosenId] = useState(cards[0]?.id);
  const chosen = cards.find((card) => card.id === chosenId) ?? cards[0];
  // One card's width is enough: the strip snaps to whole cards, so the scroll ends on the next one.
  const scroll = (direction: -1 | 1) => {
    const card = strip.current?.firstElementChild;
    if (card instanceof HTMLElement)
      strip.current?.scrollBy({ left: direction * card.offsetWidth, behavior: 'smooth' });
  };
  const overflowing = cards.length > STRIP_CARDS_SHOWN;
  return (
    <>
      <h2 id={titleId}>{t('encounter.pile', { pile: title, count: cards.length })}</h2>
      {chosen === undefined ? (
        <p>{t('encounter.empty')}</p>
      ) : (
        <>
          <div>
            {overflowing && (
              <button
                type="button"
                data-icon="previous"
                aria-label={t('encounter.earlierCards')}
                onClick={() => scroll(-1)}
              />
            )}
            <ul ref={strip} aria-label={title}>
              {cards.map((card) => (
                <StripCard
                  key={card.id}
                  card={card}
                  chosen={card.id === chosen.id}
                  onChoose={() => setChosenId(card.id)}
                />
              ))}
            </ul>
            {overflowing && (
              <button
                type="button"
                data-icon="next"
                aria-label={t('encounter.laterCards')}
                onClick={() => scroll(1)}
              />
            )}
          </div>
          <section aria-label={chosen.name}>
            <h3>
              {chosen.name}
              {chosen.victory !== undefined && (
                <data value={chosen.victory}>
                  {t('encounter.victory', { count: chosen.victory })}
                </data>
              )}
            </h3>
            {moves(chosen)}
          </section>
        </>
      )}
    </>
  );
}

/**
 * One card of the row: its picture (the card art pattern until it loads, or when the card data
 * has none), a button named for the card that chooses it.
 */
function StripCard({
  card,
  chosen,
  onChoose,
}: {
  card: EncounterCardView;
  chosen: boolean;
  onChoose: () => void;
}) {
  const picture = useCardPicture(card.image);
  return (
    <li data-picture={picture?.shown ? 'shown' : undefined}>
      <button type="button" aria-label={card.name} aria-pressed={chosen} onClick={onChoose}>
        {picture && (
          <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
        )}
      </button>
    </li>
  );
}
