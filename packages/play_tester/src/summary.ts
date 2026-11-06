import type { RejectionCode } from '@arkham/engine';
import type { CheckId, RunResult } from './play_run';

/**
 * A night's (or a session's) runs counted up: games, how they ended, findings by check, and the
 * refusals and misuses the bot met, which are only reported (product.md "Continuous play tester").
 */
export interface Summary {
  readonly games: number;
  readonly ends: Partial<Record<RunResult['end'], number>>;
  readonly findings: Partial<Record<CheckId, number>>;
  readonly steps: number;
  readonly refusals: Partial<Record<RejectionCode, number>>;
  readonly misuses: number;
}

/** The counts over `results`. */
export function summarise(results: readonly RunResult[]): Summary {
  const ends: Partial<Record<RunResult['end'], number>> = {};
  const findings: Partial<Record<CheckId, number>> = {};
  const refusals: Partial<Record<RejectionCode, number>> = {};
  for (const result of results) {
    count(ends, result.end, 1);
    if (result.finding) count(findings, result.finding.check, 1);
    for (const [code, times] of Object.entries(result.refusals) as [RejectionCode, number][])
      count(refusals, code, times);
  }
  return {
    games: results.length,
    ends,
    findings,
    steps: results.reduce((sum, { steps }) => sum + steps.length, 0),
    refusals,
    misuses: results.reduce((sum, { misuses }) => sum + misuses, 0),
  };
}

/** `summary` as Markdown lines, for the terminal and the nightly job summary. */
export function formatSummary(summary: Summary): string {
  const { games, ends, findings, steps, refusals, misuses } = summary;
  const refused = Object.values(refusals).reduce((sum, times) => sum + times, 0);
  return [
    `Games: ${games}, steps played: ${steps}`,
    `Ends: ${counts(ends)}`,
    `Findings: ${counts(findings)}`,
    `Expected refusals: ${refused} (${counts(refusals)}); misused steps: ${misuses}`,
  ].join('\n');
}

function count<K extends string>(counts: Partial<Record<K, number>>, key: K, times: number): void {
  counts[key] = (counts[key] ?? 0) + times;
}

/** `{ a: 2, b: 1 }` as `a 2, b 1`, most first; `none` when empty. */
function counts(byKey: Partial<Record<string, number>>): string {
  const entries = Object.entries(byKey) as [string, number][];
  if (entries.length === 0) return 'none';
  return entries
    .sort(([, a], [, b]) => b - a)
    .map(([key, times]) => `${key} ${times}`)
    .join(', ');
}
