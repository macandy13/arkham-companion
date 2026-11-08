import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A small "Offline" mark in the app bar and the play screen's status row while the device has no
 * network (M6.4b), so the players know why a picture is missing or the card data did not
 * refresh. Nothing shows while online.
 */
export function OfflineMark() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return <p data-offline>{t('network.offline')}</p>;
}

/**
 * Whether the browser says it has a network (`navigator.onLine`), following its `online` and
 * `offline` events. True while rendering on a server, where nothing is known.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
