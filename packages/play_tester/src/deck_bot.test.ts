import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  cardName,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { DeckBot } from './deck_bot';
import { playerCard } from './player_cards';
import { SeededRandom } from './run';
import { playStep } from './steps';

describe('the deck bot', () => {
  const alice = investigatorId('alice');
  const study = instanceId('study');
  const ghoul = instanceId('ghoul');
  /** Alice's turn in the study, 2 clues there, with 5 resources and 3 actions. */
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withInvestigator(alice, { locationId: study, resources: 5 })
    .withTurnOf(alice);
  const random = new SeededRandom(1);
  /** A bot whose only deck is Alice's, its first cards her opening hand. */
  const botWithHand = (...cards: string[]) =>
    new DeckBot(new Map([[cardName('alice'), cards.map((card) => playerCard(cardName(card)))]]));

  it('plays an asset with the play action, then pays for it and takes its effect', () => {
    const table = PlayTable.start(game);
    const bot = botWithHand('Holy Rosary');

    expect([bot.step(table, random), bot.step(table, random)]).toEqual([
      { verb: 'playCard', investigator: 'alice' },
      {
        verb: 'playerCard',
        investigator: 'alice',
        card: 'Holy Rosary',
        effects: [
          { kind: 'resources', delta: -2 },
          { kind: 'skillBoost', skill: 'willpower', delta: 1 },
        ],
      },
    ]);
  });

  it('plays a fast clue event without an action while its location has clues', () => {
    const table = PlayTable.start(game);
    const bot = botWithHand('Working a Hunch');

    expect(bot.step(table, random)).toEqual({
      verb: 'playerCard',
      investigator: 'alice',
      card: 'Working a Hunch',
      effects: [
        { kind: 'resources', delta: -2 },
        { kind: 'discoverClues', amount: 1 },
      ],
    });
  });

  it('plays 3 cards a turn at most, then leaves the turn to the goal bot', () => {
    const table = PlayTable.start(game);
    const bot = botWithHand(
      'Magnifying Glass',
      'Magnifying Glass',
      'Magnifying Glass',
      'Magnifying Glass',
    );

    const played = Array.from({ length: 6 }, () => {
      const step = bot.step(table, random);
      playStep(table, step);
      return step.verb === 'playerCard' ? step.card : step.verb;
    });

    expect(played.filter((card) => card === 'Magnifying Glass')).toHaveLength(3);
  });

  it('plays the card that discovers clues before one that only gains resources', () => {
    const table = PlayTable.start(game);
    const bot = botWithHand('Emergency Cache', 'Working a Hunch');

    expect(bot.step(table, random)).toMatchObject({ card: 'Working a Hunch' });
  });

  it('commits a skill card with the tested icon to its own test and names it', () => {
    const table = PlayTable.start(
      game
        .withChaosBag(['0'])
        .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), engagedWith(alice)),
    );
    table.fight(alice, ghoul, { result: 'open' });
    const bot = botWithHand('Overpower');

    expect(bot.step(table, random)).toMatchObject({
      verb: 'resolveTest',
      investigator: 'alice',
      cards: ['Overpower'],
    });
  });

  it.each([
    { clues: 2, amount: 2 },
    { clues: 0, amount: undefined },
  ])(
    'confirms the extra clue of a committed Deduction while the study has it ($clues clues)',
    ({ clues, amount }) => {
      const table = PlayTable.start(
        newGame()
          .withChaosBag(['0'])
          .withLocation(study, blankLocation('study'), { revealed: true, clues })
          .withInvestigator(alice, { locationId: study })
          .withTurnOf(alice),
      );
      table.investigate(alice, { result: 'open' });
      const bot = botWithHand('Deduction');

      const answer = bot.step(table, random);

      expect(answer).toMatchObject({ verb: 'resolveTest', result: 'pass', cards: ['Deduction'] });
      expect(answer.verb === 'resolveTest' && answer.amount).toBe(amount);
    },
  );

  it('heals the damage an ally in play soaks, until its health is used up', () => {
    const table = PlayTable.start(game);
    const bot = botWithHand('Leather Coat');
    playStep(table, bot.step(table, random));
    playStep(table, bot.step(table, random));
    table.takeDamage(alice, 3);

    expect(bot.step(table, random)).toEqual({
      verb: 'playerCard',
      investigator: 'alice',
      card: 'Leather Coat',
      effects: [{ kind: 'heal', stat: 'damage', amount: 2 }],
    });
  });
});
