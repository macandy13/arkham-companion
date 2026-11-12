import { describe, expect, it } from 'vitest';
import {
  cardCode,
  cardName,
  discardAsset,
  PlayTable,
  whenRevealed,
  type CardDb,
  type CardStats,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { scenarioContext, setUpTable, setupOptions, type Run } from './run';
import { gameStatistics, statisticsReport, type GameStatistics } from './statistics';
import { playStep } from './steps';

describe("a game's statistics", () => {
  const roland = cardName('Roland Banks');
  /**
   * The Gathering for Roland, whose game seed 24 puts Icy Ghoul and then Crypt Chill on top of its
   * 26-card encounter deck. Crypt Chill's revelation is resolved when it asks.
   */
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
  playStep(table, { verb: 'answer', option: 'resolve revelation' });
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
      byHand: [],
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

describe('what the players resolve by hand', () => {
  const roland = cardName('Roland Banks');
  const run: Run = {
    scenario: theGathering.id,
    difficulty: 'standard',
    seats: [roland],
    blanks: [],
    gameSeed: 24,
    bot: 'goal',
    botSeed: 1,
  };
  const cryptChillCode = cardCode('01167');
  const printedCryptChill = theGatheringCards.get(cryptChillCode)!;

  /**
   * The statistics of Roland's game of The Gathering with game seed 24, which draws Icy Ghoul and
   * then Crypt Chill, played with `cryptChill` in place of the scenario's own; it answers the
   * revelation when the card asks one. Only `get` is replaced, not `cardDbWith`, because that
   * moves the card to the end of its encounter set and so changes the shuffle.
   */
  function drawingCryptChill(cryptChill: CardStats) {
    const { cards: printed } = scenarioContext(run);
    const cards: CardDb = {
      ...printed,
      get: (code) => (code === cryptChill.code ? cryptChill : printed.get(code)),
    };
    const table = PlayTable.setUp({ ...scenarioContext(run), cards }, setupOptions(run));
    playStep(table, { verb: 'drawEncounterCard', investigator: roland });
    playStep(table, { verb: 'drawEncounterCard', investigator: roland });
    if (table.state.pending.length > 0)
      playStep(table, { verb: 'answer', option: 'resolve revelation' });
    return gameStatistics(
      { run, steps: [], log: table.entries, end: 'stepCap', rounds: 1, refusals: {}, misuses: 0 },
      cards,
    );
  }

  it('counts a drawn treachery whose text the engine does not hold as not scripted', () => {
    const unscripted = { ...printedCryptChill, abilities: undefined };
    expect(drawingCryptChill(unscripted)).toMatchObject({
      drawn: ['Icy Ghoul', 'Crypt Chill'],
      byHand: ['Crypt Chill: not scripted'],
    });
  });

  it('counts an effect the engine leaves to the players by the card and the command', () => {
    const discarding = { ...printedCryptChill, abilities: [whenRevealed(discardAsset())] };
    expect(drawingCryptChill(discarding)).toMatchObject({
      drawn: ['Icy Ghoul', 'Crypt Chill'],
      byHand: ['Crypt Chill: DiscardAsset'],
    });
  });
});

describe('the statistics report', () => {
  /**
   * Two standard games of The Gathering with a deck of 3 Ancient Evils and 1 Crypt Chill; the won
   * one also draws a Ghoul Priest that wasn't in the deck at setup. Both leave a discard from hand
   * to the players, the won one also an asset's discard.
   */
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
    byHand: ["What's Going On?!: DiscardFromHand"],
  };
  const won: GameStatistics = {
    ...game,
    outcome: 'R1',
    rounds: 9,
    drawn: ['Crypt Chill', 'Ancient Evils', 'Ghoul Priest'],
    fired: ['Ancient Evils: revealed', 'Crypt Chill: revealed'],
    byHand: ['Crypt Chill: DiscardAsset', "What's Going On?!: DiscardFromHand"],
  };

  it('has the outcomes and rounds, the draws next to the deck, the abilities never fired and what was done by hand', () => {
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
        '| Ancient Evils | 3 | 60.0 % | 75.0 % |',
        '| Crypt Chill | 1 | 20.0 % | 25.0 % |',
        '| Ghoul Priest | 1 | 20.0 % | 0.0 % |',
        '',
        'Abilities that never fired: Parlor: action 1',
        '',
        '#### Resolved by hand, the-gathering',
        '',
        '| Effect | Times | Share of games |',
        '| --- | --- | --- |',
        "| What's Going On?!: DiscardFromHand | 2 | 100.0 % |",
        '| Crypt Chill: DiscardAsset | 1 | 50.0 % |',
      ].join('\n'),
    );
  });

  it('says so when the players resolved nothing by hand', () => {
    expect(statisticsReport([{ ...lost, byHand: [] }])).toMatch(
      /#### Resolved by hand, the-gathering\n\nNothing$/,
    );
  });
});
