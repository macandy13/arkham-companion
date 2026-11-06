import { formatBoard, replay, type LoggedEvent } from '@arkham/engine';
import { checkedStep, checkRun, type Finding, type RunResult } from './play_run';
import { scenarioContext, setUpTable, type Run } from './run';
import type { Step } from './steps';

/** The file name ending of a record, so the nightly run and a session find them. */
export const RECORD_SUFFIX = '.arkham-run.json';

/** The layout version of `RunRecord`; a record of another version is refused, not misread. */
const RECORD_VERSION = 1;

/**
 * Which tester wrote a record: the package version and the git commit it ran on, so a replay on a
 * newer engine can say how far apart the two are.
 */
export interface TesterVersion {
  readonly version: string;
  readonly commit: string;
}

/**
 * A failing game as a file (`*.arkham-run.json`, product.md "Recording and replay"): the run, the
 * finding with its step and boards, the steps the table accepted before it (the finding's
 * `attempted` step is the one that failed), and the event log in the order the table wrote it.
 * Only failing games are recorded; a passing one replays from its run.
 */
export interface RunRecord {
  readonly format: 'arkham-run';
  readonly version: typeof RECORD_VERSION;
  readonly tester: TesterVersion;
  readonly run: Run;
  readonly finding: Finding;
  readonly steps: readonly Step[];
  readonly log: readonly LoggedEvent[];
}

/** The record of a failing `result`; fails for a passing one, which needs none. */
export function recordOf(result: RunResult, tester: TesterVersion): RunRecord {
  const { run, finding, steps, log } = result;
  if (!finding) throw new Error('only a failing game is recorded');
  return { format: 'arkham-run', version: RECORD_VERSION, tester, run, finding, steps, log };
}

/** `record` as the text of its file, indented so a reader can follow the steps. */
export function serialiseRecord(record: RunRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

/**
 * The record in `text`. Checks the format and version only: a record is written by the tester and
 * read back by it, so a deeper schema would only repeat the types.
 */
export function parseRecord(text: string): RunRecord {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || !('format' in parsed))
    throw new Error('not a play tester record');
  if (parsed.format !== 'arkham-run') throw new Error('not a play tester record');
  if (!('version' in parsed) || parsed.version !== RECORD_VERSION)
    throw new Error(`play tester record of another version, this tester reads ${RECORD_VERSION}`);
  return parsed as RunRecord;
}

/**
 * What replaying a record's steps on a fresh table does now: the finding it meets (at the
 * recorded step or earlier), or none when the engine no longer fails there. `reproduced` says
 * whether it is the recorded check at the recorded step.
 */
export interface StepReplay {
  readonly finding?: Finding;
  readonly reproduced: boolean;
}

/**
 * Replays `record`'s steps through a fresh `PlayTable` on today's engine, judging each like the
 * live game, and stops at its failing step: it shows what the engine does now. A `determinism`
 * finding compares two whole games, so its run is played twice again instead.
 */
export function replaySteps(record: RunRecord): StepReplay {
  const { run, steps, finding: recorded } = record;
  if (recorded.check === 'determinism') {
    const { finding } = checkRun(run);
    return { ...(finding && { finding }), reproduced: finding?.check === 'determinism' };
  }
  const table = setUpTable(run);
  const attempts: readonly Step[] = recorded.attempted ? [...steps, recorded.attempted] : steps;
  for (const [index, step] of attempts.entries()) {
    const outcome = checkedStep(table, step);
    if (outcome.kind !== 'failed') continue;
    const finding: Finding = { ...outcome.failed, step: index, attempted: step };
    return {
      finding,
      reproduced: finding.check === recorded.check && finding.step === recorded.step,
    };
  }
  return { reproduced: false };
}

/** The board the record's event log replays to: what happened then, whatever the engine does now. */
export function loggedBoard(record: RunRecord): string {
  return formatBoard(scenarioContext(record.run), replay(record.log.map(({ event }) => event)));
}

/** A record's file name: the check, the run's two seeds, the ending; unique per failing run. */
export function recordFileName({ run, finding }: Pick<RunRecord, 'run' | 'finding'>): string {
  return `${finding.check}-${run.gameSeed}-${run.botSeed}${RECORD_SUFFIX}`;
}
