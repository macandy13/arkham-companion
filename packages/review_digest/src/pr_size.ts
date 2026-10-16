/** One row of `git diff --numstat`: lines added and deleted in a file. */
export interface FileStat {
  readonly file: string;
  readonly added: number;
  readonly deleted: number;
}

/**
 * Where a changed file's lines count against the PR size budget
 * (`docs/coding-guidelines.md` §7): `production` and `test` both count toward the total,
 * only `production` toward the production budget; `docs` counts toward the total;
 * `excluded` (lockfile, changelog, task checklists, API reports) counts nowhere.
 */
export type SizeCategory = 'production' | 'test' | 'docs' | 'excluded';

/** Changed lines per category, as summed by {@link measurePr}. */
export interface PrSize {
  readonly production: number;
  readonly test: number;
  readonly docs: number;
  readonly excluded: number;
  /** Production, test and docs lines: what a reviewer reads. */
  readonly total: number;
}

/** The size budget from `docs/coding-guidelines.md` §7. */
export const SIZE_BUDGET = { production: 400, total: 1000 } as const;

const EXCLUDED = [
  /^pnpm-lock\.yaml$/,
  /^CHANGELOG\.md$/,
  /^\.release-please-manifest\.json$/,
  /^docs\/tasks\//,
  // Generated mirror of the exports: the production change it reflects is already counted.
  /^packages\/[^/]+\/api\.md$/,
];
const TESTS = [/\.test\.tsx?$/, /\.spec\.ts$/, /(^|\/)test\//, /(^|\/)e2e\//];

/** Sorts a changed file into its {@link SizeCategory} by path. */
export function sizeCategory(file: string): SizeCategory {
  if (EXCLUDED.some((pattern) => pattern.test(file))) return 'excluded';
  if (TESTS.some((pattern) => pattern.test(file))) return 'test';
  if (file.endsWith('.md')) return 'docs';
  return 'production';
}

/**
 * Parses `git diff --numstat` output. Binary files print `-` for both counts and are
 * skipped: their size says nothing about review effort.
 */
export function parseNumstat(numstat: string): FileStat[] {
  return numstat
    .split('\n')
    .map((line) => line.split('\t'))
    .flatMap(([added, deleted, file]) =>
      file && added !== '-' && deleted !== '-'
        ? [{ file, added: Number(added), deleted: Number(deleted) }]
        : [],
    );
}

/** Sums added plus deleted lines per {@link SizeCategory}. */
export function measurePr(stats: readonly FileStat[]): PrSize {
  const size = { production: 0, test: 0, docs: 0, excluded: 0 };
  for (const { file, added, deleted } of stats) size[sizeCategory(file)] += added + deleted;
  return { ...size, total: size.production + size.test + size.docs };
}
