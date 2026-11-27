/**
 * Command-line entry for the daily digest (MA.6), run with plain `node` by `digest.yml`. Reads a
 * day's merged PRs as NDJSON (one `MergedPr` per line), keeps those merged without the owner's
 * approval and writes the page to `<out>/index.html`. Prints how many PRs it lists.
 *
 *   node digest_cli.ts --prs <file> --owner <login> --repo <owner/name> --date <YYYY-MM-DD> --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { mergedWithoutOwner, renderDigest, type MergedPr } from './digest.ts';

const required = { type: 'string', default: '' } as const;
const { values } = parseArgs({
  options: { prs: required, owner: required, repo: required, date: required, out: required },
});
const missing = Object.entries(values).filter(([, value]) => value === '');
if (missing.length > 0) {
  console.error(`missing ${missing.map(([name]) => `--${name}`).join(', ')}`);
  process.exit(1);
}
const merged = readFileSync(values.prs, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line) as MergedPr);
const prs = mergedWithoutOwner(merged, values.owner);
mkdirSync(values.out, { recursive: true });
writeFileSync(
  join(values.out, 'index.html'),
  renderDigest({ repo: values.repo, date: values.date, prs }),
);
console.log(`${prs.length} of ${merged.length} merged PRs without the owner`);
