import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameLogSource } from '../state/appStore';
import { ConfirmDialog } from '../screens/ConfirmDialog';
import { useBackCloses } from '../screens/useBackCloses';
import { gameLog, logSections, type LogSection, type LogStep } from './gameLog';
import './game_log.css';

/**
 * The game log over the board (M3.8): every step of the open game (`gameLog`) in the order played,
 * under a heading per round and phase that stays at the top while its steps scroll by. It opens
 * scrolled to the end, so the newest step shows first under its own heading. Each step is one
 * list item with whose turn it was, when it was stored and a line per thing it did. `state` is the
 * game after `log`. Every step but the newest undo group offers to go back to it (`onGoBack`,
 * after a confirm, then the log closes), unless the screen can't take steps back now (busy or
 * adjusting), which leaves `onGoBack` out. A native modal `<dialog>` brings focus trapping and
 * Escape; on a phone held upright it fills the screen, and the back gesture closes it
 * (`useBackCloses`).
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
  const steps = useRef<HTMLOListElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    if (steps.current) steps.current.scrollTop = steps.current.scrollHeight;
  }, []);
  const close = useBackCloses(onClose);
  const sections = logSections(gameLog(t, log.ctx, state, log));
  const [goingBack, setGoingBack] = useState<LogStep>();
  const goBack = onGoBack && setGoingBack;

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
      <ol ref={steps}>
        {sections.map((section) => (
          <Section key={section.steps[0]?.id} section={section} onGoBack={goBack} />
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

/** One round and phase of the log: its heading, then its steps, newest first. */
function Section({
  section,
  onGoBack,
}: {
  section: LogSection;
  onGoBack?: (step: LogStep) => void;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const phase = t(`games.phases.${section.phase}`);
  return (
    <li aria-labelledby={headingId}>
      <h3 id={headingId}>
        {section.phase === 'setup' ? phase : t('log.section', { round: section.round, phase })}
      </h3>
      <ol>
        {section.steps.map((step) => (
          <Step key={step.id} step={step} onGoBack={onGoBack} />
        ))}
      </ol>
    </li>
  );
}

/** One step: whose turn it was and when, then its lines, and the way back to it unless it is the newest. */
function Step({ step, onGoBack }: { step: LogStep; onGoBack?: (step: LogStep) => void }) {
  const { t, i18n } = useTranslation();
  const time = step.timestamp === undefined ? undefined : new Date(step.timestamp);
  return (
    <li>
      {(step.actor !== undefined || time !== undefined) && (
        <p>
          {step.actor}
          {time && (
            <time dateTime={time.toISOString()}>
              {time.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
            </time>
          )}
        </p>
      )}
      <ul>
        {step.lines.map((line, index) => (
          <li key={index}>{line.text}</li>
        ))}
      </ul>
      {onGoBack && step.later > 0 && (
        <button type="button" onClick={() => onGoBack(step)}>
          {t('log.goBack')}
        </button>
      )}
    </li>
  );
}
