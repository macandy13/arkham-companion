import { describe, expect, it } from 'vitest';
import { scenarioId, cardName } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { runsFrom, scenarioContext, SeededRandom, setUpTable, type Run } from './run';

describe('the runs of a seed', () => {
  it('plays only the bots asked for', () => {
    expect(new Set(runsFrom(7, 10, ['goal']).map(({ bot }) => bot))).toEqual(new Set(['goal']));
  });

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

describe('picking by weight', () => {
  /** How often each index is picked in 1000 picks of `weights`. */
  const picks = (weights: number[]) => {
    const random = new SeededRandom(7);
    const counts = weights.map(() => 0);
    for (let i = 0; i < 1000; i++) counts[random.pickWeighted(weights)]!++;
    return counts;
  };

  it('never picks a weight of 0', () => {
    expect(picks([0, 1, 0])).toEqual([0, 1000, 0]);
  });

  it('picks about three times as often what weighs three times as much', () => {
    const [light, heavy] = picks([1, 3]);

    expect(heavy! / light!).toBeGreaterThan(2.5);
    expect(heavy! / light!).toBeLessThan(3.5);
  });

  it('fails when every weight is 0', () => {
    expect(() => new SeededRandom(7).pickWeighted([0, 0])).toThrow('every weight is 0');
  });
});

describe('setting up a run', () => {
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [cardName('Daisy Walker'), cardName('Roland Banks')],
    gameSeed: 24,
    bot: 'random',
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
