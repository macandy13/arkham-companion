import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importJsonData } from './fetch';
import { readJsonDataPacks, resolveJsonDataCards } from './json_data';

// Hand-written fake cards in the data repository's shape – never real card text.

/** A complete raw location; every field a test checks is passed in `fields`. */
function rawLocation(fields: { code: string; name: string; pack_code: string; shroud?: number }) {
  return { type_code: 'location', faction_code: 'neutral', position: 1, quantity: 1, ...fields };
}

/** A reprint stub as the data repository stores it: no name, type or text. */
function reprintStub(fields: { code: string; duplicate_of: string; pack_code: string }) {
  return { position: 1, quantity: 1, ...fields };
}

describe('resolveJsonDataCards', () => {
  it('completes a reprint stub with the fields of its original, keeping its own code and pack', () => {
    const hall = rawLocation({
      code: '99101',
      name: 'Fake Hall',
      pack_code: 'fake_core',
      shroud: 2,
    });
    const hall_reprint = reprintStub({
      code: '99901',
      duplicate_of: '99101',
      pack_code: 'fake_reprint',
    });

    const [, reprint] = resolveJsonDataCards([hall, hall_reprint]);

    expect(reprint).toMatchObject({
      code: '99901',
      pack_code: 'fake_reprint',
      name: 'Fake Hall',
      shroud: 2,
    });
  });

  it('follows a reprint of a reprint to the first printing', () => {
    const hall = rawLocation({ code: '99101', name: 'Fake Hall', pack_code: 'fake_core' });
    const first_reprint = reprintStub({
      code: '99901',
      duplicate_of: '99101',
      pack_code: 'fake_reprint',
    });
    const second_reprint = reprintStub({
      code: '99951',
      duplicate_of: '99901',
      pack_code: 'fake_later',
    });

    const [, , later] = resolveJsonDataCards([hall, first_reprint, second_reprint]);

    expect(later).toMatchObject({ code: '99951', name: 'Fake Hall', pack_code: 'fake_later' });
  });

  it('stops at a duplicate_of cycle instead of looping', () => {
    const one = reprintStub({ code: '99961', duplicate_of: '99962', pack_code: 'fake' });
    const other = reprintStub({ code: '99962', duplicate_of: '99961', pack_code: 'fake' });

    const resolved = resolveJsonDataCards([one, other]);

    expect(resolved.map((entry) => entry.code)).toEqual(['99961', '99962']);
  });

  it('passes a stub whose original is missing on unchanged', () => {
    const orphan_stub = reprintStub({ code: '99902', duplicate_of: '99999', pack_code: 'fake' });

    expect(resolveJsonDataCards([orphan_stub])).toEqual([orphan_stub]);
  });

  it('turns back_link into the API field linked_to_code', () => {
    const double_sided_location = {
      ...rawLocation({ code: '99102', name: 'Fake Vault', pack_code: 'fake_core' }),
      back_link: '99102b',
    };

    const [vault] = resolveJsonDataCards([double_sided_location]);

    expect(vault).toMatchObject({ linked_to_code: '99102b' });
  });
});

describe('reading a checkout with Fake Hall (99101, shroud 2) in fake_core and its reprint 99901 in fake_reprint', () => {
  let checkout: string;

  beforeEach(async () => {
    checkout = await mkdtemp(join(tmpdir(), 'json_data_'));
    const cycle = join(checkout, 'pack', 'fake_cycle');
    await mkdir(cycle, { recursive: true });
    await writeFile(
      join(cycle, 'fake_core_encounter.json'),
      JSON.stringify([
        rawLocation({ code: '99101', name: 'Fake Hall', pack_code: 'fake_core', shroud: 2 }),
      ]),
    );
    await writeFile(
      join(cycle, 'fake_reprint.json'),
      JSON.stringify([
        reprintStub({ code: '99901', duplicate_of: '99101', pack_code: 'fake_reprint' }),
      ]),
    );
  });

  afterEach(async () => {
    await rm(checkout, { recursive: true, force: true });
  });

  it('normalises every card under pack/ and groups the cards by pack, reprints across files included', async () => {
    const packs = await readJsonDataPacks(checkout);

    expect([...packs.keys()].sort()).toEqual(['fake_core', 'fake_reprint']);
    expect(packs.get('fake_reprint')?.map((card) => [card.code, card.name])).toEqual([
      ['99901', 'Fake Hall'],
    ]);
  });

  it('writes one English cache file per pack', async () => {
    const cache = join(checkout, 'cache');

    await importJsonData(checkout, cache);

    const written: unknown = JSON.parse(
      await readFile(join(cache, 'en', 'fake_core.json'), 'utf8'),
    );
    expect(written).toMatchObject([{ code: '99101', name: 'Fake Hall', shroud: 2 }]);
  });
});
