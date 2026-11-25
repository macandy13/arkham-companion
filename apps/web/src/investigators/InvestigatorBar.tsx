import { useState } from 'react';
import { type BoardView, type InvestigatorCode, type InvestigatorId } from '@arkham/engine';
import { type PrintedInvestigator, type WeaknessDef } from '@arkham/carddata';
import './investigators.css';
import './card_effects.css';
import { InvestigatorPanel } from './InvestigatorPanel';

/**
 * The bar of investigator panels along the foot of the play screen, one per investigator in seat
 * order (`BoardView.investigators`), so everyone's status is in view at once. It replaces the
 * health and sanity dials and the clue and resource piles on the table: a counter changes in its
 * − / + bubble (`CounterBubble`), which plays the open game's actions (`usePlay`); nothing is tapped while a step is queued
 * (`usePlay().busy`).
 *
 * A phone has room for one panel only, so in its compact view (`onOpen`) the stylesheet lays the
 * panels in a row a screen wide each, and the players swipe sideways between them; the one in
 * view is the focused one (`data-focus`, `useSwipedTo`), and dots on each panel show its seat in
 * the row. Focus follows the turn, see `useFocus`,
 * and the row scrolls to it. There the focused investigator's name is a button that opens the
 * detail view on their panel, and the card is the slim strip (`InvestigatorFace`) to leave the map
 * room.
 * Expanded in place there (`whole`), each panel shows the whole card (`WholeCard`) instead.
 */
export function InvestigatorBar({
  board,
  onOpen,
  whole = false,
  printed,
  weaknesses,
  onMoveByCard,
}: {
  board: BoardView;
  onOpen?: ((investigator: InvestigatorId) => void) | undefined;
  /** The phone's expanded bar: every panel shows the whole card, its text included. */
  whole?: boolean;
  /** Looks up what each investigator's card prints (`printedInvestigatorOf`), once the catalog has loaded. */
  printed?: ((code: InvestigatorCode) => PrintedInvestigator | undefined) | undefined;
  /** The catalog's weaknesses an investigator can draw (`DrawWeakness`), once it has loaded. */
  weaknesses?: readonly WeaknessDef[] | undefined;
  /**
   * Starts picking on the map where a card effect moves an investigator, connected or not
   * (`AppState.startPick`); the whole card offers it when given.
   */
  onMoveByCard?: ((investigator: InvestigatorId) => void) | undefined;
}) {
  // The players pick who goes next in the investigation phase, once no turn is in progress.
  const picking = board.phase === 'investigation' && board.turn === undefined;
  const [focus, setFocus] = useFocus(board);
  return (
    <>
      {board.investigators.map((investigator, seat) => (
        <InvestigatorPanel
          key={investigator.id}
          seat={
            onOpen && board.investigators.length > 1
              ? { at: seat, of: board.investigators.length }
              : undefined
          }
          board={board}
          investigator={investigator}
          printed={printed?.(investigator.code)}
          weaknesses={weaknesses}
          onMoveByCard={onMoveByCard}
          focused={focus === investigator.id}
          onShown={onOpen ? () => setFocus(investigator.id) : undefined}
          onOpen={focus === investigator.id ? onOpen : undefined}
          shape={onOpen ? 'strip' : 'banner'}
          whole={whole}
          onTurn={board.turn === investigator.id}
          lead={board.lead === investigator.id}
          engaged={board.enemiesEngagedWith(investigator.id)}
          canStart={
            picking && investigator.status === 'active' && investigator.turnTaken === undefined
          }
        />
      ))}
    </>
  );
}

/**
 * The investigator the phone shows in full: the one the players tapped last, until the turn
 * changes, else the one whose turn it is, else the lead investigator (the first one once nobody
 * leads, as everyone has left the game). A tap is kept with the round, phase and turn it was made
 * in (`turnKey`), so a new turn brings its investigator to the front without an effect, even when
 * the same investigator's turn comes round again.
 */
function useFocus(board: BoardView): [InvestigatorId | undefined, (id: InvestigatorId) => void] {
  const [picked, setPicked] = useState<{ id: InvestigatorId; turn: string }>();
  const focus =
    picked && picked.turn === turnKey(board)
      ? picked.id
      : (board.turn ?? board.lead ?? board.investigators[0]?.id);
  return [focus, (id) => setPicked({ id, turn: turnKey(board) })];
}

/** Names the turn in progress, or the time between turns, uniquely within a game (`useFocus`). */
function turnKey(board: BoardView): string {
  return `${board.round}:${board.phase}:${board.turn ?? ''}`;
}
