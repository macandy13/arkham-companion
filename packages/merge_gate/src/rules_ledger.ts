// The file, not the package index: merge_gate runs under Node's type stripping (NodeNext), and
// the index re-exports without file extensions.
import { escapeRegExp } from '@arkham/util/src/string.ts';

/**
 * The rules ledger: every claim on a rules summary page (`docs/rules/`) names the test that
 * proves it, as a code span `` `packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator` ``
 * (the file, then its `describe` and `it` titles). With no owner reviewing rule code, the ledger
 * is how anyone sees what the app enforces and what checks it; `rules-checker` writes the
 * entries it confirms, and `rules_ledger.test.ts` fails when a named test disappears.
 */

/** One test a rules page names: its repo-relative file and its title path. */
export interface TestRef {
  readonly file: string;
  /** The `describe` and `it` titles in order, as written in the source (`$name` templates too). */
  readonly titles: readonly string[];
}

const SEPARATOR = ' › ';
const CODE_SPAN = /`([^`]+)`/g;
const TEST_FILE = /\.test\.tsx?$/;

/** Finds the test references in a rules page: code spans of a test file path and its titles. */
export function parseTestRefs(markdown: string): TestRef[] {
  return [...markdown.matchAll(CODE_SPAN)].flatMap((match) => {
    const [file, ...titles] = (match[1] ?? '').split(SEPARATOR);
    if (file === undefined || !TEST_FILE.test(file) || titles.length === 0) return [];
    return [{ file, titles }];
  });
}

/**
 * The references whose test no longer exists: its file is gone, or its titles are no longer
 * the first argument of a call (`describe(`, `it(`, `test(`, also with modifiers such as `.skip(` or `it.each([…])(`) in that order in the file.
 * Reading the source, not running the suite, keeps the check fast; a renamed, deleted or moved
 * test still fails it, which is the point. Titles built with `${…}` can't be named.
 */
export function missingTests(
  refs: readonly TestRef[],
  readTestFile: (file: string) => string | undefined,
): TestRef[] {
  return refs.filter((ref) => {
    const source = readTestFile(ref.file);
    if (source === undefined) return true;
    let from = 0;
    for (const title of ref.titles) {
      const at = titleCallIndex(source, title, from);
      if (at === undefined) return true;
      from = at;
    }
    return false;
  });
}

// Where a `describe`, `it` or `test` call (`.skip(` and the like too, and the `])(` after an
// `.each` table) with this title as its first argument ends, at or after `from`. Only those calls
// count, so the same words in a command literal (`{ type: 'MoveHunters' }`) or an assertion don't. The order is checked, not the
// nesting: an `it` moved into a later sibling `describe` still passes.
function titleCallIndex(source: string, title: string, from: number): number | undefined {
  const quoted = ["'", '"', '`'].map((quote) => `${quote}${escapeRegExp(title)}${quote}`);
  const call = new RegExp(
    `(?:\\b(?:describe|it|test)(?:\\.\\w+)*|\\]\\))\\(\\s*(?:${quoted.join('|')})`,
    'g',
  );
  call.lastIndex = from;
  const match = call.exec(source);
  return match === null ? undefined : match.index + match[0].length;
}
