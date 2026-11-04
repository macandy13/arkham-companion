import { useTranslation } from 'react-i18next';
import type { LogLine } from './gameLog';

/**
 * A log line's words, followed by why the game did it by itself when it did ("1 doom on What Lurks
 * Below (mythos phase)"), the cause in an element of its own so it can read quieter than the change.
 */
export function LineText({ line }: { line: LogLine }) {
  const { t } = useTranslation();
  return (
    <>
      {line.text}
      {line.cause !== undefined && (
        <>
          {' '}
          <span>{t('log.because', { cause: line.cause })}</span>
        </>
      )}
    </>
  );
}
