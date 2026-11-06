import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import type { RunResult } from './play_run';
import type { Run } from './run';
import { formatSummary, summarise } from './summary';

const run: Run = {
  scenario: theGathering.id,
  difficulty: 'standard',
  seats: [cardName('Roland Banks')],
  gameSeed: 24,
  botSeed: 1,
};

describe('summing up runs', () => {
  const eliminated: RunResult = {
    run,
    steps: [{ verb: 'nextPhase' }, { verb: 'nextPhase' }],
    log: [],
    end: 'eliminated',
    rounds: 3,
    refusals: { notConnected: 2, decisionPending: 1 },
    misuses: 1,
  };
  const crashed: RunResult = {
    run,
    steps: [{ verb: 'nextPhase' }],
    log: [],
    end: 'finding',
    rounds: 1,
    finding: { check: 'crash', step: 1, message: 'threw', boardBefore: 'Round 1' },
    refusals: { notConnected: 1 },
    misuses: 0,
  };

  it('counts games, ends, findings, steps, refusals and misuses', () => {
    expect(summarise([eliminated, crashed])).toEqual({
      games: 2,
      ends: { eliminated: 1, finding: 1 },
      findings: { crash: 1 },
      steps: 3,
      refusals: { notConnected: 3, decisionPending: 1 },
      misuses: 1,
    });
  });

  it('prints the counts, most first', () => {
    expect(formatSummary(summarise([eliminated, crashed]))).toBe(
      [
        'Games: 2, steps played: 3',
        'Ends: eliminated 1, finding 1',
        'Findings: crash 1',
        'Expected refusals: 4 (notConnected 3, decisionPending 1); misused steps: 1',
      ].join('\n'),
    );
  });

  it('prints none for no games', () => {
    expect(formatSummary(summarise([]))).toBe(
      [
        'Games: 0, steps played: 0',
        'Ends: none',
        'Findings: none',
        'Expected refusals: 0 (none); misused steps: 0',
      ].join('\n'),
    );
  });
});
