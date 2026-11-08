import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { findingSignature, nightlyFindings, nightlySummary } from './nightly';
import type { CheckId } from './play_run';
import type { RunRecord } from './record';
import type { Step } from './steps';

describe('the signature a finding is filed under', () => {
  const roland = cardName('Roland Banks');

  const cases: { check: CheckId; attempted?: Step; signature: string }[] = [
    {
      check: 'refusal',
      attempted: { verb: 'takeResource', investigator: roland },
      signature: 'refusal at takeResource',
    },
    {
      check: 'invariants',
      attempted: { verb: 'nextPhase' },
      signature: 'invariants at nextPhase',
    },
    { check: 'determinism', signature: 'determinism at the whole game' },
  ];

  it.each(cases)('$check at $attempted.verb is "$signature"', ({ check, attempted, signature }) => {
    expect(findingSignature({ check, ...(attempted && { attempted }) })).toBe(signature);
  });
});

describe("a night's findings", () => {
  const roland = cardName('Roland Banks');
  const takeResource: Step = { verb: 'takeResource', investigator: roland };

  /** A goal bot record of The Gathering for Roland that fails `check` at nextPhase after `steps`. */
  function recordFailingAtNextPhase(check: CheckId, gameSeed: number, steps: readonly Step[]) {
    const record: RunRecord = {
      format: 'arkham-run',
      version: 3,
      tester: { version: '0.0.0', commit: 'abc123' },
      run: {
        scenario: theGathering.id,
        difficulty: 'standard',
        seats: [roland],
        blanks: [],
        gameSeed,
        bot: 'goal',
        botSeed: 1,
      },
      finding: {
        check,
        step: steps.length,
        attempted: { verb: 'nextPhase' },
        message: `${check} broken`,
        boardBefore: 'Round 1',
      },
      steps,
      log: [],
    };
    return record;
  }

  const findings = nightlyFindings([
    {
      record: recordFailingAtNextPhase('invariants', 1, [takeResource, takeResource]),
      report: 'invariants-goal-1-1.md',
    },
    { record: recordFailingAtNextPhase('liveness', 2, []), report: 'liveness-goal-2-1.md' },
    {
      record: recordFailingAtNextPhase('invariants', 3, [takeResource]),
      report: 'invariants-goal-3-1.md',
    },
  ]);

  it('are one per signature, most games first, each with the report of its shortest game', () => {
    expect(findings).toEqual([
      { signature: 'invariants at nextPhase', games: 2, report: 'invariants-goal-3-1.md' },
      { signature: 'liveness at nextPhase', games: 1, report: 'liveness-goal-2-1.md' },
    ]);
  });

  it('make the job summary with the counts, the bugs that came back and a row each', () => {
    const summary = {
      games: 3,
      ends: { goal: { finding: 3 } },
      findings: { invariants: 2, liveness: 1 },
      steps: 3,
      refusals: {},
      misuses: 0,
    };

    expect(nightlySummary(20261108, summary, findings, ['liveness-goal-2-1.arkham-run.json'])).toBe(
      [
        '### Play tester, seed 20261108',
        '',
        '- Games: 3, steps played: 3',
        '- Ends: goal: finding 3',
        '- Findings: invariants 2, liveness 1',
        '- Expected refusals: 0 (none); misused steps: 0',
        '- Fixed bugs that came back: liveness-goal-2-1.arkham-run.json',
        '',
        '| Finding | Games | Report |',
        '| --- | --- | --- |',
        '| invariants at nextPhase | 2 | invariants-goal-3-1.md |',
        '| liveness at nextPhase | 1 | liveness-goal-2-1.md |',
      ].join('\n'),
    );
  });
});
