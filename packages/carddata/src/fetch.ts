import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readJsonDataPacks } from './json_data';
import { normalisePack, type CardDef } from './schema';

export type Lang = 'en' | 'de';

export const HOSTS: Record<Lang, string> = {
  en: 'https://arkhamdb.com',
  de: 'https://de.arkhamdb.com',
};

export const DEFAULT_PACKS = ['core_2026'];

export function packUrl(lang: Lang, pack: string): string {
  return `${HOSTS[lang]}/api/public/cards/${pack}.json?encounter=1`;
}

export const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache');

export async function fetchPack(lang: Lang, pack: string, outDir = CACHE_DIR): Promise<string> {
  const res = await fetch(packUrl(lang, pack));
  if (!res.ok) throw new Error(`${packUrl(lang, pack)} -> HTTP ${res.status}`);
  const cards = normalisePack(await res.json());
  return writePack(join(outDir, lang, `${pack}.json`), cards);
}

/**
 * Writes every pack of an arkhamdb-json-data checkout to the cache, in the same per-pack files
 * as `fetchPack`. English only: the repository's translations are kept separately.
 */
export async function importJsonData(dir: string, outDir = CACHE_DIR): Promise<string[]> {
  const files: string[] = [];
  for (const [pack, cards] of await readJsonDataPacks(dir)) {
    files.push(await writePack(join(outDir, 'en', `${pack}.json`), cards));
  }
  return files;
}

async function writePack(file: string, cards: readonly CardDef[]): Promise<string> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(cards, null, 2) + '\n');
  return file;
}

/**
 * Usage: pnpm carddata:fetch [--lang en,de] [pack ...]
 *    or: pnpm carddata:fetch --json-data <arkhamdb-json-data checkout>   (all packs, English)
 */
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: { lang: { type: 'string', default: 'en' }, 'json-data': { type: 'string' } },
    allowPositionals: true,
  });
  const jsonData = values['json-data'];
  if (jsonData !== undefined) {
    console.log(`wrote ${(await importJsonData(jsonData)).length} packs from ${jsonData}`);
    return;
  }
  const langs = values.lang.split(',').map((l) => {
    if (l !== 'en' && l !== 'de') throw new Error(`Unsupported language: ${l}`);
    return l;
  });
  for (const lang of langs) {
    for (const pack of positionals.length ? positionals : DEFAULT_PACKS) {
      console.log(`wrote ${await fetchPack(lang, pack)}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
