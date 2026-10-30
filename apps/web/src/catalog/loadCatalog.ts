import { fetchCatalog, type CardCatalog, type FetchFn } from '@arkham/carddata';

/** The slice of `IndexedDbStore` the catalog loader needs; keeps the loader testable. */
export interface CatalogCache {
  getCatalog(lang: string): Promise<CardCatalog | undefined>;
  putCatalog(lang: string, catalog: CardCatalog): Promise<void>;
}

/** ArkhamDB hosts per UI language (architecture "Card data"). */
const HOSTS: Record<string, string> = {
  en: 'https://arkhamdb.com',
  de: 'https://de.arkhamdb.com',
};

/**
 * Returns the investigator catalog, refreshing the IndexedDB cache with `If-Modified-Since`.
 * Offline or on a server error the cached copy is used, so the picker keeps working at the
 * table without network; only a first load without network throws.
 */
export async function loadCatalog(
  cache: CatalogCache,
  lang: string,
  fetchFn: FetchFn = (url, init) => fetch(url, init),
): Promise<CardCatalog> {
  const cached = await cache.getCatalog(lang);
  try {
    // A catalog cached before the app kept the reference cards' texts is fetched in full once.
    const since = cached?.references ? cached.lastModified : undefined;
    const result = await fetchCatalog(HOSTS[lang] ?? HOSTS.en!, fetchFn, since);
    if (result.status === 'ok') {
      await cache.putCatalog(lang, result.catalog);
      return result.catalog;
    }
  } catch (error) {
    if (!cached) throw error;
    console.warn('Could not refresh the card catalog; using the cached copy.', error);
  }
  // A 304 is only possible when we sent `If-Modified-Since`, i.e. when `cached` exists.
  return cached as CardCatalog;
}
