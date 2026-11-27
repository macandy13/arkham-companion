/**
 * Rewrites the test links on the rules pages (`docs/rules/`) so each points at its test's
 * current line (`linkTestRefs`). Run it after adding `Test:` lines or editing a rules page;
 * `rules_ledger.test.ts` fails when a line isn't linked.
 *
 *   pnpm rules:links
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkTestRefs, repoFileReader, rulesPages } from './rules_ledger.ts';

const root = join(import.meta.dirname, '../../..');
const readTestFile = repoFileReader(root);
for (const page of rulesPages(root)) {
  const before = readFileSync(join(root, page), 'utf8');
  const after = linkTestRefs(page, before, readTestFile);
  if (after !== before) {
    writeFileSync(join(root, page), after);
    console.log(`linked ${page}`);
  }
}
