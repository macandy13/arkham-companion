// The file, not the package index: merge_gate runs under Node's type stripping (NodeNext), and
// the index re-exports without file extensions.
import { escapeRegExp } from '@arkham/util/src/string.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * The rules ledger: every claim on a rules summary page (`docs/rules/`) names the test that
 * proves it, as a code span `` `packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator` ``
 * (the file, then its `describe` and `it` titles), linked to the test's line so a reader opens
 * it with one tap. With no owner reviewing rule code, the ledger
 * is how anyone sees what the app enforces and what checks it; `rules-checker` writes the
 * entries it confirms, and `rules_ledger.test.ts` fails when a named test disappears or a line
 * isn't linked to its file; `rules_ledger_cli.ts` writes and refreshes the links.
 */

/** One test a rules page names: its repo-relative file and its title path. */
export interface TestRef {
  readonly file: string;
  /** The `describe` and `it` titles in order, as written in the source (`$name` templates too). */
  readonly titles: readonly string[];
}

const SEPARATOR = ' › ';
// A code span, alone or as the text of a Markdown link: `[`…`](target)`.
const CODE_SPAN = /\[`([^`]+)`\]\(([^)\s]*)\)|`([^`]+)`/g;
const TEST_FILE = /\.test\.tsx?$/;

/** Finds the test references in a rules page: code spans of a test file path and its titles. */
export function parseTestRefs(markdown: string): TestRef[] {
  return [...markdown.matchAll(CODE_SPAN)].flatMap((match) => {
    const ref = testRef(match[1] ?? match[3] ?? '');
    return ref === undefined ? [] : [ref];
  });
}

/**
 * The test references on a page (`page` is its repo-relative path) that aren't linked to their
 * test file, as their spans. Only the file is checked, not the `#L` line: a check on the line
 * would fail every PR that adds a test above a named one, and parallel PRs would then conflict
 * on the rules pages. `pnpm rules:links` refreshes the lines whenever a page is edited.
 */
export function unlinkedTestRefs(page: string, markdown: string): string[] {
  return [...markdown.matchAll(CODE_SPAN)].flatMap((match) => {
    const span = match[1] ?? match[3] ?? '';
    const ref = testRef(span);
    if (ref === undefined) return [];
    const file = (match[2] ?? '').split('#')[0];
    return file === posix.relative(posix.dirname(page), ref.file) ? [] : [span];
  });
}

/** The repo-relative paths of the rules pages under `docs/rules/`, from the repo `root`. */
export function rulesPages(root: string): string[] {
  return readdirSync(join(root, 'docs/rules'), { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.md'))
    .map((path) => join('docs/rules', path));
}

/** Reads a repo-relative file under `root`, or undefined when it doesn't exist. */
export function repoFileReader(root: string): (file: string) => string | undefined {
  return (file) => {
    const path = join(root, file);
    return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  };
}

function testRef(span: string): TestRef | undefined {
  const [file, ...titles] = span.split(SEPARATOR);
  if (file === undefined || !TEST_FILE.test(file) || titles.length === 0) return undefined;
  return { file, titles };
}

/**
 * The references whose test no longer exists: its file is gone, or its titles are no longer
 * the first argument of a call (`describe(`, `it(`, `test(`, also with modifiers such as
 * `.skip(` or `it.each([…])(`) in that order in the file. Reading the source, not running the suite, keeps the check fast; a renamed, deleted or moved
 * test still fails it, which is the point. Titles built with `${…}` can't be named.
 */
export function missingTests(
  refs: readonly TestRef[],
  readTestFile: (file: string) => string | undefined,
): TestRef[] {
  return refs.filter((ref) => testLine(ref, readTestFile) === undefined);
}

/**
 * Links every test a rules page names to its line, as `[`…`](../../packages/…test.ts#L42)`
 * relative to the page (`page` is its repo-relative path), so GitHub opens the test itself.
 * Spans already linked get their target refreshed; a missing test keeps its span as it is,
 * since `missingTests` reports it.
 */
export function linkTestRefs(
  page: string,
  markdown: string,
  readTestFile: (file: string) => string | undefined,
): string {
  return markdown.replace(CODE_SPAN, (whole, linked?: string, _target?: string, bare?: string) => {
    const span = linked ?? bare ?? '';
    const ref = testRef(span);
    const line = ref === undefined ? undefined : testLine(ref, readTestFile);
    if (ref === undefined || line === undefined) return whole;
    const target = posix.relative(posix.dirname(page), ref.file);
    return `[\`${span}\`](${target}#L${line})`;
  });
}

// The 1-based line of the last title (the `it`), or undefined when the test is missing.
function testLine(
  ref: TestRef,
  readTestFile: (file: string) => string | undefined,
): number | undefined {
  const source = readTestFile(ref.file);
  if (source === undefined) return undefined;
  let from = 0;
  for (const title of ref.titles) {
    const at = titleCallIndex(source, title, from);
    if (at === undefined) return undefined;
    from = at;
  }
  return source.slice(0, from).split('\n').length;
}

// Where a `describe`, `it` or `test` call (`.skip(` and the like too, and the `])(` after an
// `.each` table) with this title as its first argument ends, at or after `from`. Only those calls
// count, so the same words in a command literal (`{ type: 'MoveHunters' }`) or an assertion
// don't. The order is checked, not the nesting: an `it` moved into a later sibling `describe`
// still passes.
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
