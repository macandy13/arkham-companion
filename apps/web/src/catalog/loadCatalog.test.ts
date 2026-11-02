import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_FORMAT, type CardCatalog, type FetchFn } from '@arkham/carddata';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { loadCatalog } from './loadCatalog';

// Hand-written fake data – never real card text.
const rawInvestigator = {
  code: '1001',
  name: 'Fake Hero',
  type_code: 'investigator',
  faction_code: 'seeker',
  pack_code: 'fake_pack',
  health: 7,
  sanity: 7,
  skill_willpower: 3,
  skill_intellect: 3,
  skill_combat: 3,
  skill_agility: 3,
};
const packsBody = [{ code: 'fake_pack', name: 'Fake', position: 1, cycle_position: 1 }];

const respondingWith =
  (cards: () => Response, requests: string[] = []): FetchFn =>
  async (url, init) => {
    requests.push(`${url} ${init?.headers?.['If-Modified-Since'] ?? ''}`.trim());
    return url.endsWith('/packs/') ? new Response(JSON.stringify(packsBody)) : cards();
  };

const okCards = (lastModified: string) => () =>
  new Response(JSON.stringify([rawInvestigator]), { headers: { 'Last-Modified': lastModified } });

let n = 0;
let store: IndexedDbStore;
beforeEach(() => {
  store = new IndexedDbStore(`catalog-test-${n++}`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadCatalog', () => {
  it('fetches on first load and caches the result', async () => {
    const catalog = await loadCatalog(store, 'en', respondingWith(okCards('v1')));

    expect(catalog.investigators.map((i) => i.code)).toEqual(['1001']);
    expect(await store.getCatalog('en')).toEqual(catalog);
  });

  it('revalidates with If-Modified-Since and keeps the cache on 304', async () => {
    const first = await loadCatalog(store, 'en', respondingWith(okCards('v1')));
    const requests: string[] = [];

    const second = await loadCatalog(
      store,
      'en',
      respondingWith(() => new Response(null, { status: 304 }), requests),
    );

    expect(second).toEqual(first);
    expect(requests).toContain('https://arkhamdb.com/api/public/cards/ v1');
  });

  it.each([
    { cachedAs: 'a catalog cached before the app noted its shape', format: undefined },
    { cachedAs: 'a catalog of an older shape', format: CATALOG_FORMAT - 1 },
  ])('fetches $cachedAs in full once', async ({ format }) => {
    const fetched = await loadCatalog(store, 'en', respondingWith(okCards('v1')));
    await store.putCatalog('en', { ...fetched, format });
    const requests: string[] = [];

    const refreshed = await loadCatalog(store, 'en', respondingWith(okCards('v1'), requests));

    expect(requests).toContain('https://arkhamdb.com/api/public/cards/');
    expect(refreshed.format).toBe(CATALOG_FORMAT);
  });

  it('replaces the cache when the server has a newer version', async () => {
    await loadCatalog(store, 'en', respondingWith(okCards('v1')));

    const updated = await loadCatalog(store, 'en', respondingWith(okCards('v2')));

    expect(updated.lastModified).toBe('v2');
    expect((await store.getCatalog('en'))?.lastModified).toBe('v2');
  });

  it('falls back to the cache when offline', async () => {
    const first = await loadCatalog(store, 'en', respondingWith(okCards('v1')));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new TypeError('network down');

    const offline = await loadCatalog(store, 'en', async () => {
      throw failure;
    });

    expect(offline).toEqual(first);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cached copy'), failure);
  });

  it('throws when offline on the first load', async () => {
    await expect(
      loadCatalog(store, 'en', async () => {
        throw new TypeError('network down');
      }),
    ).rejects.toThrow('network down');
  });

  it('uses the German host and keeps languages apart', async () => {
    const requests: string[] = [];

    await loadCatalog(store, 'de', respondingWith(okCards('v1'), requests));

    expect(requests[0]).toBe('https://de.arkhamdb.com/api/public/packs/');
    expect(await store.getCatalog('en')).toBeUndefined();
  });

  it('uses the English host for unknown languages', async () => {
    const requests: string[] = [];

    await loadCatalog(store, 'xx', respondingWith(okCards('v1'), requests));

    expect(requests[0]).toBe('https://arkhamdb.com/api/public/packs/');
  });
});

describe('catalog cache', () => {
  it('returns undefined before anything is stored', async () => {
    const cached: CardCatalog | undefined = await store.getCatalog('en');

    expect(cached).toBeUndefined();
  });
});
