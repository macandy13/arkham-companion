import { describe, expect, it } from 'vitest';
import { cardName, instanceId } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import type { CheckId, RunResult } from './play_run';
import type { Run } from './run';
import { shrink } from './shrink';
import type { Step } from './steps';

describe('shrinking a failing game', () => {
  const roland = cardName('Roland Banks');
  const daisy = cardName('Daisy Walker');
  /** The Gathering for Roland Banks and Daisy Walker, Roland leading. */
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [roland, daisy],
    blanks: [],
    gameSeed: 24,
    bot: 'goal',
    botSeed: 1,
  };
  /** The Study as setup puts it in play: its card code, first copy. */
  const studyInPlay = instanceId('01111#1');
  /** An action the Study doesn't print, which the table refuses as it should never be offered. */
  const unprintedAction: Step = {
    verb: 'useCardAction',
    investigator: roland,
    card: studyInPlay,
    action: 5,
  };
  /** Round 1 up to Daisy's turn: each takes a resource, Roland ends his turn. */
  const toDaisysTurn: readonly Step[] = [
    { verb: 'nextPhase' },
    { verb: 'startTurn', investigator: roland },
    { verb: 'takeResource', investigator: roland },
    { verb: 'endTurn', investigator: roland },
    { verb: 'startTurn', investigator: daisy },
    { verb: 'takeResource', investigator: daisy },
  ];

  /** The game `steps` play, failing `check` at `attempted` after them. */
  const failing = (steps: readonly Step[], check: CheckId, attempted?: Step): RunResult => ({
    run,
    steps,
    log: [],
    end: 'finding',
    rounds: 1,
    finding: {
      check,
      step: steps.length,
      ...(attempted && { attempted }),
      message: 'recorded',
      boardBefore: 'recorded',
    },
    refusals: {},
    misuses: 0,
  });

  it('drops every step and investigator a refusal does not need', () => {
    const shrunk = shrink(failing(toDaisysTurn, 'refusal', unprintedAction));

    expect(shrunk.run.seats).toEqual([roland]);
    expect(shrunk.steps).toEqual([]);
    expect(shrunk.finding).toMatchObject({ check: 'refusal', step: 0, attempted: unprintedAction });
  });

  it('keeps a game whose shorter versions do not fail', () => {
    const result = failing(toDaisysTurn, 'refusal', { verb: 'endTurn', investigator: daisy });

    expect(shrink(result)).toBe(result);
  });

  it('keeps a game when it may try no shorter one', () => {
    const result = failing(toDaisysTurn, 'refusal', unprintedAction);

    expect(shrink(result, 0)).toBe(result);
  });

  it('keeps a finding that compares whole games', () => {
    const result = failing(toDaisysTurn, 'determinism');

    expect(shrink(result)).toBe(result);
  });
});
