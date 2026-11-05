import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameLogSource } from '../state/appStore';
import { CardDialog } from '../screens/CardDialog';
import { ConfirmDialog } from '../screens/ConfirmDialog';
import { useBackCloses } from '../screens/useBackCloses';
import { LineText } from './LineText';
import { gameLog, logSections, type LogSection, type LogStep } from './gameLog';
import './game_log.css';

/**
 * The game log (M3.8): every step of the open game (`gameLog`) in the order played,
 * under a heading per round and phase that stays at the top while its steps scroll by. It opens
 * scrolled to the end, so the newest step shows first under its own heading. Each step is one
 * list item with whose turn it was, when it was stored and a line per thing it did. `state` is the
 * game after `log`. Every step but the newest undo group offers to go back to it (`onGoBack`,
 * after a confirm, then the log closes), unless the screen can't take steps back now (busy or
 * adjusting), which leaves `onGoBack` out. It is not tied to a moment in the game and grows long,
 * so it is a page of its own on the card shell (`CardDialog`, without a card): the whole height of
 * a tablet at the wide dialog width, the whole screen of a phone held upright, its steps scrolling
 * inside under the scenario's name (`scenario`) and the title (game_log.css). The back gesture
 * closes it too (`useBackCloses`).
 */
export function GameLogDialog({
  log,
  state,
  scenario,
  onGoBack,
  onClose,
}: {
  log: GameLogSource;
  state: GameState;
  /** The scenario's name, the page's kicker. */
  scenario?: string;
  onGoBack?: (stepId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const steps = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (steps.current) steps.current.scrollTop = steps.current.scrollHeight;
  }, []);
  const close = useBackCloses(onClose);
  const sections = logSections(gameLog(t, log.ctx, state, log));
  const [goingBack, setGoingBack] = useState<LogStep>();
  const goBack = onGoBack && setGoingBack;

  return (
    <CardDialog
      name="log"
      kicker={scenario}
      title={t('log.title')}
      onCancel={(event) => {
        event.preventDefault();
        // React passes the confirm's own Escape on to this dialog; that one closes only the confirm.
        if (event.target === event.currentTarget) close();
      }}
      onClose={close}
    >
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
    </CardDialog>
  );
}

/** One round and phase of the log: its heading, then its steps in the order played. */
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
          <li key={index}>
            <LineText line={line} />
          </li>
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
