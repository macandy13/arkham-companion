import type { CardCatalog } from '@arkham/carddata';
import { useCallback, useEffect, useState } from 'react';
import type { CatalogLoader } from '../state/appStore';

/** Load progress of the investigator catalog as seen by a screen. */
export type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly catalog: CardCatalog };

/**
 * Loads the catalog for `lang` and exposes it as a state machine plus a `retry` action.
 * Lives in a hook so screens stay markup-only; the loader itself comes from the app store.
 */
export function useCatalog(
  load: CatalogLoader,
  lang: string,
): { state: CatalogState; retry: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Ignores the result of a superseded request (retry, unmount, StrictMode double effect).
    let current = true;
    setState({ status: 'loading' });
    load(lang).then(
      (catalog) => current && setState({ status: 'ready', catalog }),
      () => current && setState({ status: 'error' }),
    );
    return () => {
      current = false;
    };
  }, [load, lang, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
