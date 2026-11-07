import { isDeepStrictEqual } from 'node:util';
import { addCount, firstDifference } from '@arkham/util';
import {
  CommandRejected,
  InvariantBroken,
  PlayTable,
  replay,
  TableError,
  type GameState,
  type LoggedEvent,
  type RejectionCode,
} from '@arkham/engine';
import { botStep } from './bots';
import { brokenRule } from './oracles';
import { refusalKind } from './refusals';
import { SeededRandom, setUpTable, type Run } from './run';
import { describeStep, playStep, type Step } from './steps';

/**
 * The checks a game is judged by (product.md "Continuous play tester"): `crash` an error other
 * than a refusal or a misused table, `refusal` a refusal marked `never`, `invariants` a state
 * `checkInvariants` rejects, `rules` a step that breaks a rule an oracle checks (`brokenRule`),
 * `replay` an event log that no longer replays to the live state, `undo` a step that undo right
 * after it does not take back exactly, `determinism` a run whose second play logs other events
 * than its first, `resume` a run that logs other events when resumed from its log partway, and
 * `liveness` a game that gets stuck: an offered answer refused, a "Next" that changes nothing, a
 * game past the round cap.
 */
export type CheckId =
  | 'crash'
  | 'refusal'
  | 'invariants'
  | 'rules'
  | 'replay'
  | 'undo'
  | 'determinism'
  | 'resume'
  | 'liveness';

/**
 * A failed check: which one, the step that failed it (`step` counts the played steps before it,
 * so it is the index the failing step would have had; for `determinism` and `resume`, which compare whole
 * games, all the steps of the first play), the error or difference, the board before that step and,
 * when the step left it changed (a log that no longer replays), the board after it; a refused or
 * broken step leaves the table as it was.
 */
export interface Finding {
  readonly check: CheckId;
  readonly step: number;
  readonly attempted?: Step;
  readonly message: string;
  readonly boardBefore: string;
  readonly boardAfter?: string;
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

/** How many steps a game may take before it is cut off, a bound on the tester's own time. */
export const STEP_CAP = 5000;

/**
 * The round a game must have ended by. The Gathering's agendas run out after about 15 rounds of
 * doom; a game still going at twice that is stuck, so it is a `liveness` finding.
 */
export const ROUND_CAP = 30;

/**
 * Plays `run` with its bot until the game ends, a check fails (round `roundCap` passing
 * is one) or `stepCap` steps were tried, checking after every step.
 */
export function playRun(run: Run, { stepCap = STEP_CAP, roundCap = ROUND_CAP } = {}): RunResult {
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
    if (table.board.round > roundCap)
      return result('finding', {
        check: 'liveness',
        step: steps.length,
        message: `the game is still going in round ${table.board.round}, past the cap of ${roundCap}`,
        boardBefore: table.formatted(),
      });
    const step = botStep(run.bot, table, random);
    const outcome = checkedStep(table, step);
    if (outcome.kind === 'played') steps.push(step);
    else if (outcome.kind === 'refused') addCount(refusals, outcome.code);
    else if (outcome.kind === 'misused') misuses++;
    else return result('finding', { ...outcome.failed, step: steps.length, attempted: step });
  }
  return result('stepCap');
}

/**
 * Plays `run` twice (`playRun`) and adds the whole-game checks: both plays must log the same
 * events in the same undo groups (`determinism`), and so must a table resumed from the log
 * partway (`resumeDifference`). Returns the first play, with the finding if any.
 */
export function checkRun(
  run: Run,
  options: { stepCap?: number; roundCap?: number } = {},
): RunResult {
  const first = playRun(run, options);
  if (first.finding) return first;
  const second = playRun(run, options);
  const at = firstDifference(first.log, second.log, isDeepStrictEqual);
  const failed = (check: CheckId, message: string): RunResult => ({
    ...first,
    end: 'finding',
    finding: { check, step: first.steps.length, message, boardBefore: setUpTable(run).formatted() },
  });
  if (at !== undefined)
    return failed(
      'determinism',
      `the second play of the run logs another event at ${at}: ${JSON.stringify(second.log[at])} instead of ${JSON.stringify(first.log[at])}`,
    );
  const resumed = resumeDifference(first);
  return resumed === undefined ? first : failed('resume', resumed);
}

/**
 * Replays the steps of `played` up to `resumeAt` (by default one its run's seeds pick), resumes a new table from that
 * log (`PlayTable.resume`, as the app does with a saved game) and plays the rest there. What
 * differs from the straight play, or `undefined`. One resume point per run keeps a run's cost
 * linear; across a night's runs it lands on every kind of step.
 */
