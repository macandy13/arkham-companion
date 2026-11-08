import type { Finding } from './play_run';
import type { RunRecord } from './record';
import { formatSummary, type Summary } from './summary';

/**
 * What a finding is filed under (product.md "Who runs it and where it writes"): its check and the
 * kind of step that failed, or the whole game for a check that compares whole games or no single
 * step. The nightly run opens one GitHub issue per signature, so games that break alike are one
 * bug, not one issue each.
 */
export function findingSignature({
  check,
  attempted,
}: Pick<Finding, 'check' | 'attempted'>): string {
  return `${check} at ${attempted ? attempted.verb : 'the whole game'}`;
}

/** A record the night wrote, with the path of its report (`findingReport`). */
export interface WrittenRecord {
  readonly record: RunRecord;
  readonly report: string;
}

/**
 * One signature of a night: how many games failed alike and the report of the shortest of them,
 * which becomes the body of the signature's issue. The nightly workflow reads these as JSON.
 */
export interface NightlyFinding {
  readonly signature: string;
  readonly games: number;
  readonly report: string;
}

/** `written` grouped by signature, most games first; each names the report with the fewest steps. */
export function nightlyFindings(written: readonly WrittenRecord[]): NightlyFinding[] {
  const groups = new Map<string, WrittenRecord[]>();
  for (const entry of written) {
    const signature = findingSignature(entry.record.finding);
    groups.set(signature, [...(groups.get(signature) ?? []), entry]);
  }
  return [...groups]
    .map(([signature, entries]) => ({
      signature,
      games: entries.length,
      report: shortest(entries).report,
    }))
    .sort((a, b) => b.games - a.games);
}

/** The entry whose record has the fewest steps, the easiest to read; the first of equals. */
function shortest(entries: readonly WrittenRecord[]): WrittenRecord {
  return entries.reduce((best, entry) =>
    entry.record.steps.length < best.record.steps.length ? entry : best,
  );
}

/**
 * The night for the job summary page: the seed, the counts of `summary`, the committed records
 * (`findings/`) that fail again, and one row per signature.
 */
export function nightlySummary(
  seed: number,
  summary: Summary,
  findings: readonly NightlyFinding[],
  comeBack: readonly string[],
): string {
  return [
    `### Play tester, seed ${seed}`,
    '',
    ...formatSummary(summary)
      .split('\n')
      .map((line) => `- ${line}`),
    `- Fixed bugs that came back: ${comeBack.length === 0 ? 'none' : comeBack.join(', ')}`,
    ...(findings.length === 0
      ? []
      : [
          '',
          '| Finding | Games | Report |',
          '| --- | --- | --- |',
          ...findings.map(
            ({ signature, games, report }) => `| ${signature} | ${games} | ${report} |`,
          ),
        ]),
  ].join('\n');
}
