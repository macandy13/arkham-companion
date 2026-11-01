import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, DecisionId, DecisionView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { CardDialog } from './CardDialog';
import { DecisionPage, decisionHeading } from './DecisionDialog';

/** The open decision with the id of its pending entry, which keys its page so each starts afresh. */
export interface OpenDecision {
  view: DecisionView;
  id: DecisionId;
}

/**
 * What the game screen (`GameScreen`) shares with the details dialogs below it: the first open
 * decision, whether the players adjust the board (a hosted decision is lowered meanwhile, as the
 * screen hides its own), and the switch
 * that tells the screen a details dialog shows the decisions in its place (`useDecisionHost`), so
 * its own decision dialog stays shut meanwhile.
 */
export interface DecisionHost {
  decision: OpenDecision | undefined;
  adjusting: boolean;
  setHosted: (hosted: boolean) => void;
}

/** The game screen's `DecisionHost`; without it (a details dialog alone) a dialog hosts nothing. */
export const DecisionHostContext = createContext<DecisionHost | undefined>(undefined);

/** A details dialog's part in hosting decisions (`useDecisionHost`). */
export interface HostedDecision {
  /** The decision the dialog shows in place of its page, once it hosts and while one is open. */
  decision: OpenDecision | undefined;
  /** Whether the players adjust the board, which lowers the hosted decision out of its way. */
  adjusting: boolean;
  /**
   * Makes the dialog show the decisions from now until it closes, called right before the step
   * that raises one (a fight, an evasion, an investigation, an engagement that provokes).
   */
  host: () => void;
}

/**
 * Lets a details dialog show the decision its own action raised, in place of its page, instead of
 * closing for the game screen's decision dialog (MD.6a4): the card the players tapped stays put
 * and the test follows on the same paper. It hosts only after `host`, so a decision that was
 * already open when the players opened the details (lowered to look at the board) stays the
 * screen's. The screen hears of it at once, so its own dialog never opens for a moment first, and
 * again when the details close, so a decision still open then goes back to it.
 */
export function useDecisionHost(): HostedDecision {
  const shared = useContext(DecisionHostContext);
  const [hosting, setHosting] = useState(false);
  const setHosted = shared?.setHosted;
  useEffect(() => {
    if (!hosting || !setHosted) return;
    return () => setHosted(false);
  }, [hosting, setHosted]);
  return {
    decision: hosting ? shared?.decision : undefined,
    adjusting: shared?.adjusting ?? false,
    host: () => {
      setHosting(true);
      setHosted?.(true);
    },
  };
}

/**
 * The card shell of an enemy's or location's details (`EnemyDetails`, `LocationDetails`): its
 * page (`children`) with the × and Escape to close it, or, while it hosts a decision
 * (`hosted.decision`), that decision's page in the same `<dialog>` (`DecisionPage`), titled and
 * answered like the decision dialog: Escape refused, the grab handle to lower it, its draw fresh
 * for each decision. The details' card stays beside it, unless the decision is about another card
 * (another enemy's attack of opportunity), which then stands there. Once the decisions are
 * answered the details' page comes back, read fresh from the board.
 */
export function DetailsDialog({
  board,
  actions,
  busy,
  hosted,
  name,
  card,
  drawn,
  actor,
  kicker,
  title,
  onClose,
  children,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  hosted: HostedDecision;
  onClose: () => void;
  children: ReactNode;
} & Pick<
  ComponentProps<typeof CardDialog>,
  'name' | 'card' | 'drawn' | 'actor' | 'kicker' | 'title'
>) {
  const { t } = useTranslation();
  // Lowered belongs to one decision, so the next opens raised, as the screen's dialog does.
  const [loweredFor, setLoweredFor] = useState<DecisionId>();
  const { decision } = hosted;
  // One `CardDialog` in both cases, so the same `<dialog>` stays open while its page changes.
  if (!decision)
    return (
      <CardDialog
        name={name}
        {...(card ? { card } : {})}
        drawn={drawn}
        {...(actor ? { actor } : {})}
        kicker={kicker}
        title={title}
        onCancel={onClose}
        onClose={onClose}
      >
        {children}
      </CardDialog>
    );
  const { view, id } = decision;
  const own = view.card === undefined || view.card.id === card?.id;
  const shown = own ? card : view.card;
  return (
    <CardDialog
      name="decision"
      {...(shown ? { card: shown } : {})}
      drawn={own ? drawn : undefined}
      {...decisionHeading(t, board, view)}
      onCancel={(event) => event.preventDefault()}
      lowered={loweredFor === id || hosted.adjusting}
      onLower={(to) => setLoweredFor(to ? id : undefined)}
    >
      <DecisionPage key={id} board={board} decision={view} actions={actions} busy={busy} />
    </CardDialog>
  );
}
