import { useTranslation } from 'react-i18next';
import type { BoardView, EncounterCardView } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import { Token } from '../screens/Token';

/**
 * The encounter piles in the header (`BoardView.encounter`): the deck as an upright card back with
 * the cards left on a round token, like the agenda's doom, and its discard pile beside it.
 */
export function EncounterPiles({ board }: { board: BoardView }) {
  const { t } = useTranslation();
  const { deckCount, discard } = board.encounter;
  return (
    <>
      <div data-card="encounter">
        <Token
          kind="cards"
          count={deckCount}
          threshold={undefined}
          label={t('header.encounterDeckCount', { count: deckCount })}
        />
      </div>
      <DiscardPile top={discard[0]} count={discard.length} />
    </>
  );
}

/**
 * The encounter discard pile as a small card beside the deck: the picture of its `top` card (the
 * card art pattern until it loads, or when the card data has none) and its `count`. Empty, it is
 * only the dashed outline of a card.
 */
function DiscardPile({ top, count }: { top: EncounterCardView | undefined; count: number }) {
  const { t } = useTranslation();
  const picture = useCardPicture(top?.image);
  if (!top) return <div role="img" aria-label={t('header.encounterDiscard')} data-pile="discard" />;
  return (
    <div
      role="img"
      aria-label={t('header.encounterDiscardTop', { count, card: top.name })}
      data-pile="discard"
      data-picture={picture?.shown ? 'shown' : undefined}
    >
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
      <data value={count}>{count}</data>
    </div>
  );
}
