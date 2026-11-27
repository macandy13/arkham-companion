/**
 * Rewrites the test links on the rules pages (`docs/rules/`) so each points at its test's
 * current line (`linkTestRefs`). Run it after moving, adding or deleting tests a page names;
 * `rules_ledger.test.ts` says so when a link is out of date.
 *
 *   pnpm rules:links
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkTestRefs } from './rules_ledger.ts';

const root = join(import.meta.dirname, '../../..');
const readTestFile = (file: string): string | undefined => {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
};
const pages = readdirSync(join(root, 'docs/rules'), { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.md'))
  .map((path) => join('docs/rules', path));
for (const page of pages) {
  const before = readFileSync(join(root, page), 'utf8');
  const after = linkTestRefs(page, before, readTestFile);
  if (after !== before) {
    writeFileSync(join(root, page), after);
    console.log(`linked ${page}`);
  }
}
