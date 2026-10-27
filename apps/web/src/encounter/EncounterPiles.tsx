import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, EncounterCardView } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import { Token } from '../screens/Token';
import { EncounterDialog, type EncounterPile } from './EncounterDialog';
import './encounter.css';

/**
 * The encounter piles in the header (`BoardView.encounter`): the deck as an upright card back with
 * the cards left on a round token, like the agenda's doom, and its discard pile beside it. Both are
 * buttons that open the encounter dialog (`EncounterDialog`), on the pile tapped.
 */
export function EncounterPiles({ board }: { board: BoardView }) {
  const { t } = useTranslation();
  const [openOn, setOpenOn] = useState<EncounterPile>();
  const { deckCount, discard } = board.encounter;
  return (
    <>
      <button type="button" data-card="encounter" onClick={() => setOpenOn('deck')}>
        <Token
          kind="cards"
          count={deckCount}
          label={t('header.encounterDeckCount', { count: deckCount })}
        />
      </button>
      <DiscardPile top={discard[0]} count={discard.length} onOpen={() => setOpenOn('discard')} />
      {openOn && (
        <EncounterDialog board={board} start={openOn} onClose={() => setOpenOn(undefined)} />
      )}
    </>
  );
}

/**
 * The encounter discard pile as a small card beside the deck: the picture of its `top` card (the
 * card art pattern until it loads, or when the card data has none) and its `count`. Empty, it is
 * only the dashed outline of a card. A tap opens the encounter dialog on it (`onOpen`).
 */
function DiscardPile({
  top,
  count,
  onOpen,
}: {
  top: EncounterCardView | undefined;
  count: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const picture = useCardPicture(top?.image);
  if (!top)
    return (
      <button
        type="button"
        aria-label={t('header.encounterDiscard')}
        data-pile="discard"
        onClick={onOpen}
      />
    );
  return (
    <button
      type="button"
      aria-label={t('header.encounterDiscardTop', { count, card: top.name })}
      data-pile="discard"
      data-picture={picture?.shown ? 'shown' : undefined}
      onClick={onOpen}
    >
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <data value={count}>{count}</data>
    </button>
  );
}
