import { describe, expect, it } from 'vitest';
import { buildInvestigatorCatalog, fetchCatalog, normalisePacks, type FetchFn } from './index';

// Hand-written fake data – never real card text.
const packs = normalisePacks([
  { code: 'old_core', name: 'Old Core', position: 1, cycle_position: 1 },
  { code: 'old_cycle', name: 'Old Cycle', position: 2, cycle_position: 2 },
  { code: 'core_2026', name: 'New Core', position: 1, cycle_position: 1 },
]);

const rawInvestigator = (overrides: Record<string, unknown> = {}) => ({
  code: '1001',
  name: 'Fake Hero',
  subname: 'The Tester',
  type_code: 'investigator',
  faction_code: 'guardian',
  pack_code: 'old_core',
  health: 8,
  sanity: 6,
  skill_willpower: 3,
  skill_intellect: 2,
  skill_combat: 4,
  skill_agility: 1,
  ...overrides,
});

describe('normalisePacks', () => {
  it.each([
    { name: 'a Chapter Two pack the data marks', raw: { code: 'new_box', chapter: 2 }, chapter: 2 },
    { name: 'a pack the data marks Chapter One', raw: { code: 'cob', chapter: 1 }, chapter: 1 },
    { name: 'Children of Blood without a chapter', raw: { code: 'cob' }, chapter: 2 },
    { name: 'an unknown pack without a chapter', raw: { code: 'old_box' }, chapter: 1 },
  ])('reads the chapter of $name', ({ raw, chapter }) => {
    const [pack] = normalisePacks([{ name: 'Box', position: 1, cycle_position: 1, ...raw }]);

    expect(pack?.chapter).toBe(chapter);
  });

  it.each([{ chapter: 3 }, { chapter: null }, { chapter: '2' }])(
    'falls back to the code for an unexpected chapter $chapter',
    ({ chapter }) => {
      const [pack] = normalisePacks([
        { code: 'core_2026', name: 'Box', position: 1, cycle_position: 1, chapter },
      ]);

      expect(pack?.chapter).toBe(2);
    },
  );

  it('derives the chapter from the pack code when the data gives none', () => {
    expect(packs.map((p) => [p.code, p.chapter])).toEqual([
      ['old_core', 1],
      ['old_cycle', 1],
      ['core_2026', 2],
    ]);
  });

  it('rejects non-array input', () => {
    expect(() => normalisePacks({})).toThrow();
  });
});

