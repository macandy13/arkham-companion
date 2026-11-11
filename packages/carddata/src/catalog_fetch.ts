import { CATALOG_FORMAT, type CatalogFetchResult, type FetchFn } from './catalog';
import { buildInvestigatorCatalog } from './investigator_parsing';
import { normalisePacks } from './pack_parsing';
import { buildReferencePictures, buildReferences } from './references';

/**
 * Fetches packs and all cards from `host` (an ArkhamDB base URL) and builds the catalog.
 * With `ifModifiedSince`, a 304 on the (large) cards request short-circuits to `notModified`.
 * Packs are requested first because they supply cycle and chapter for every investigator.
 */
export async function fetchCatalog(
  host: string,
  fetchFn: FetchFn,
  ifModifiedSince?: string,
): Promise<CatalogFetchResult> {
  const packsResponse = await fetchFn(`${host}/api/public/packs/`);
  if (!packsResponse.ok) throw new Error(`packs -> HTTP ${packsResponse.status}`);
  const packs = normalisePacks(await packsResponse.json());

  const cardsResponse = await fetchFn(
    `${host}/api/public/cards/`,
    ifModifiedSince ? { headers: { 'If-Modified-Since': ifModifiedSince } } : undefined,
  );
  if (cardsResponse.status === 304) return { status: 'notModified' };
  if (!cardsResponse.ok) throw new Error(`cards -> HTTP ${cardsResponse.status}`);
  const rawCards: unknown = await cardsResponse.json();
  const investigators = buildInvestigatorCatalog(rawCards, packs);
  const references = buildReferences(rawCards);
  const referencePictures = buildReferencePictures(rawCards);
  const lastModified = cardsResponse.headers.get('Last-Modified') ?? undefined;
  return {
    status: 'ok',
    catalog: {
      format: CATALOG_FORMAT,
      investigators,
      packs,
      references,
      referencePictures,
      lastModified,
    },
  };
}
