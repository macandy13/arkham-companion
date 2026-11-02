import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameState } from '@arkham/engine';
import type { GameLogSource } from '../state/appStore';
import { automaticChanges } from './gameLog';

/**
 * What the game did by itself in the step just played (`automaticChanges`, M3.13a): the doom of
 * the mythos phase, the resources of the upkeep. It asks nothing and fades on its own, so it never
 * holds up play. Only a step played while the screen is open shows one: the step the game opened
 * at, or went back to with Undo, has been seen before.
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
    <aside
      role="status"
      aria-label={t('changes.label')}
      data-part="changes"
      onAnimationEnd={() => setShown(undefined)}
    >
      <ul>
        {changes.lines.map((line, index) => (
          <li key={index}>{line.text}</li>
        ))}
      </ul>
    </aside>
  );
}
