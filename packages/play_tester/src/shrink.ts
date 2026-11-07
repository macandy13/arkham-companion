import { attempts, checkedStep, type Finding, type RunResult } from './play_run';
import { setUpTable, type Run } from './run';
import type { Step } from './steps';

/**
 * How many shorter games `shrink` may try for one finding, a bound on the tester's own time: each
 * try plays its game again from the start, every step judged.
 */
export const SHRINK_TRIES = 400;

/**
 * `result` cut down to a shorter game that still fails alike, the same check at the same kind of step
 * (`sameFailure`, the signature the nightly run files issues by) (product.md "Recording and
 * replay", Shrinking): first without an investigator who isn't needed (the lead stays, as setup
 * needs one), then without ever smaller chunks of steps, as long as each try still fails. A
 * try plays its steps from the start, judging each (`checkedStep`); a step the shorter game no
 * longer allows is left out, and the game ends at its first finding. A finding that compares
 * whole games (`determinism`, `resume`) or no single step (a game past the round cap) is kept as
 * it is. Returns `result` itself when nothing shorter fails alike.
 */
export function shrink(result: RunResult, tries = SHRINK_TRIES): RunResult {
  const { finding } = result;
  if (finding?.attempted === undefined) return result;
  const budget = { left: tries };
  let best = result;
  for (const seat of result.run.seats.slice(1)) {
    if (budget.left <= 0) return best;
    const fewer = failsAlike(
      withoutSeat(best.run, seat),
      withoutInvestigator(best, seat),
      finding,
      budget,
    );
    if (fewer) best = fewer;
  }
  for (
    let chunk = Math.ceil(attempts(best).length / 2);
    chunk >= 1;
    chunk = Math.floor(chunk / 2)
  ) {
    for (let start = 0; start < attempts(best).length - 1;) {
      if (budget.left <= 0) return best;
      const steps = attempts(best);
      // The failing step itself stays last; only the steps before it are dropped.
      const end = Math.min(start + chunk, steps.length - 1);
      const shorter = failsAlike(
        best.run,
        [...steps.slice(0, start), ...steps.slice(end)],
        finding,
        budget,
      );
      if (shorter) best = shorter;
      else start = end;
    }
  }
  return best;
}

/** `run` without the investigator in `seat`, a blank one's card included. */
function withoutSeat(run: Run, seat: Run['seats'][number]): Run {
  return {
    ...run,
    seats: run.seats.filter((name) => name !== seat),
    blanks: run.blanks.filter(({ name }) => name !== seat),
  };
}

/** The steps of `result` without those the investigator in `seat` takes. */
function withoutInvestigator(result: RunResult, seat: Run['seats'][number]): readonly Step[] {
  return attempts(result).filter((step) => !('investigator' in step) || step.investigator !== seat);
}

/**
 * The game `steps` of `run` play, if it fails like `failing`: the steps the table took, the event log and
 * the finding at the step that failed. Steps the table refuses or can't name are left out, as the
 * shorter game may no longer allow them. Counts one try off `budget`.
 */
function failsAlike(
  run: Run,
  steps: readonly Step[],
  failing: Finding,
  budget: { left: number },
): RunResult | undefined {
  budget.left--;
  const table = setUpTable(run);
  const played: Step[] = [];
  for (const step of steps) {
    const outcome = checkedStep(table, step);
    if (outcome.kind === 'played') played.push(step);
    if (outcome.kind !== 'failed') continue;
    if (!sameFailure(failing, outcome.failed.check, step)) return undefined;
    return {
      run,
      steps: played,
      log: table.entries,
      end: 'finding',
      rounds: table.board.round,
      finding: { ...outcome.failed, step: played.length, attempted: step },
      refusals: {},
      misuses: 0,
    };
  }
  return undefined;
}

/**
 * Whether failing `check` at `step` is the failure `failing` records: the same check at the same
 * verb. A shorter game may well break elsewhere first; that is another bug, not this one shrunk.
 */
function sameFailure(failing: Finding, check: Finding['check'], step: Step): boolean {
  return failing.check === check && failing.attempted?.verb === step.verb;
}
