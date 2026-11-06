import { describe, expect, it } from 'vitest';
import { scenarioId, cardName } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { runsFrom, scenarioContext, setUpTable, type Run } from './run';

describe('the runs of a seed', () => {
  it('draws the same runs from the same seed', () => {
    expect(runsFrom(7, 3)).toEqual(runsFrom(7, 3));
  });

  it('seats one to three different real investigators in each run', () => {
    const runs = runsFrom(7, 20);

    expect(runs.map(({ seats }) => new Set(seats).size)).toEqual(
      runs.map(({ seats }) => seats.length),
    );
    expect(runs.every(({ seats }) => seats.length >= 1 && seats.length <= 3)).toBe(true);
  });
});

describe('setting up a run', () => {
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [cardName('Daisy Walker'), cardName('Roland Banks')],
    gameSeed: 24,
    botSeed: 1,
  };

  it('sets up its scenario with its investigators in seat order', () => {
    const table = setUpTable(run);

    expect(table.board.investigators.map(({ name }) => name)).toEqual([
      'Daisy Walker',
      'Roland Banks',
    ]);
    expect(table.board.act?.name).toBe('Trapped');
  });

  it('fails for a scenario the tester does not know', () => {
    expect(() => scenarioContext({ ...run, scenario: scenarioId('made-up') })).toThrow(
      'the play tester knows no scenario made-up',
    );
  });

  it('fails for an investigator the tester does not know', () => {
    expect(() => setUpTable({ ...run, seats: [cardName('Agnes Baker')] })).toThrow(
      'the play tester knows no investigator Agnes Baker',
    );
  });
});
