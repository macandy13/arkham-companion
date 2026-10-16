/**
 * Command-line entry for the review digest, run with plain `node` (type stripping) by
 * `.github/workflows/pr-quality.yml`. Reads the files the workflow prepared and prints
 * the comment's Markdown:
 *
 *   node cli.ts --base-tests <json> --base-root <dir> --head-tests <json> --head-root <dir>
 *     --coverage <coverage-final.json> --diff <diff -U0> --numstat <numstat> --blob-url <url>
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseChangedLines } from './changed_lines.ts';
import { uncoveredChangedLines, type CoverageReport } from './diff_coverage.ts';
import { measurePr, parseNumstat } from './pr_size.ts';
import { renderDigest } from './render.ts';
import { diffTestNames, type ListedTest } from './test_names.ts';

const required = { type: 'string', default: '' } as const;
const { values } = parseArgs({
  options: {
    'base-tests': required,
    'base-root': required,
    'head-tests': required,
    'head-root': required,
    coverage: required,
    diff: required,
    numstat: required,
    'blob-url': required,
  },
});
const missing = Object.entries(values).filter(([, value]) => value === '');
if (missing.length > 0) {
  console.error(`missing options: ${missing.map(([name]) => `--${name}`).join(', ')}`);
  process.exit(1);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

// A failed coverage run must not hide the rest of the digest; the CI check job reports
// the failure itself.
function readCoverage(path: string): CoverageReport | undefined {
  if (existsSync(path)) return readJson<CoverageReport>(path);
  console.warn(`${path} not found; the digest says coverage is not available.`);
  return undefined;
}

const coverage = readCoverage(values.coverage);

const changed = parseChangedLines(readFileSync(values.diff, 'utf8'));
process.stdout.write(
  renderDigest({
    size: measurePr(parseNumstat(readFileSync(values.numstat, 'utf8'))),
    uncovered: coverage && uncoveredChangedLines(coverage, changed, values['head-root']),
    tests: diffTestNames(
      readJson<ListedTest[]>(values['base-tests']),
      readJson<ListedTest[]>(values['head-tests']),
      { base: values['base-root'], head: values['head-root'] },
    ),
    blobUrl: values['blob-url'],
  }),
);
