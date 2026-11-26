import { useTranslation } from 'react-i18next';
import { type BoardView, type EncounterCardView } from '@arkham/engine';
import { EncounterPiles, HeaderPile, type PileProps } from '../encounter/EncounterPiles';
import type { OpenGame } from '../state/appStore';
import { TokenPool } from './TokenPool';
import { ChaosBagButton } from './ChaosBagButton';
import type { HeaderCardKind } from './useDetailView';
import { HeaderSlot } from './HeaderSlot';
import { type PrintedReference, ScenarioStatus } from './ScenarioStatus';
import { AgendaStatus } from './AgendaStatus';
import { ActStatus } from './ActStatus';

/**
 * The play screen's header, laid out like the scenario's cards on the table, centred and each under
 * its label like the playmat's: the chaos bag at the left end (`ChaosBagButton`), the encounter deck
 * and its discard pile, the agenda, the act and the scenario card, the victory display, and the
 * token pool at the right end (`TokenPool`), the bag and the pool on either side of the cards. The scenario's name is the screen's heading. The cards' buttons wait while a
 * step is queued (`OpenGame.busy`), since a second tap would act on whatever the first one leaves
 * open; the agenda's doom and the act's clues change in place through their − / + bubbles. The round, the phase and the buttons that run the game sit in the status
 * row below (`GameStatus`). A tap on the agenda or act opens it on the card shell (`BookDetails`).
 * `board` is the open game's `OpenGame.board`. On a phone's compact view a tap on any of the four
 * cards or on the token pool calls `onOpenCard` instead (the detail view opens on it), so the
 * card's own buttons and dialogs, and the pool's dragging, wait for the detail view; the bag opens
 * its dialog there as anywhere. There the cards show `full`: the agenda and act are already
 * as large as the screen allows, so their action rows sit under them and a tap opens no second,
 * full-card dialog; the upright scenario card is too narrow there for its rows, so it still opens
 * its own. `printedReference` is what the card catalog prints on the scenario card's
 * side in play; until it has loaded the card shows its rows without texts. A pile's Spawn hands
 * the enemy to `onSpawn`, so the players pick where it spawns on the map.
 */
export function GameHeader({
  open,
  board,
  printedReference,
  onOpenCard,
  full = false,
  onSpawn,
}: {
  open: OpenGame;
  board: BoardView;
  printedReference: PrintedReference | undefined;
  onOpenCard?: ((card: HeaderCardKind) => void) | undefined;
  full?: boolean;
  onSpawn: (enemy: EncounterCardView) => void;
}) {
  const { t } = useTranslation();
  const piles: PileProps = { board, onSpawn };

  return (
    <header>
      <HeaderSlot label={t('chaosBag.title')}>
        <ChaosBagButton board={board} />
      </HeaderSlot>
      <HeaderSlot label={t('header.encounterDeck')} card="encounter" onOpen={onOpenCard}>
        <EncounterPiles {...piles} />
      </HeaderSlot>
      <AgendaStatus board={board} full={full} onOpen={onOpenCard} />
      <ActStatus board={board} full={full} piles={piles} onOpen={onOpenCard} />
      <HeaderSlot label={t('header.scenario')} card="scenario" onOpen={onOpenCard}>
        <ScenarioStatus open={open} board={board} printed={printedReference} opens={!onOpenCard} />
        <HeaderPile pile="setAside" {...piles} />
      </HeaderSlot>
      <HeaderSlot label={t('header.victory')}>
        <HeaderPile pile="victoryDisplay" {...piles} />
      </HeaderSlot>
      <TokenPool onOpen={onOpenCard} />
    </header>
  );
}