describe('buildInvestigatorCatalog', () => {
  it('keeps only investigators and normalises their fields', () => {
    const catalog = buildInvestigatorCatalog(
      [rawInvestigator({ imagesrc: '/a.png' }), { code: '5', type_code: 'asset', name: 'Fake' }],
      packs,
    );

    expect(catalog).toEqual([
      expect.objectContaining({
        code: '1001',
        factionCode: 'guardian',
        skills: { willpower: 3, intellect: 2, combat: 4, agility: 1 },
        imageSrc: '/a.png',
        chapter: 1,
        cyclePosition: 1,
        parallel: false,
      }),
    ]);
  });

  it('keeps the texts the card prints on its notebook page', () => {
    const [investigator] = buildInvestigatorCatalog(
      [
        rawInvestigator({
          traits: 'Tester. Hero.',
          text: '[reaction] After you pass a test: gain 1 resource.',
          flavor: 'It always works in the tests.',
        }),
      ],
      packs,
    );

    expect(investigator).toMatchObject({
      traits: 'Tester. Hero.',
      text: '[reaction] After you pass a test: gain 1 resource.',
      flavor: 'It always works in the tests.',
    });
  });

  it('leaves the texts out when the card prints none', () => {
    const [investigator] = buildInvestigatorCatalog(
      [rawInvestigator({ traits: null, text: null, flavor: null })],
      packs,
    );

    expect(investigator?.traits).toBeUndefined();
    expect(investigator?.text).toBeUndefined();
    expect(investigator?.flavor).toBeUndefined();
  });

  it('takes the chapter the pack data gives', () => {
    const markedPacks = normalisePacks([
      { code: 'new_box', name: 'New Box', position: 1, cycle_position: 9, chapter: 2 },
    ]);

    const [investigator] = buildInvestigatorCatalog(
      [rawInvestigator({ pack_code: 'new_box' })],
      markedPacks,
    );

    expect(investigator?.chapter).toBe(2);
  });

  it('removes a reprint of the same chapter', () => {
    const catalog = buildInvestigatorCatalog(
      [
        rawInvestigator(),
        rawInvestigator({ code: '2001', pack_code: 'old_cycle', duplicate_of_code: '1001' }),
      ],
      packs,
    );

    expect(catalog.map((i) => i.code)).toEqual(['1001']);
  });

  it('keeps Chapter One and Chapter Two versions and links them', () => {
    const catalog = buildInvestigatorCatalog(
      [
        rawInvestigator(),
        rawInvestigator({
          code: '3001',
          pack_code: 'core_2026',
          duplicate_of_code: '1001',
          health: 7,
        }),
      ],
      packs,
    );

    expect(catalog.map((i) => [i.code, i.chapter, i.otherChapterCode])).toEqual([
      ['1001', 1, '3001'],
      ['3001', 2, '1001'],
    ]);
  });

  it('links revised versions without a duplicate reference by name', () => {
    const catalog = buildInvestigatorCatalog(
      [rawInvestigator(), rawInvestigator({ code: '3001', pack_code: 'core_2026' })],
      packs,
    );

    expect(catalog.map((i) => i.otherChapterCode)).toEqual(['3001', '1001']);
  });

  it('keeps parallel versions as separate entries pointing at the original', () => {
    const catalog = buildInvestigatorCatalog(
      [rawInvestigator(), rawInvestigator({ code: '9001', alternate_of_code: '1001' })],
      packs,
    );

    expect(catalog.map((i) => [i.code, i.parallel, i.parallelOfCode, i.otherChapterCode])).toEqual([
      ['1001', false, undefined, undefined],
      ['9001', true, '1001', undefined],
    ]);
  });

  it('sorts by cycle, then chapter, pack and code', () => {
    const catalog = buildInvestigatorCatalog(
      [
        rawInvestigator({ code: '2002', pack_code: 'old_cycle', name: 'B' }),
        rawInvestigator({ code: '1002', name: 'C' }),
        rawInvestigator({ code: '1001', name: 'A' }),
      ],
      packs,
    );

    expect(catalog.map((i) => i.code)).toEqual(['1001', '1002', '2002']);
  });

  it('uses cycle 0 for unknown packs', () => {
    const [inv] = buildInvestigatorCatalog([rawInvestigator({ pack_code: 'mystery' })], packs);

    expect(inv?.cyclePosition).toBe(0);
  });

  it('rejects non-array input', () => {
    expect(() => buildInvestigatorCatalog({}, packs)).toThrow();
  });
});

describe('fetchCatalog', () => {
  const lastModified = 'Tue, 01 Jan 2030 00:00:00 GMT';
  const packsBody = [{ code: 'old_core', name: 'P', position: 1, cycle_position: 1 }];

  const fakeFetch =
    (
      cardsResponse: Response,
      cardsHeaders: Array<Record<string, string> | undefined> = [],
    ): FetchFn =>
    async (url, init) => {
      if (url.endsWith('/packs/')) return new Response(JSON.stringify(packsBody));
      cardsHeaders.push(init?.headers);
      return cardsResponse;
    };

  it('returns the catalog with the Last-Modified header', async () => {
    const cards = new Response(JSON.stringify([rawInvestigator()]), {
      headers: { 'Last-Modified': lastModified },
    });

    const result = await fetchCatalog('https://example.test', fakeFetch(cards));

    expect(result).toMatchObject({
      status: 'ok',
      catalog: { lastModified, investigators: [{ code: '1001' }] },
    });
  });

  it('sends If-Modified-Since and reports notModified on 304', async () => {
    const cardsHeaders: Array<Record<string, string> | undefined> = [];

    const result = await fetchCatalog(
      'https://example.test',
      fakeFetch(new Response(null, { status: 304 }), cardsHeaders),
      lastModified,
    );

    expect(result).toEqual({ status: 'notModified' });
    expect(cardsHeaders).toEqual([{ 'If-Modified-Since': lastModified }]);
  });

  it('throws when the cards request fails', async () => {
    await expect(
      fetchCatalog('https://example.test', fakeFetch(new Response('', { status: 500 }))),
    ).rejects.toThrow('cards -> HTTP 500');
  });

  it('throws when the packs request fails', async () => {
    await expect(
      fetchCatalog('https://example.test', async () => new Response('', { status: 503 })),
    ).rejects.toThrow('packs -> HTTP 503');
  });
});
