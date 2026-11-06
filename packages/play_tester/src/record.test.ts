import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { playRun, type Finding, type RunResult } from './play_run';
import {
  loggedBoard,
  parseRecord,
  recordFileName,
  recordOf,
  replaySteps,
  serialiseRecord,
  type RunRecord,
} from './record';
import { setUpTable, type Run } from './run';
import type { Step } from './steps';

const run: Run = {
  scenario: theGathering.id,
  difficulty: 'standard',
  seats: [cardName('Roland Banks')],
  gameSeed: 24,
  botSeed: 1,
};
const tester = { version: '0.0.0', commit: 'abc123' };
// No bot offers a verb the table lacks; this one stands in for a step that crashes the engine.
const crashing = { verb: 'dance' } as unknown as Step;
const crashAtStart: Finding = {
  check: 'crash',
  step: 0,
  attempted: crashing,
  message: 'dance() threw',
  boardBefore: 'Round 0, setup phase',
};

/** A record of `run` whose finding is `finding`, after `steps`, with the log of the start only. */
function recordWith(finding: Finding, steps: readonly Step[]): RunRecord {
  return {
    format: 'arkham-run',
    version: 1,
    tester,
    run,
    finding,
    steps,
    log: setUpTable(run).entries,
  };
}

describe('recording a failing game', () => {
  it('records the run, its finding, its steps and its log', () => {
    const failing: RunResult = {
      ...playRun(run, { stepCap: 0 }),
      end: 'finding',
      finding: crashAtStart,
    };

    expect(recordOf(failing, tester)).toMatchObject({
      format: 'arkham-run',
      tester,
      run,
      finding: crashAtStart,
      steps: [],
    });
  });

  it('records no passing game', () => {
    expect(() => recordOf(playRun(run, { stepCap: 0 }), tester)).toThrow(
      'only a failing game is recorded',
    );
  });

  it('reads back the record it writes', () => {
    const record = recordWith(crashAtStart, [{ verb: 'nextPhase' }]);

    expect(parseRecord(serialiseRecord(record))).toEqual(record);
  });

  it.each([
    { text: '{"format":"arkham-game"}', error: 'not a play tester record' },
    { text: '[]', error: 'not a play tester record' },
    { text: '{"format":"arkham-run","version":2}', error: 'record of another version' },
  ])('refuses $text', ({ text, error }) => {
    expect(() => parseRecord(text)).toThrow(error);
  });

  it('names the file after the check and the seeds', () => {
    expect(recordFileName({ run, finding: crashAtStart })).toBe('crash-24-1.arkham-run.json');
  });
});

describe('replaying a record', () => {
  it('reproduces the recorded check at the recorded step', () => {
    const record = recordWith({ ...crashAtStart, step: 1 }, [{ verb: 'nextPhase' }]);

    expect(replaySteps(record)).toMatchObject({
      reproduced: true,
      finding: { check: 'crash', step: 1, attempted: crashing },
    });
  });

  it('reports a failure that now comes at an earlier step', () => {
    const record = recordWith({ ...crashAtStart, step: 1, attempted: { verb: 'nextPhase' } }, [
      crashing,
    ]);

    expect(replaySteps(record)).toMatchObject({
      reproduced: false,
      finding: { check: 'crash', step: 0 },
    });
  });

  it('plays through when the failing step no longer fails', () => {
    const record = recordWith({ ...crashAtStart, attempted: { verb: 'nextPhase' } }, []);

    expect(replaySteps(record)).toEqual({ reproduced: false });
  });

  it('shows the board its event log replays to', () => {
    const record = recordWith(crashAtStart, []);

    expect(loggedBoard(record)).toBe(setUpTable(run).formatted());
  });
});
