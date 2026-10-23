import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { normalisePack } from './schema';

export type Lang = 'en' | 'de';

export const HOSTS: Record<Lang, string> = {
  en: 'https://arkhamdb.com',
  de: 'https://de.arkhamdb.com',
};

/**
 * The packs `pnpm carddata:fetch` loads without arguments: the Chapter One core set first,
 * since Night of the Zealot is the first campaign, then the Chapter Two core set and Children
 * of Blood.
 */
export const DEFAULT_PACKS = ['core', 'core_2026', 'cob'];

export function packUrl(lang: Lang, pack: string): string {
  return `${HOSTS[lang]}/api/public/cards/${pack}.json?encounter=1`;
}

export const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache');

export async function fetchPack(lang: Lang, pack: string, outDir = CACHE_DIR): Promise<string> {
  const res = await fetch(packUrl(lang, pack));
  if (!res.ok) throw new Error(`${packUrl(lang, pack)} -> HTTP ${res.status}`);
  const cards = normalisePack(await res.json());
  const file = join(outDir, lang, `${pack}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(cards, null, 2) + '\n');
  return file;
}

/** Usage: pnpm carddata:fetch [--lang en,de] [pack ...] */
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: { lang: { type: 'string', default: 'en' } },
    allowPositionals: true,
  });
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
