import { describe, expect, it } from 'vitest';
import { cardName, instanceId } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import type { RunRecord } from './record';
import { findingReport, gameExportPath, reportPath } from './report';

describe('the report of a finding', () => {
  const roland = cardName('Roland Banks');
  /** A recorded refusal after Roland's first resource, with the boards around it. */
  const record: RunRecord = {
    format: 'arkham-run',
    version: 3,
    tester: { version: '0.0.0', commit: 'abc123' },
    run: {
      scenario: theGathering.id,
      difficulty: 'standard',
      seats: [roland],
      blanks: [],
      gameSeed: 24,
      bot: 'goal',
      botSeed: 1,
    },
    finding: {
      check: 'refusal',
      step: 1,
      attempted: {
        verb: 'useCardAction',
        investigator: roland,
        card: instanceId('study'),
        action: 5,
      },
      message: 'useCardAction refused: no action 5\nmore detail',
      boardBefore: 'Round 1, investigation phase',
    },
    steps: [{ verb: 'takeResource', investigator: roland }],
    log: [],
  };
  const path = '.runs/refusal-goal-24-1.arkham-run.json';

  it('names the check, the run, the steps with the failing one last and the board', () => {
    expect(findingReport(record, path)).toBe(
      [
        '## refusal at step 1: useCardAction refused: no action 5',
        '',
        '- Run: the-gathering, standard, seats Roland Banks; game seed 24, goal bot, bot seed 1',
        '- Tester: 0.0.0 at abc123',
        '- Replay: `pnpm playtest --replay .runs/refusal-goal-24-1.arkham-run.json`; open `.runs/refusal-goal-24-1.arkham-game.json` in the app with "Import game"',
        '',
        '### Steps (2)',
        '',
        '```',
        'takeResource("Roland Banks")',
        'useCardAction("Roland Banks", "study", 5)',
        '```',
        '',
        '### What failed',
        '',
        '```',
        'useCardAction refused: no action 5\nmore detail',
        '```',
        '',
        '### Board before the failing step',
        '',
        '```',
        'Round 1, investigation phase',
        '```',
        '',
      ].join('\n'),
    );
  });

  it('adds the board after the step when the step changed it', () => {
    const changed = {
      ...record,
      finding: { ...record.finding, boardAfter: 'Round 1, enemy phase' },
    };

    expect(findingReport(changed, path)).toContain(
      '### Board after it\n\n```\nRound 1, enemy phase\n```\n',
    );
  });

  it('puts the app export and the report beside the record', () => {
    expect([gameExportPath(path), reportPath(path)]).toEqual([
      '.runs/refusal-goal-24-1.arkham-game.json',
      '.runs/refusal-goal-24-1.md',
    ]);
  });
});
