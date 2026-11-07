import { describe, expect, it } from 'vitest';
import { cardName, instanceId } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { playRun, type RunResult } from './play_run';
import type { Run } from './run';
import { shrink } from './shrink';
import type { Step } from './steps';

describe('shrinking a failing game', () => {
  /** A goal bot game of The Gathering for Roland Banks and Daisy Walker, Roland leading. */
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [cardName('Roland Banks'), cardName('Daisy Walker')],
    blanks: [],
    gameSeed: 24,
    bot: 'goal',
    botSeed: 1,
  };
  /** An action the Study doesn't print, which the table refuses as it should never be offered. */
  const unprintedAction: Step = {
    verb: 'useCardAction',
    investigator: cardName('Roland Banks'),
    card: instanceId('01111#1'),
    action: 5,
  };

  /** The first 30 steps of `run`, then `attempted` failing `check`. */
  const failingAfter30Steps = (attempted: Step): RunResult => {
    const played = playRun(run, { stepCap: 30 });
    return {
      ...played,
      end: 'finding',
      finding: {
        check: 'refusal',
        step: played.steps.length,
        attempted,
        message: 'recorded',
        boardBefore: 'recorded',
      },
    };
  };

  it('drops every step and investigator a refusal does not need', () => {
    const shrunk = shrink(failingAfter30Steps(unprintedAction));

    expect(shrunk.run.seats).toEqual([cardName('Roland Banks')]);
    expect(shrunk.steps).toEqual([]);
    expect(shrunk.finding).toMatchObject({ check: 'refusal', step: 0, attempted: unprintedAction });
  });

  it('keeps a game whose shorter versions fail otherwise or not at all', () => {
    const passing = { verb: 'nextPhase' } as const;
    const result = failingAfter30Steps(passing);

    expect(shrink(result)).toBe(result);
  });

  it('keeps a finding that compares whole games', () => {
    const played = playRun(run, { stepCap: 30 });
    const result: RunResult = {
      ...played,
      end: 'finding',
      finding: { check: 'determinism', step: 30, message: 'recorded', boardBefore: 'recorded' },
    };

    expect(shrink(result)).toBe(result);
  });
});
