import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameLogSource } from '../state/appStore';
import { ConfirmDialog } from '../screens/ConfirmDialog';
import { useBackCloses } from '../screens/useBackCloses';
import { gameLog, type LogStep } from './gameLog';
import './game_log.css';

/**
 * The game log over the board (M3.8): every step of the open game (`gameLog`) in the order it was
 * played, one list item per step with a line per thing it did, scrolled to the newest step, which
 * is the one players ask about. `state` is the game after `log`. Every step but the newest undo group offers
 * to go back to it (`onGoBack`, after a confirm, then the log closes), unless the screen can't
 * take steps back now (busy or adjusting), which leaves `onGoBack` out. A native modal `<dialog>`
 * brings focus trapping and Escape; on a phone the back gesture closes it too (`useBackCloses`).
 */
export function GameLogDialog({
  log,
  state,
  onGoBack,
  onClose,
}: {
  log: GameLogSource;
  state: GameState;
  onGoBack?: (stepId: string) => void;
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
  const steps = gameLog(t, log.ctx, state, log.entries);
  const [goingBack, setGoingBack] = useState<LogStep>();

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        // React passes the confirm's own Escape on to this dialog; that one closes only the confirm.
        if (event.target === dialog.current) close();
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
            {onGoBack && step.later > 0 && (
              <button type="button" onClick={() => setGoingBack(step)}>
                {t('log.goBack')}
              </button>
            )}
          </li>
        ))}
      </ol>
      {onGoBack && goingBack && (
        <ConfirmDialog
          title={t('log.goBackTitle')}
          confirmLabel={t('log.goBack')}
          onConfirm={() => {
            onGoBack(goingBack.id);
            close();
          }}
          onCancel={() => setGoingBack(undefined)}
        >
          <p>{t('log.goBackWarning', { count: goingBack.later })}</p>
        </ConfirmDialog>
      )}
    </dialog>
  );
}
