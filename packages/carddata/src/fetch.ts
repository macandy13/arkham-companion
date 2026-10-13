import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalisePack } from './schema';

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
  const file = join(outDir, lang, `${pack}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(cards, null, 2) + '\n');
  return file;
}

/** Usage: pnpm carddata:fetch [--lang en,de] [pack ...] */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let langs: Lang[] = ['en'];
  const packs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--lang') {
      langs = (args[++i] ?? '').split(',').map((l) => {
        if (l !== 'en' && l !== 'de') throw new Error(`Unsupported language: ${l}`);
        return l;
      });
    } else packs.push(a);
  }
  for (const lang of langs) {
    for (const pack of packs.length ? packs : DEFAULT_PACKS) {
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
