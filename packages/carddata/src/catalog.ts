import { buildInvestigatorCatalog, type InvestigatorDef } from './investigators';
import { normalisePacks, type PackDef } from './packs';

/** Everything the investigator picker needs, fetched together and cached as one unit. */
export interface CardCatalog {
  investigators: InvestigatorDef[];
  packs: PackDef[];
  /** `Last-Modified` of the cards response; sent back as `If-Modified-Since` on refresh. */
  lastModified?: string;
}

/** Result of a refresh: `notModified` means the cached catalog is still current. */
export type CatalogFetchResult = { status: 'notModified' } | { status: 'ok'; catalog: CardCatalog };

/** The `fetch` signature the catalog loader needs; injectable so tests never hit the network. */
export type FetchFn = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

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
  const investigators = buildInvestigatorCatalog(await cardsResponse.json(), packs);
  const lastModified = cardsResponse.headers.get('Last-Modified') ?? undefined;
  return { status: 'ok', catalog: { investigators, packs, lastModified } };
}