export function resumeDifference(
  played: RunResult,
  resumeAt = new SeededRandom(played.run.gameSeed ^ played.run.botSeed).between(
    0,
    played.steps.length,
  ),
): string | undefined {
  const { run, steps, log } = played;
  const before = setUpTable(run);
  steps.slice(0, resumeAt).forEach((step) => playStep(before, step));
  const table = PlayTable.resume(before.ctx, before.entries);
  try {
    steps.slice(resumeAt).forEach((step) => playStep(table, step));
  } catch (error) {
    return `resumed at step ${resumeAt}, the game refused a step it played straight through: ${error instanceof Error ? error.message : String(error)}`;
  }
  return logDifference(`resumed at step ${resumeAt}, the game`, log, table.entries);
}

/**
 * Where `actual` (what `who` logged) first differs from `expected`, by event and by the place of
 * its undo group (`numberedGroups`), or `undefined`. Shared by the resume check and the web
 * replay (`apps/web/src/playtest/`).
 */
export function logDifference(
  who: string,
  expected: readonly LoggedEvent[],
  actual: readonly LoggedEvent[],
): string | undefined {
  const want = numberedGroups(expected);
  const got = numberedGroups(actual);
  const at = firstDifference(want, got, isDeepStrictEqual);
  return at === undefined
    ? undefined
    : `${who} logs another event at ${at}: ${JSON.stringify(got[at])} instead of ${JSON.stringify(want[at])}`;
}

/**
 * `log` with each group id replaced by the group's place in it. A resumed table numbers its
 * groups on from the log, while the straight play also counted groups an undo took back, so the
 * ids differ though the events and their grouping are the same.
 */
function numberedGroups(
  log: readonly LoggedEvent[],
): { group: number; event: LoggedEvent['event'] }[] {
  const groups = new Map<string, number>();
  return log.map(({ commandId, event }) => {
    if (!groups.has(commandId)) groups.set(commandId, groups.size);
    return { group: groups.get(commandId) ?? 0, event };
  });
}

/** What one step did: played, refused as expected, misused the table, or failed a check. */
type StepOutcome =
  | { kind: 'played' }
  | { kind: 'refused'; code: RejectionCode }
  | { kind: 'misused' }
  | { kind: 'failed'; failed: Omit<Finding, 'step' | 'attempted'> };

/**
 * Plays `step` and judges it: a refused answer the board offered, a refusal by its kind
 * (`refusalKind`), a broken invariant, a crash, a "Next" that changed nothing, a rule an oracle
 * checks (`brokenRule`), the replay of the whole log against the live state, then undo right
 * after the step (`undoesTo`). A `TableError` is the bot asking for
 * something the board lets it name but not do (a test that waits for attacks of opportunity, a
 * decision whose card has several), so it only counts.
 */
export function checkedStep(table: PlayTable, step: Step): StepOutcome {
  const boardBefore = table.formatted();
  const stateBefore = table.state;
  const viewBefore = table.board;
  const failed = (check: CheckId, message: string): StepOutcome => {
    const boardAfter = table.formatted();
    return {
      kind: 'failed',
      failed: { check, message, boardBefore, ...(boardAfter !== boardBefore && { boardAfter }) },
    };
  };
  const logged = table.events.length;
  try {
    playStep(table, step);
  } catch (error) {
    if (error instanceof CommandRejected) {
      const { code } = error.rejection;
      if (step.verb === 'answer' || step.verb === 'resolveTest')
        return failed(
          'liveness',
          `the offered answer ${describeStep(step)} was refused: ${error.message}`,
        );
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
  if (step.verb === 'nextPhase' && table.events.length === logged)
    return failed('liveness', '"Next" was accepted but changed nothing');
  const broken = brokenRule(viewBefore, table.board, step);
  if (broken)
    return failed(
      'rules',
      `${describeStep(step)} broke ${broken.oracle.id} (docs/rules/${broken.oracle.rules}): ${broken.message}`,
    );
  if (!isDeepStrictEqual(replay(table.events), table.state))
    return failed(
      'replay',
      `after ${describeStep(step)} the event log no longer replays to the live state`,
    );
  // Undo after an undo would take back an older step, not this one; a step that logged nothing
  // has nothing to take back.
  if (step.verb !== 'undo' && table.events.length > logged && !undoesTo(table, stateBefore))
    return failed(
      'undo',
      `undo right after ${describeStep(step)} does not give back the state before it`,
    );
  return { kind: 'played' };
}

/**
 * Whether undo right after the last step gives back `before`. It undoes on a table resumed from
 * the log, so the game goes on from the step it played. Only its passing side has a test: an
 * engine whose undo misses a step cannot be built for one.
 */
function undoesTo(table: PlayTable, before: GameState): boolean {
  const copy = PlayTable.resume(table.ctx, table.entries);
  copy.undo();
  return isDeepStrictEqual(copy.state, before);
}

/** How the game on `table` has ended, if it has. */
function gameEnd(table: PlayTable): GameEnd | undefined {
  const { board } = table;
  if (board.investigators.every(({ status }) => status !== 'active')) return 'eliminated';
  if (board.ended) return 'resolution';
  return undefined;
}
