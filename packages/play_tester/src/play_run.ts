import { isDeepStrictEqual } from 'node:util';
import { range } from '@arkham/util';
import {
  CommandRejected,
  InvariantBroken,
  replay,
  TableError,
  type LoggedEvent,
  type PlayTable,
  type RejectionCode,
} from '@arkham/engine';
import { randomStep } from './random_bot';
import { refusalKind } from './refusals';
import { SeededRandom, setUpTable, type Run } from './run';
import { describeStep, playStep, type Step } from './steps';

/**
 * The checks a game is judged by (product.md "Continuous play tester"): `crash` an error other
 * than a refusal or a misused table, `refusal` a refusal marked `never`, `invariants` a state
 * `checkInvariants` rejects, `replay` an event log that no longer replays to the live state,
 * `determinism` a run whose second play logs other events than its first.
 */
export type CheckId = 'crash' | 'refusal' | 'invariants' | 'replay' | 'determinism';

/**
 * A failed check: which one, the step that failed it (`step` counts the played steps before it,
 * so it is the index the failing step would have had; none for `determinism`, which compares
 * whole games), the error or difference, and the board before that step.
 */
export interface Finding {
  readonly check: CheckId;
  readonly step: number;
  readonly attempted?: Step;
  readonly message: string;
  readonly boardBefore: string;
}

/** How a game ended: at a resolution, with every investigator out, or cut off at the step cap. */
export type GameEnd = 'resolution' | 'eliminated' | 'stepCap';

/**
 * One played run: the steps the table accepted, in order (they replay the game on a fresh table),
 * the event log they wrote, how and in which round it ended, its first finding (the game stops there) and the steps the
 * table refused or the bot misused, which are only counted.
 */
export interface RunResult {
  readonly run: Run;
  readonly steps: readonly Step[];
  readonly log: readonly LoggedEvent[];
  readonly end: GameEnd | 'finding';
  readonly rounds: number;
  readonly finding?: Finding;
  readonly refusals: Partial<Record<RejectionCode, number>>;
  readonly misuses: number;
}

/** How many steps a game may take before it is cut off; slice 2 adds a round cap. */
export const STEP_CAP = 2000;

/**
 * Plays `run` with the random bot until the game ends, a check fails or `stepCap` steps were
 * tried, checking after every step.
 */
export function playRun(run: Run, { stepCap = STEP_CAP } = {}): RunResult {
  const table = setUpTable(run);
  const random = new SeededRandom(run.botSeed);
  const steps: Step[] = [];
  const refusals: Partial<Record<RejectionCode, number>> = {};
  let misuses = 0;
  const result = (end: RunResult['end'], finding?: Finding): RunResult => ({
    run,
    steps,
    log: table.entries,
    end,
    rounds: table.board.round,
    ...(finding && { finding }),
    refusals,
    misuses,
  });
  for (let tried = 0; tried < stepCap; tried++) {
    const end = gameEnd(table);
    if (end) return result(end);
    const step = randomStep(table, random);
    const outcome = checkedStep(table, step);
    if (outcome.kind === 'played') steps.push(step);
    else if (outcome.kind === 'refused') refusals[outcome.code] = (refusals[outcome.code] ?? 0) + 1;
    else if (outcome.kind === 'misused') misuses++;
    else return result('finding', { ...outcome.failed, step: steps.length, attempted: step });
  }
  return result('stepCap');
}

/**
 * Plays `run` twice (`playRun`) and adds the `determinism` check: both plays must log the same
 * events in the same undo groups. Returns the first play, with the finding if any.
 */
export function checkRun(run: Run, options: { stepCap?: number } = {}): RunResult {
  const first = playRun(run, options);
  if (first.finding) return first;
  const second = playRun(run, options);
  const at = firstDifference(first.log, second.log);
  if (at === undefined) return first;
  return {
    ...first,
    end: 'finding',
    finding: {
      check: 'determinism',
      step: first.steps.length,
      message: `the second play of the run logs another event at ${at}: ${JSON.stringify(second.log[at])} instead of ${JSON.stringify(first.log[at])}`,
      boardBefore: setUpTable(run).formatted(),
    },
  };
}

/**
 * The index of the first entry where the two logs differ (one log ending early counts), or none
 * when they are equal.
 */
export function firstDifference(
  first: readonly LoggedEvent[],
  second: readonly LoggedEvent[],
): number | undefined {
  return range(Math.max(first.length, second.length)).find(
    (i) => !isDeepStrictEqual(first[i], second[i]),
  );
}

/** What one step did: played, refused as expected, misused the table, or failed a check. */
type StepOutcome =
  | { kind: 'played' }
  | { kind: 'refused'; code: RejectionCode }
  | { kind: 'misused' }
  | { kind: 'failed'; failed: Omit<Finding, 'step' | 'attempted'> };

/**
 * Plays `step` and judges it: a refusal by its kind (`refusalKind`), a broken invariant, a crash,
 * then the replay of the whole log against the live state. A `TableError` is the bot asking for
 * something the board lets it name but not do (a test that waits for attacks of opportunity, a
 * decision whose card has several), so it only counts.
 */
export function checkedStep(table: PlayTable, step: Step): StepOutcome {
  const boardBefore = table.formatted();
  const failed = (check: CheckId, message: string): StepOutcome => ({
    kind: 'failed',
    failed: { check, message, boardBefore },
  });
  try {
    playStep(table, step);
  } catch (error) {
    if (error instanceof CommandRejected) {
      const { code } = error.rejection;
      return refusalKind(code) === 'expected'
        ? { kind: 'refused', code }
        : failed('refusal', `${describeStep(step)} refused: ${error.message}`);
    }
    if (error instanceof InvariantBroken) return failed('invariants', error.message);
    if (error instanceof TableError) return { kind: 'misused' };
    return failed(
      'crash',
      `${describeStep(step)} threw: ${error instanceof Error ? error.stack : String(error)}`,
    );
  }
  if (!isDeepStrictEqual(replay(table.events), table.state))
    return failed(
      'replay',
      `after ${describeStep(step)} the event log no longer replays to the live state`,
    );
  return { kind: 'played' };
}

/** How the game on `table` has ended, if it has. */
function gameEnd(table: PlayTable): GameEnd | undefined {
  const { board } = table;
  if (board.investigators.every(({ status }) => status !== 'active')) return 'eliminated';
  if (board.ended) return 'resolution';
  return undefined;
}
