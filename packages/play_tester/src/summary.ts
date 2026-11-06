import { addCount, sum } from '@arkham/util';
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
    addCount(ends, result.end);
    if (result.finding) addCount(findings, result.finding.check);
    for (const [code, times] of Object.entries(result.refusals) as [RejectionCode, number][])
      addCount(refusals, code, times);
  }
  return {
    games: results.length,
    ends,
    findings,
    steps: sum(results.map(({ steps }) => steps.length)),
    refusals,
    misuses: sum(results.map(({ misuses }) => misuses)),
  };
}

/** `summary` as plain lines, for the terminal (the nightly job summary formats its own). */
export function formatSummary(summary: Summary): string {
  const { games, ends, findings, steps, refusals, misuses } = summary;
  const refused = sum(Object.values(refusals));
  return [
    `Games: ${games}, steps played: ${steps}`,
    `Ends: ${byCountDescending(ends)}`,
    `Findings: ${byCountDescending(findings)}`,
    `Expected refusals: ${refused} (${byCountDescending(refusals)}); misused steps: ${misuses}`,
  ].join('\n');
}

/** `{ a: 2, b: 1 }` as `a 2, b 1`, most first; `none` when empty. */
function byCountDescending(byKey: Partial<Record<string, number>>): string {
  const entries = Object.entries(byKey) as [string, number][];
  if (entries.length === 0) return 'none';
  return entries
    .sort(([, a], [, b]) => b - a)
    .map(([key, times]) => `${key} ${times}`)
    .join(', ');
}
