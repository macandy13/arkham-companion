import type { ReactNode } from 'react';
import type { BoardView, InvestigatorId } from '@arkham/engine';
import { locationAt } from '../map/dropTarget';
import { cardActionsOn } from '../screens/ActionRow';
import { useCluePayment } from '../screens/CluePaymentDialog';
import { overHeaderCard } from '../screens/headerDropTarget';
import { TokenGhost } from '../screens/TokenGhost';
import { useTokenDrag, type TokenDragHandlers } from '../screens/useTokenDrag';
import type { GameActions } from '../state/gameActions';

/**
 * Dragging a clue off `investigator`'s clue count (M3.11c): `handlers` for the count, and
 * `shown`, what the drag puts on the page (the clue token under the finger, `TokenGhost`, and the
 * choice of who pays an advance, `useCluePayment`). A drop
 * - on the investigator's own location places the clue there (`GameActions.placeClue`), as a card
 *   or a failed test tells them to; another location takes nothing;
 * - on the act does what its own button does: an act the investigators advance by spending clues
 *   advances once they hold enough, after the players choose who pays (`advanceAct`); on an act
 *   that takes clues on it, the investigator whose turn it is takes its action that costs a clue
 *   (`OfferedCardAction.clues`, Disrupting the Ritual), whose test decides whether one lands there.
 */
export function useClueDrag(
  board: BoardView,
  investigator: InvestigatorId,
  actions: GameActions,
): { handlers: TokenDragHandlers; shown: ReactNode } {
  const { dialog, pay } = useCluePayment(board);
  const dropOnAct = () => {
    const { act } = board;
    const advance = act?.advance;
    if (!act || !advance || board.turn === undefined) return;
    if (advance.kind === 'spendClues') {
      if (advance.held >= advance.threshold)
        pay(advance.threshold, act.id, (spend) => void actions.advanceAct(spend));
      return;
    }
    // Only the investigator whose turn it is takes an action, so only their clue starts it.
    if (board.turn !== investigator) return;
    const placing = cardActionsOn(board, act.id).find(({ clues }) => clues !== undefined);
    if (placing) void actions.useCardAction(act.id, placing.action);
  };
  const drag = useTokenDrag((client) => {
    if (overHeaderCard('act', client)) {
      dropOnAct();
      return;
    }
    const location = locationAt(client);
    if (location && board.investigatorsAt(location).some(({ id }) => id === investigator))
      void actions.placeClue(investigator);
  });
  return {
    handlers: drag.handlers,
    shown: (
      <>
        {drag.at && <TokenGhost kind="clue" at={drag.at} />}
        {dialog}
      </>
    ),
  };
}
