import type { ChangedLines } from './changed_lines.ts';

/** A source position in Istanbul's coverage format. */
interface Position {
  readonly line: number;
}

/**
 * One file's entry in Vitest's `coverage-final.json` (Istanbul format), reduced to the
 * statement data diff coverage needs: where each statement is, and how often it ran.
 */
export interface FileCoverage {
  readonly statementMap: Readonly<Record<string, { readonly start: Position }>>;
  readonly s: Readonly<Record<string, number>>;
}

/** `coverage-final.json`: per-file coverage keyed by absolute path. */
export type CoverageReport = Readonly<Record<string, FileCoverage>>;

/** A run of changed lines no test executes, inclusive at both ends. */
export interface LineRange {
  readonly from: number;
  readonly to: number;
}

/** The uncovered changed lines of one file, as produced by {@link uncoveredChangedLines}. */
export interface UncoveredFile {
  readonly file: string;
  readonly ranges: readonly LineRange[];
}

/**
 * Production code of the engine and the scenarios: where rules live, and so where an
 * untested changed line matters to the reviewer. App code is covered by E2E as much as
 * by unit tests, so its unit coverage gaps would mostly be noise.
 */
export function isRulesCode(file: string): boolean {
  return /^packages\/(engine|scenarios)\/src\/.+\.ts$/.test(file) && !file.endsWith('.test.ts');
}

/**
 * The changed lines in rules code that hold a statement no test ran, per file, in diff
 * order. A line counts as covered when any statement starting on it ran, so a line with
 * a partly taken branch is not reported (branch gaps are the coverage floors' job).
 * Uncovered lines merge into one range when no other statement lies between them, so an
 * untested new function reads as one range without swallowing unchanged code.
 */
export function uncoveredChangedLines(
  coverage: CoverageReport,
  changed: ChangedLines,
  root: string,
): UncoveredFile[] {
  return [...changed]
    .filter(([file]) => isRulesCode(file))
    .flatMap(([file, lines]) => {
      const fileCoverage = coverage[`${root}/${file}`];
      if (!fileCoverage) return [];
      const ranges = uncoveredRanges(statementHits(fileCoverage), lines);
      return ranges.length > 0 ? [{ file, ranges }] : [];
    });
}

/** Per statement line, whether any statement starting on it ran. */
function statementHits(coverage: FileCoverage): Map<number, boolean> {
  const hits = new Map<number, boolean>();
  for (const [id, { start }] of Object.entries(coverage.statementMap)) {
    const ran = (coverage.s[id] ?? 0) > 0;
    hits.set(start.line, (hits.get(start.line) ?? false) || ran);
  }
  return hits;
}

function uncoveredRanges(hits: Map<number, boolean>, changed: readonly number[]): LineRange[] {
  const statementLines = [...hits.keys()];
  const uncovered = [...new Set(changed)]
    .filter((line) => hits.get(line) === false)
    .sort((a, b) => a - b);
  const ranges: LineRange[] = [];
  for (const line of uncovered) {
    const last = ranges.at(-1);
    const statementBetween = last && statementLines.some((s) => s > last.to && s < line);
    if (last && !statementBetween) ranges[ranges.length - 1] = { from: last.from, to: line };
    else ranges.push({ from: line, to: line });
  }
  return ranges;
}
