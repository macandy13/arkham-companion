import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The toast under the campaign log after a resolution was written into it
 * (`AppState.writtenResolution`): the entries are in ink now, and "Undo" takes them back out
 * (`AppState.undoResolution`), so the game proposes its resolution again. "OK" keeps them.
 */
export function ResolutionUndo({
  onUndo,
  onDismiss,
}: {
  readonly onUndo: () => Promise<void>;
  readonly onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <aside id="resolution-written" role="status" aria-label={t('resolution.written.label')}>
      <p>{t(failed ? 'resolution.written.undoFailed' : 'resolution.written.text')}</p>
      <footer>
        <button
          type="button"
          disabled={busy || failed}
          onClick={() => {
            setBusy(true);
            onUndo()
              .catch((error: unknown) => {
                console.warn('The resolution could not be taken back out of the log.', error);
                setFailed(true);
              })
              .finally(() => setBusy(false));
          }}
        >
          {t('resolution.written.undo')}
        </button>
        <button type="button" onClick={onDismiss}>
          {t('resolution.written.dismiss')}
        </button>
      </footer>
    </aside>
  );
}
