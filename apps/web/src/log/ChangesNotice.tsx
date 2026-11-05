import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameLogSource } from '../state/appStore';
import { automaticChanges, type LogLine } from './gameLog';
import { LineText } from './LineText';

/**
 * What the game did by itself in the step just played (`automaticChanges`, M3.13a): the doom of
 * the mythos phase, the resources of the upkeep. It asks nothing and fades on its own, so it never
 * holds up play. Only a step played while the screen is open shows one: the step the game opened
 * at, or went back to with Undo, has been seen before. While a dialog is open it shows above it
 * (`ChangesLines`), since the board's own animations play underneath.
 */
export function ChangesNotice({ log, state }: { log: GameLogSource; state: GameState }) {
  const { t } = useTranslation();
  const changes = useMemo(
    () => automaticChanges(t, log.ctx, state, log.entries),
    [t, log.ctx, log.entries, state],
  );
  const [previous, setPrevious] = useState({ length: log.entries.length, step: changes?.step });
  const [shown, setShown] = useState<string>();
  // Worked out while rendering rather than in an effect, so the notice shows with the step's board.
  if (log.entries.length !== previous.length || changes?.step !== previous.step) {
    setPrevious({ length: log.entries.length, step: changes?.step });
    setShown(log.entries.length > previous.length ? changes?.step : undefined);
  }
  if (changes === undefined || shown !== changes.step) return null;

  return (
    // Its own element per step, so a step played while the last one shows starts a fade of its own.
    <ChangesLines key={changes.step} lines={changes.lines} onFaded={() => setShown(undefined)} />
  );
}

/**
 * One step's notice. When a dialog is open as it appears (a decision the step opened, or details
 * the players were reading), it goes into the top layer as a manual popover, above even a modal
 * dialog; otherwise it stays in the notices under the map.
 */
function ChangesLines({ lines, onFaded }: { lines: readonly LogLine[]; onFaded: () => void }) {
  const { t } = useTranslation();
  const element = useRef<HTMLElement>(null);
  // An effect, so it runs after the effects that open this step's dialogs (`showModal`). Set on
  // the element rather than rendered, as a popover is hidden until it is shown.
  useEffect(() => {
    const aside = element.current;
    if (!aside || !document.querySelector('dialog[open]')) return;
    aside.setAttribute('popover', 'manual');
    aside.showPopover();
  }, []);

  return (
    <aside
      ref={element}
      role="status"
      aria-label={t('changes.label')}
      data-part="changes"
      onAnimationEnd={onFaded}
    >
      <ul>
        {lines.map((line, index) => (
          <li key={index}>
            <LineText line={line} />
          </li>
        ))}
      </ul>
      <p>{t('changes.correct')}</p>
    </aside>
  );
}
