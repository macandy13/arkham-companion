import { buildInvestigatorCatalog, type InvestigatorDef } from './investigators';
import { normalisePacks, type PackDef } from './packs';
import {
  buildReferencePictures,
  buildReferences,
  type ReferencePictures,
  type ReferenceTexts,
} from './references';

/**
 * Everything the investigator picker needs and the scenario card's texts, fetched together and
 * cached as one unit.
 */
export interface CardCatalog {
  /**
   * The shape of the catalog (`CATALOG_FORMAT`) when it was built; a cached catalog of an older
   * shape, or one cached before this field, is fetched in full once (`loadCatalog`).
   */
  format?: number;
  investigators: InvestigatorDef[];
  packs: PackDef[];
  /**
   * The printed texts of the scenario reference cards, by card code (`buildReferences`); absent in
   * a catalog cached before the app read them, until its next refresh.
   */
  references?: Record<string, ReferenceTexts>;
  /**
   * The pictures of the scenario reference cards' sides, by card code (`buildReferencePictures`);
   * absent in a catalog cached before the app read them, until its next refresh.
   */
  referencePictures?: Record<string, ReferencePictures>;
  /** `Last-Modified` of the cards response; sent back as `If-Modified-Since` on refresh. */
  lastModified?: string;
}

/**
 * What an investigator card prints besides its stats (`InvestigatorDef`): the subname under the
 * name, the class on the shield, and the traits, ability text and flavour on the notebook page,
 * in ArkhamDB markup. A game names its investigators by card code, and the screen looks these up
 * in the catalog (`printedInvestigatorOf`), so no card text is stored with a game.
 */
export type PrintedInvestigator = Pick<
  InvestigatorDef,
  'subname' | 'factionCode' | 'traits' | 'text' | 'flavor'
>;

/** What the investigator card `code` prints, if the catalog lists it. */
export function printedInvestigatorOf(
  catalog: CardCatalog,
  code: string,
): PrintedInvestigator | undefined {
  return catalog.investigators.find((investigator) => investigator.code === code);
}

/**
 * The catalog's current shape. Raise it whenever the catalog gains data an older cached copy
 * lacks (2: the investigators' traits, ability and flavour texts), so the app fetches it in full
 * once instead of revalidating the old copy.
 */
export const CATALOG_FORMAT = 2;

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
