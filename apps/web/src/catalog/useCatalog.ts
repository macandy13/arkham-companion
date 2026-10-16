import type { CardCatalog } from '@arkham/carddata';
import { useEffect, useState } from 'react';

/** Loads the card catalog (cache first, refreshed from ArkhamDB); see `loadCatalog`. */
export type CatalogSource = () => Promise<CardCatalog>;

/** Progress of loading the catalog for a screen. */
export type CatalogState =
  { status: 'loading' } | { status: 'ready'; catalog: CardCatalog } | { status: 'failed' };

/** Loads the catalog once when the screen mounts. */
export function useCatalog(source: CatalogSource): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    source().then(
      (catalog) => current && setState({ status: 'ready', catalog }),
      () => current && setState({ status: 'failed' }),
    );
    return () => {
      current = false;
    };
  }, [source]);

  return state;
}
