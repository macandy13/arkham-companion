import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importJsonData } from './fetch';
import { readJsonDataPacks, resolveJsonDataCards } from './json_data';

// Hand-written fake cards in the data repository's shape – never real card text.
const original_location = {
  code: '99101',
  name: 'Fake Hall',
  type_code: 'location',
  pack_code: 'fake_core',
  faction_code: 'neutral',
  position: 1,
  quantity: 1,
  encounter_code: 'fake_set',
  shroud: 2,
  clues: 1,
  text: 'Invented text.',
};

describe('resolveJsonDataCards', () => {
  it('completes a reprint stub with the fields of its original, keeping its own code and pack', () => {
    const reprint_stub = {
      code: '99901',
      duplicate_of: '99101',
      pack_code: 'fake_reprint',
      position: 7,
      quantity: 2,
    };

    const [, reprint] = resolveJsonDataCards([original_location, reprint_stub]);

    expect(reprint).toMatchObject({
      code: '99901',
      name: 'Fake Hall',
      pack_code: 'fake_reprint',
      position: 7,
      quantity: 2,
      shroud: 2,
      text: 'Invented text.',
    });
  });

  it('follows a reprint of a reprint to the first printing', () => {
    const first_reprint = {
      code: '99901',
      duplicate_of: '99101',
      pack_code: 'fake_reprint',
      position: 1,
    };
    const second_reprint = {
      code: '99951',
      duplicate_of: '99901',
      pack_code: 'fake_later',
      position: 1,
    };

    const [, , later] = resolveJsonDataCards([original_location, first_reprint, second_reprint]);

    expect(later).toMatchObject({ code: '99951', name: 'Fake Hall', pack_code: 'fake_later' });
  });

  it('stops at a duplicate_of cycle instead of looping', () => {
    const one = { code: '99961', duplicate_of: '99962', pack_code: 'fake', position: 1 };
    const other = { code: '99962', duplicate_of: '99961', pack_code: 'fake', position: 2 };

    const resolved = resolveJsonDataCards([one, other]);

    expect(resolved.map((entry) => entry.code)).toEqual(['99961', '99962']);
  });

  it('passes a stub whose original is missing on unchanged', () => {
    const orphan_stub = { code: '99902', duplicate_of: '99999', pack_code: 'fake', position: 1 };

    expect(resolveJsonDataCards([orphan_stub])).toEqual([orphan_stub]);
  });

  it('turns back_link into the API field linked_to_code', () => {
    const double_sided_enemy = { ...original_location, code: '99102', back_link: '99102b' };

    const [enemy] = resolveJsonDataCards([double_sided_enemy]);

    expect(enemy).toMatchObject({ linked_to_code: '99102b' });
  });
});

describe('reading a checkout', () => {
  let checkout: string;

  beforeEach(async () => {
    checkout = await mkdtemp(join(tmpdir(), 'json_data_'));
    await mkdir(join(checkout, 'pack', 'fake_cycle'), { recursive: true });
    await writeFile(
      join(checkout, 'pack', 'fake_cycle', 'fake_core_encounter.json'),
      JSON.stringify([original_location]),
    );
    await writeFile(
      join(checkout, 'pack', 'fake_cycle', 'fake_reprint.json'),
      JSON.stringify([
        { code: '99901', duplicate_of: '99101', pack_code: 'fake_reprint', position: 1 },
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
