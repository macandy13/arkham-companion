import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normaliseCard, type CardDef } from './schema';

// Cards from a checkout of arkhamdb-json-data (https://github.com/Kamalisk/arkhamdb-json-data),
// the repository ArkhamDB is built from. It is the source when the ArkhamDB API is unreachable
// (cloud sessions block it), and one clone holds every pack.

/** One raw card entry as the data repository stores it; checked later by `normaliseCard`. */
type RawEntry = Readonly<Record<string, unknown>>;

/**
 * Raw entries in the shape of the ArkhamDB API:
 * - a reprint is stored as a stub (`duplicate_of`, code, pack, position, quantity) without name
 *   or text; the API returns it complete, so it gets the original's fields under its own code;
 * - the API's `linked_to_code` (the other side of a double-sided card) is called `back_link`.
 *
 * A reprint of a reprint follows the chain to the first printing. A stub whose original is
 * missing is passed on unchanged, so `normaliseCard` reports it.
 */
export function resolveJsonDataCards(entries: readonly RawEntry[]): RawEntry[] {
  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  return entries.map((entry) => {
    const complete = withOriginal(entry, byCode, new Set());
    return complete.back_link === undefined || complete.linked_to_code !== undefined
      ? complete
      : { ...complete, linked_to_code: complete.back_link };
  });
}

/** The entry with its original's fields underneath; `seen` stops a `duplicate_of` cycle. */
function withOriginal(
  entry: RawEntry,
  byCode: ReadonlyMap<unknown, RawEntry>,
  seen: Set<unknown>,
): RawEntry {
  const original = entry.duplicate_of === undefined ? undefined : byCode.get(entry.duplicate_of);
  if (original === undefined || seen.has(entry.code)) return entry;
  seen.add(entry.code);
  return { ...withOriginal(original, byCode, seen), ...entry };
}

/**
 * Every card of the checkout at `dir`, normalised and grouped by pack. Reads all JSON files
 * under `dir/pack/` (one per pack plus one per pack's encounter cards). Throws on malformed
 * cards, like `normalisePack`.
 */
export async function readJsonDataPacks(dir: string): Promise<Map<string, CardDef[]>> {
  const packDir = join(dir, 'pack');
  const files = (await readdir(packDir, { recursive: true })).filter((f) => f.endsWith('.json'));
  const entries: RawEntry[] = [];
  for (const file of files.sort()) {
    const parsed: unknown = JSON.parse(await readFile(join(packDir, file), 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`Expected an array of cards in ${file}`);
    entries.push(...(parsed as RawEntry[]));
  }
  return cardsByPack(resolveJsonDataCards(entries).map(normaliseCard));
}

function cardsByPack(cards: readonly CardDef[]): Map<string, CardDef[]> {
  const packs = new Map<string, CardDef[]>();
  for (const card of cards) {
    const pack = packs.get(card.packCode);
    if (pack) pack.push(card);
    else packs.set(card.packCode, [card]);
  }
  return packs;
}
