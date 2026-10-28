import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameHistory } from '../state/appStore';
import { useBackCloses } from '../screens/useBackCloses';
import { gameLog } from './gameLog';
import './game_log.css';

/**
 * The game log over the board (M3.8): every step of the open game (`gameLog`) in the order it was
 * played, one list item per step with a line per thing it did, scrolled to the newest step, which
 * is the one players ask about. `state` is the game after `history`. A native modal `<dialog>`
 * brings focus trapping and Escape; on a phone the back gesture closes it too (`useBackCloses`).
 */
export function GameLogDialog({
  history,
  state,
  onClose,
}: {
  history: GameHistory;
  state: GameState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const newest = useRef<HTMLLIElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    // jsdom has no scrolling; the browser always has it.
    newest.current?.scrollIntoView?.({ block: 'end' });
  }, []);
  const close = useBackCloses(onClose);
  const steps = gameLog(t, history.ctx, state, history.entries);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      data-dialog="log"
    >
      <h2 id={titleId}>{t('log.title')}</h2>
      <button type="button" data-icon="close" aria-label={t('log.close')} onClick={close} />
      <ol>
        {steps.map((step, index) => (
          <li key={step.id} ref={index === steps.length - 1 ? newest : undefined}>
            <ul>
              {step.lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </dialog>
  );
}
