import { useTranslation } from 'react-i18next';
import { BASE_ACTIONS_PER_TURN, type BoardView, type InvestigatorView } from '@arkham/engine';
import { range } from '@arkham/util';
import { cardActionLabel } from '../screens/ActionRow';
import { useCluePayment } from '../screens/CluePaymentDialog';
import type { GameActions } from '../state/gameActions';

/** The basic actions the turn row offers, in its order, each a `GameActions` verb without arguments. */
const BASIC_ACTIONS = ['investigate', 'takeResource', 'drawCard', 'playCard'] as const;

/**
 * The turn controls on an investigator's panel. While it is their turn: a pip per action, filled
 * for each one left (`InvestigatorView.actions`), then the basic actions as icon buttons:
 * investigate (its test goes to the decision dialog), take a resource, and draw and play, whose cards
 * the players handle at the table (`BASIC_ACTIONS`), investigate off where a card forbids it
 * (`LocationView.forbidden`, Locked Door) and play while a card forbids them to
 * play (`InvestigatorView.forbidden`, Dissonant Voices); then a button per card action the cards offer them (`BoardView.cardActions`, named by its
 * designator and card: "Resign · Parlor"; one with a group clue cost asks who pays, `useCluePayment`) and End, as in the prototype's turn row. Before it,
 * when the players may pick them next (`canStart`: the investigation phase, no turn in progress,
 * not taken this round), "Start turn", since the players choose the order.
 * Nothing otherwise. The buttons wait while a step is queued (`busy`).
 */
export function TurnControls({
  board,
  investigator,
  onTurn,
  canStart,
  actions,
  busy,
}: {
  board: BoardView;
  investigator: InvestigatorView;
  onTurn: boolean;
  canStart: boolean;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { dialog, pay } = useCluePayment(board);
  if (canStart)
    return (
      <button type="button" disabled={busy} onClick={() => void actions.startTurn(investigator.id)}>
        {t('investigators.startTurn')}
      </button>
    );
  if (!onTurn) return null;
  const left = investigator.actions;
  // Cards can grant more actions than the usual three, so the row grows to show every one.
  const slots = range(Math.max(BASE_ACTIONS_PER_TURN, left));
  const at = board.locationOf(investigator.id);
  const cannotInvestigate =
    at !== undefined && board.location(at).forbidden?.includes('investigate') === true;
  const isOff = (action: (typeof BASIC_ACTIONS)[number]) =>
    (action === 'investigate' && cannotInvestigate) ||
    (action === 'playCard' && investigator.forbidden?.cards?.includes('play') === true);
  return (
    <div role="group" aria-label={t('investigators.turn')}>
      <ul aria-label={t('investigators.actionsLeft', { count: left })}>
        {slots.map((slot) => (
          <li key={slot} data-left={slot < left || undefined} />
        ))}
      </ul>
      {BASIC_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          aria-label={t(`investigators.${action}`)}
          title={t(`investigators.${action}`)}
          data-icon={action}
          disabled={busy || isOff(action)}
          onClick={() => void actions[action]()}
        />
      ))}
      {board.cardActions(investigator.id).map((offer) => {
        const { cardId, action, groupClues } = offer;
        const { caption, name } = cardActionLabel(t, offer);
        return (
          <button
            key={`${cardId}:${action}`}
            type="button"
            aria-label={name}
            disabled={busy}
            onClick={() =>
              pay(groupClues, cardId, (spend) => void actions.useCardAction(cardId, action, spend))
            }
          >
            {caption}
          </button>
        );
      })}
      <button
        type="button"
        aria-label={t('investigators.endTurn')}
        disabled={busy}
        onClick={() => void actions.endTurn()}
      >
        {t('investigators.end')}
      </button>
      {dialog}
    </div>
  );
}
