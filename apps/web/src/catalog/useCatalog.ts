import type { CardCatalog, CardLanguage } from '@arkham/carddata';
import { useEffect, useState } from 'react';

/** Loads the card catalog (cache first, refreshed from ArkhamDB); see `loadCatalog`. */
export type CatalogSource = () => Promise<CardCatalog>;

/** Progress of loading the catalog for a screen; a failed load can be started again. */
export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; catalog: CardCatalog }
  | { status: 'failed'; retry: () => void };

/** Loads the catalog when the screen mounts, and again when the players retry a failed load. */
export function useCatalog(source: CatalogSource): CatalogState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    const retry = () => {
      setState({ status: 'loading' });
      setAttempt((count) => count + 1);
    };
    source().then(
      (catalog) => current && setState({ status: 'ready', catalog }),
      () => current && setState({ status: 'failed', retry }),
    );
    return () => {
      current = false;
    };
  }, [source, attempt]);

  return state;
}

/**
 * `load` for the card language of the moment, loaded once per language while the app runs, so
 * every screen that opens shares the first load instead of asking ArkhamDB again. A failed load
 * is forgotten, so a retry asks again.
 */
export function sharedCatalog(
  load: (language: CardLanguage) => Promise<CardCatalog>,
  language: () => CardLanguage,
): CatalogSource {
  const loads = new Map<CardLanguage, Promise<CardCatalog>>();
  return () => {
    const lang = language();
    const known = loads.get(lang);
    if (known) return known;
    const loading = load(lang);
    loads.set(lang, loading);
    loading.catch(() => loads.delete(lang));
    return loading;
  };
}
