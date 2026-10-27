import { useTranslation } from 'react-i18next';
import { BASE_ACTIONS_PER_TURN, type BoardView, type InvestigatorView } from '@arkham/engine';
import { range } from '@arkham/util';
import type { GameActions } from '../state/gameActions';

/** The basic actions the turn row offers, in its order, each a `GameActions` verb without arguments. */
const BASIC_ACTIONS = ['investigate', 'takeResource', 'drawCard', 'playCard'] as const;

/**
 * The turn controls on an investigator's panel. While it is their turn: a pip per action, filled
 * for each one left (`InvestigatorView.actions`), then the basic actions as icon buttons:
 * investigate (its test goes to the decision dialog), take a resource, and draw and play, whose cards
 * the players handle at the table (`BASIC_ACTIONS`); then a button per card action the cards offer them (`BoardView.cardActions`, named by its
 * designator and card: "Resign · Parlor") and End, as in the prototype's turn row. Before it,
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
          disabled={busy}
          onClick={() => void actions[action]()}
        />
      ))}
      {board.cardActions(investigator.id).map(({ cardId, card, action, designator }) => {
        const name = t(`investigators.cardAction.${designator ?? 'plain'}`);
        return (
          <button
            key={`${cardId}:${action}`}
            type="button"
            aria-label={t('investigators.cardActionOn', { action: name, card })}
            disabled={busy}
            onClick={() => void actions.useCardAction(cardId, action)}
          >
            {name}
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
    </div>
  );
}
