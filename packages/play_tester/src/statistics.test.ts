import { describe, expect, it } from 'vitest';
import { cardName } from '@arkham/engine';
import { theGathering } from '@arkham/scenarios';
import { setUpTable, type Run } from './run';
import { gameStatistics, statisticsReport, type GameStatistics } from './statistics';
import { playStep } from './steps';

describe("a game's statistics", () => {
  const roland = cardName('Roland Banks');
  /** The Gathering for Roland, whose game seed 24 puts Icy Ghoul and then Crypt Chill on top. */
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [roland],
    blanks: [],
    gameSeed: 24,
    bot: 'goal',
    botSeed: 1,
  };
  const table = setUpTable(run);
  playStep(table, { verb: 'drawEncounterCard', investigator: roland });
  playStep(table, { verb: 'drawEncounterCard', investigator: roland });
  const statistics = gameStatistics({
    run,
    steps: [],
    log: table.entries,
    end: 'stepCap',
    rounds: 1,
    refusals: {},
    misuses: 0,
  });

  it('name the draws and the forced abilities that fired, from the log', () => {
    expect(statistics).toMatchObject({
      scenario: theGathering.id,
      difficulty: 'standard',
      outcome: 'step cap',
      rounds: 1,
      drawn: ['Icy Ghoul', 'Crypt Chill'],
      fired: ['Crypt Chill: revealed'],
    });
  });

  it("count the set-up encounter deck by copy and every ability of the game's cards", () => {
    expect(statistics.deck).toHaveLength(26);
    expect(statistics.deck.filter((name) => name === 'Ancient Evils')).toHaveLength(3);
    expect(statistics.abilities).toEqual(
      expect.arrayContaining(['Crypt Chill: revealed', 'Parlor: action 1']),
    );
  });
});

describe('the statistics report', () => {
  /** Two standard games of The Gathering with a deck of 3 Ancient Evils and 1 Crypt Chill. */
  const game = {
    scenario: theGathering.id,
    difficulty: 'standard',
    deck: ['Ancient Evils', 'Ancient Evils', 'Ancient Evils', 'Crypt Chill'],
    abilities: ['Ancient Evils: revealed', 'Crypt Chill: revealed', 'Parlor: action 1'],
  } as const;
  const lost: GameStatistics = {
    ...game,
    outcome: 'no resolution',
    rounds: 4,
    drawn: ['Ancient Evils', 'Ancient Evils'],
    fired: ['Ancient Evils: revealed'],
  };
  const won: GameStatistics = {
    ...game,
    outcome: 'R1',
    rounds: 9,
    drawn: ['Crypt Chill', 'Ancient Evils'],
    fired: ['Ancient Evils: revealed', 'Crypt Chill: revealed'],
  };

  it('has the outcomes and rounds, the draws next to the deck and the abilities never fired', () => {
    expect(statisticsReport([lost, won])).toBe(
      [
        '### Statistics',
        '',
        '| Scenario | Difficulty | Games | Outcomes | Rounds (fewest, average, most) |',
        '| --- | --- | --- | --- | --- |',
        '| the-gathering | standard | 2 | no resolution 1, R1 1 | 4, 6.5, 9 |',
        '',
        '#### Encounter draws, the-gathering',
        '',
        '| Card | Drawn | Share of draws | Share of deck |',
        '| --- | --- | --- | --- |',
        '| Ancient Evils | 3 | 75.0 % | 75.0 % |',
        '| Crypt Chill | 1 | 25.0 % | 25.0 % |',
        '',
        'Abilities that never fired: Parlor: action 1',
      ].join('\n'),
    );
  });
});
