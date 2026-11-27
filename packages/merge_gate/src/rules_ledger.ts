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
 * The references whose test no longer exists: its file is gone, or one of its titles is no
 * longer a string literal in that file. Checking each title as a literal, not running the
 * suite, keeps the check fast; a renamed or deleted test still fails it, which is the point.
 */
export function missingTests(
  refs: readonly TestRef[],
  readTestFile: (file: string) => string | undefined,
): TestRef[] {
  return refs.filter((ref) => {
    const source = readTestFile(ref.file);
    if (source === undefined) return true;
    return !ref.titles.every((title) =>
      ["'", '"', '`'].some((quote) => source.includes(`${quote}${title}${quote}`)),
    );
  });
}
