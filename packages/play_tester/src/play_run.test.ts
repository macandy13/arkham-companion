import { describe, expect, it } from 'vitest';
import {
  type LoggedEvent,
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  cardName,
} from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { checkedStep, checkRun, firstDifference, playRun } from './play_run';
import type { Run } from './run';
import type { Step } from './steps';

const alice = investigatorId('alice');
const roundEnded: LoggedEvent = { commandId: 'command-0', event: { type: 'RoundEnded', round: 1 } };
const turnStarted: LoggedEvent = {
  commandId: 'command-1',
  event: { type: 'TurnStarted', investigatorId: alice },
};
const study = instanceId('study');
const attic = instanceId('attic');

describe('judging one step', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withLocation(attic, blankLocation('attic'), { revealed: true })
    .withInvestigator(alice, { locationId: study })
    .withTurnOf(alice);

  it('plays a step the table accepts and whose log replays', () => {
    const table = PlayTable.start(game);

    expect(checkedStep(table, { verb: 'investigate', investigator: cardName('alice') })).toEqual({
      kind: 'played',
    });
  });

  it('counts a refusal players could meet at the table', () => {
    const table = PlayTable.start(game);

    expect(
      checkedStep(table, {
        verb: 'moveTo',
        investigator: cardName('alice'),
        location: cardName('attic'),
      }),
    ).toEqual({
      kind: 'refused',
      code: 'notConnected',
    });
  });

  it('counts a step the table cannot name as a misuse', () => {
    const table = PlayTable.start(game);

    expect(checkedStep(table, { verb: 'answer', option: 'pass' })).toEqual({ kind: 'misused' });
  });

  it('fails the refusal check for a refusal that should never happen', () => {
    const table = PlayTable.start(game);

    const outcome = checkedStep(table, {
      verb: 'useCardAction',
      investigator: cardName('alice'),
      card: study,
      action: 5,
    });

    expect(outcome).toMatchObject({ kind: 'failed', failed: { check: 'refusal' } });
  });

  it('fails the crash check for any other error, with the board before the step', () => {
    const table = PlayTable.start(game);
    // No bot offers a verb the table lacks; this one stands in for a bug that throws.
    const broken = { verb: 'dance' } as unknown as Step;

    expect(checkedStep(table, broken)).toMatchObject({
      kind: 'failed',
      failed: { check: 'crash', boardBefore: table.formatted() },
    });
  });
});

describe('playing a run', () => {
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [cardName('Roland Banks')],
    gameSeed: 24,
    botSeed: 1,
  };

  it('plays until the step cap with no finding, and logs what its steps replay', () => {
    const result = playRun(run, { stepCap: 40 });

    expect(result).toMatchObject({ end: 'stepCap', run });
    expect(result.finding).toBeUndefined();
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('plays a game to its end: with bot seed 1, Roland is defeated in round 2', () => {
    expect(playRun(run)).toMatchObject({ end: 'eliminated', rounds: 2 });
  });

  it('plays the same game twice, so the determinism check passes', () => {
    expect(checkRun(run, { stepCap: 40 }).finding).toBeUndefined();
  });
});

describe('comparing the logs of two plays', () => {
  it.each([
    {
      case: 'equal logs',
      first: [roundEnded, turnStarted],
      second: [roundEnded, turnStarted],
      at: undefined,
    },
    {
      case: 'another second event',
      first: [roundEnded, turnStarted],
      second: [roundEnded, roundEnded],
      at: 1,
    },
    {
      case: 'a second log ending early',
      first: [roundEnded, turnStarted],
      second: [roundEnded],
      at: 1,
    },
    {
      case: 'a second log going on',
      first: [roundEnded],
      second: [roundEnded, turnStarted],
      at: 1,
    },
  ])('finds the first difference in $case', ({ first, second, at }) => {
    expect(firstDifference(first, second)).toBe(at);
  });
});
