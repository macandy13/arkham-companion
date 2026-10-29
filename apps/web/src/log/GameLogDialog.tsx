import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameLogSource } from '../state/appStore';
import { useBackCloses } from '../screens/useBackCloses';
import { gameLog, newestFirst, type LogSection, type LogStep } from './gameLog';
import './game_log.css';

/**
 * The game log over the board (M3.8): every step of the open game (`gameLog`), newest first, under
 * a heading per round and phase that stays at the top while its steps scroll by. Each step is one
 * list item with whose turn it was, when it was stored and a line per thing it did. `state` is the
 * game after `log`. A native modal `<dialog>` brings focus trapping and Escape; on a phone the
 * back gesture closes it too (`useBackCloses`).
 */
export function GameLogDialog({
  log,
  state,
  onClose,
}: {
  log: GameLogSource;
  state: GameState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const close = useBackCloses(onClose);
  const sections = newestFirst(gameLog(t, log.ctx, state, log));

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
        {sections.map((section) => (
          <Section key={section.steps[0]?.id} section={section} />
        ))}
      </ol>
    </dialog>
  );
}

/** One round and phase of the log: its heading, then its steps, newest first. */
function Section({ section }: { section: LogSection }) {
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
          <Step key={step.id} step={step} />
        ))}
      </ol>
    </li>
  );
}

/** One step: whose turn it was and when, then its lines. */
function Step({ step }: { step: LogStep }) {
  const { i18n } = useTranslation();
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
    </li>
  );
}
