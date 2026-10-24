import { useTranslation } from 'react-i18next';
import { BASE_ACTIONS_PER_TURN, type InvestigatorView } from '@arkham/engine';
import { range } from '@arkham/util';
import type { GameActions } from '../state/gameActions';

/**
 * The turn controls on an investigator's panel. While it is their turn: a pip per action, filled
 * for each one left (`InvestigatorView.actions`), then resign and End, as in the prototype's turn
 * row. Before it, when the players may pick them next (`canStart`: the investigation phase, no
 * turn in progress, not taken this round), "Start turn", since the players choose the order.
 * Nothing otherwise. The buttons wait while a step is queued (`busy`).
 */
export function TurnControls({
  investigator,
  onTurn,
  canStart,
  actions,
  busy,
}: {
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
      <button
        type="button"
        aria-label={t('investigators.resign')}
        title={t('investigators.resign')}
        data-icon="resign"
        disabled={busy}
        onClick={() => void actions.resign()}
      />
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
