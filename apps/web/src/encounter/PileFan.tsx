import type { EncounterCardView } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import type { HeaderPileKind } from './EncounterDialog';

/** How many of a pile's top cards the header fans out; more would crowd the corner it sits in. */
const FANNED_CARDS = 3;

/**
 * A pile in the header as a small fan of its top cards, slightly turned against each other like a
 * pile on the table, with `value` on a disc: the encounter discard pile at the deck's lower right
 * corner and the set-aside cards at the scenario card's (their card counts), or the victory display
 * in its own slot (the victory points earned, which cleared locations add to even while it is
 * empty). Without cards, it is only the dashed outline of a card. A
 * tap opens the encounter dialog on it (`onOpen`).
 */
export function PileFan({
  pile,
  cards,
  value,
  label,
  onOpen,
}: {
  pile: HeaderPileKind;
  cards: readonly EncounterCardView[];
  value: number;
  label: string;
  onOpen: () => void;
}) {
  const fanned = cards.slice(0, FANNED_CARDS).reverse();
  return (
    <button type="button" aria-label={label} data-pile={pile} onClick={onOpen}>
      {fanned.length > 0 && (
        <ul>
          {fanned.map((card) => (
            <FannedCard key={card.id} card={card} />
          ))}
        </ul>
      )}
      {(fanned.length > 0 || value > 0) && <data value={value}>{value}</data>}
    </button>
  );
}

/** One fanned card: its picture, over the card art pattern until it loads or when it has none. */
function FannedCard({ card }: { card: EncounterCardView }) {
  const picture = useCardPicture(card.image);
  return (
    <li data-picture={picture?.shown ? 'shown' : undefined}>
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
    </li>
  );
}
