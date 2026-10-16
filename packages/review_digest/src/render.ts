import type { LineRange, UncoveredFile } from './diff_coverage.ts';
import { SIZE_BUDGET, type PrSize } from './pr_size.ts';
import type { TestNameChanges } from './test_names.ts';

/** Everything the digest comment shows, gathered by `cli.ts`. */
export interface Digest {
  readonly size: PrSize;
  /** Undefined when the coverage run produced no report. */
  readonly uncovered: readonly UncoveredFile[] | undefined;
  readonly tests: readonly TestNameChanges[];
  /** Base for links to the PR head's files, e.g. `https://github.com/o/r/blob/<sha>`. */
  readonly blobUrl: string;
}

/**
 * Renders the review digest as the Markdown of one PR comment: the size against the
 * budget, untested changed rules code, and the test names added and removed. Test names
 * sit in a collapsed block per file, so a big PR's list doesn't push the rest off a
 * phone screen.
 */
export function renderDigest(digest: Digest): string {
  return [
    '### Review digest',
    '',
    ...sizeSection(digest.size),
    '',
    ...coverageSection(digest.uncovered, digest.blobUrl),
    '',
    ...testsSection(digest.tests),
    '',
  ].join('\n');
}

function sizeSection(size: PrSize): string[] {
  const overBudget = size.production > SIZE_BUDGET.production || size.total > SIZE_BUDGET.total;
  return [
    `**Size:** ${size.production} production / ${size.total} total changed lines ` +
      `(budget ${SIZE_BUDGET.production} / ${SIZE_BUDGET.total}): ` +
      (overBudget
        ? '**over budget**, split it or explain why not (`docs/coding-guidelines.md` §7).'
        : 'within budget.'),
    `Tests ${size.test}, docs ${size.docs}; not counted: ${size.excluded} (lockfile, changelog, task files).`,
  ];
}

function coverageSection(
  uncovered: readonly UncoveredFile[] | undefined,
  blobUrl: string,
): string[] {
  if (!uncovered) return ['**Untested changed lines:** not available, the coverage run failed.'];
  if (uncovered.length === 0) {
    return [
      '**Untested changed lines:** none, every changed engine and scenario line runs in a test.',
    ];
  }
  return [
    '**Untested changed lines** (engine and scenarios):',
    ...uncovered.map(
      ({ file, ranges }) =>
        `- \`${file}\` ${ranges.map((range) => rangeLink(blobUrl, file, range)).join(', ')}`,
    ),
  ];
}

function rangeLink(blobUrl: string, file: string, { from, to }: LineRange): string {
  const label = from === to ? `${from}` : `${from}–${to}`;
  const anchor = from === to ? `L${from}` : `L${from}-L${to}`;
  return `[${label}](${blobUrl}/${file}#${anchor})`;
}

function testsSection(tests: readonly TestNameChanges[]): string[] {
  if (tests.length === 0) return ['**What the tests claim:** no test names changed.'];
  return ['**What the tests now claim:**', '', ...tests.flatMap(testFileBlock)];
}

function testFileBlock({ file, added, removed }: TestNameChanges): string[] {
  return [
    `<details><summary><code>${file}</code>: +${added.length} −${removed.length}</summary>`,
    '',
    ...added.map((name) => `- added: ${readableName(name)}`),
    ...removed.map((name) => `- removed: ${readableName(name)}`),
    '',
    '</details>',
  ];
}

/** Vitest joins describes with ` > `; a narrower arrow reads better on a phone. */
function readableName(name: string): string {
  return name.replaceAll(' > ', ' › ');
}
