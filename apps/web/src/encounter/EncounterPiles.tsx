import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { BoardView, EncounterCardView } from '@arkham/engine';
import { Token } from '../screens/Token';
import type { GameActions } from '../state/gameActions';
import { EncounterDialog, type HeaderPileKind } from './EncounterDialog';
import { PileFan } from './PileFan';
import './encounter.css';

/**
 * What the header's piles share: the board they show, the `actions` their dialog plays, whether a
 * step is queued (`busy`) or the players adjust the board (`adjusting`), and `onSpawn`, which lets
 * the players choose on the map where an enemy from a pile spawns.
 */
export interface PileProps {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onSpawn: (card: EncounterCardView) => void;
}

/**
 * The encounter deck in the header (`BoardView.encounter`): an upright card back with the cards
 * left on a round token, like the agenda's doom, and its discard pile fanned at its lower right
 * corner (`HeaderPile`). The deck opens the encounter dialog (`EncounterDialog`) on its draw
 * buttons, which draw with `actions` unless a step is queued or the players adjust the board.
 */
export function EncounterPiles(props: PileProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { deckCount } = props.board.encounter;
  return (
    <>
      <button type="button" data-card="encounter" onClick={() => setOpen(true)}>
        <Token
          kind="cards"
          count={deckCount}
          label={t('header.encounterDeckCount', { count: deckCount })}
        />
      </button>
      <HeaderPile pile="discard" {...props} />
      {open && <EncounterDialog {...props} start="deck" onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * One of the header's piles fanned (`PileFan`): the encounter discard pile at the deck's corner,
 * the set-aside cards at the scenario card's, or the victory display in its own slot with the
 * victory points earned so far (`BoardView.victoryPoints`) on its disc. A tap opens the encounter
 * dialog on it.
 */
export function HeaderPile({ pile, ...props }: PileProps & { pile: HeaderPileKind }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { board } = props;
  const cards = board.encounter[pile];
  const value = pile === 'victoryDisplay' ? board.victoryPoints : cards.length;
  const label = pileLabel(pile, cards, value, t);
  return (
    <>
      <PileFan pile={pile} cards={cards} value={value} label={label} onOpen={() => setOpen(true)} />
      {open && <EncounterDialog {...props} start={pile} onClose={() => setOpen(false)} />}
    </>
  );
}

/** What a screen reader hears for a header pile: its name, its count or points, the top discard. */
function pileLabel(
  pile: HeaderPileKind,
  cards: readonly EncounterCardView[],
  value: number,
  t: TFunction,
): string {
  switch (pile) {
    case 'discard': {
      const [top] = cards;
      return top
        ? t('header.encounterDiscardTop', { count: cards.length, card: top.name })
        : t('header.encounterDiscard');
    }
    case 'setAside':
    case 'victoryDisplay':
      return t(`header.${pile}`, { count: value });
  }
}
