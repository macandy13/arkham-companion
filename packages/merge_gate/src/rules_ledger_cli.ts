/**
 * Rewrites the test links on the rules pages (`docs/rules/`) so each points at its test's
 * current line (`linkTestRefs`). Run it after adding `Test:` lines or editing a rules page;
 * `rules_ledger.test.ts` fails when a line isn't linked.
 *
 *   pnpm rules:links [docs/rules/hunter.md …]   (no pages: all of them)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkTestRefs, repoFileReader, rulesPages } from './rules_ledger.ts';

const root = join(import.meta.dirname, '../../..');
const readTestFile = repoFileReader(root);
// Only the pages named: refreshing every page would rewrite lines a parallel PR touches too.
const named = process.argv.slice(2);
for (const page of named.length > 0 ? named : rulesPages(root)) {
  const before = readFileSync(join(root, page), 'utf8');
  const after = linkTestRefs(page, before, readTestFile);
  if (after !== before) {
    writeFileSync(join(root, page), after);
    console.log(`linked ${page}`);
  }
}
