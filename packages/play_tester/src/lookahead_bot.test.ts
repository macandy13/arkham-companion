import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  cardName,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { goalWeights } from './goal_bot';
import { lookaheadStep, outlook, progress } from './lookahead_bot';
import { offeredSteps } from './random_bot';
import { SeededRandom } from './run';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const easy_study = instanceId('easy_study');
const hard_study = instanceId('hard_study');

describe('the step the lookahead bot takes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Alice, intellect 2, in a hall between two studies with a clue each: one of shroud 0, one of
   * shroud 9, which she cannot pass on the bag's only token, 0.
   */
  const table = PlayTable.start(
    newGame()
      .withChaosBag(['0'])
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(easy_study, blankLocation('easy_study', { shroud: 0, clues: fixed(1) }), {
        revealed: true,
        clues: 1,
      })
      .withLocation(hard_study, blankLocation('hard_study', { shroud: 9, clues: fixed(1) }), {
        revealed: true,
        clues: 1,
      })
      .withConnection(hall, easy_study)
      .withConnection(hall, hard_study)
      .withInvestigator(alice, {
        locationId: hall,
        skills: { willpower: 2, intellect: 2, combat: 2, agility: 2 },
      })
      .withTurnOf(alice),
  );

  it('moves to the study whose clue it can discover, where the goal bot wants either', () => {
    const offered = offeredSteps(table);
    const weights = goalWeights(table, offered);
    const goalWants = offered.filter((_, i) => weights[i] === Math.max(...weights));

    expect(goalWants).toEqual([
      { verb: 'moveTo', investigator: cardName('alice'), location: easy_study },
      { verb: 'moveTo', investigator: cardName('alice'), location: hard_study },
    ]);
    expect(lookaheadStep(table, new SeededRandom(7))).toEqual({
      verb: 'moveTo',
      investigator: cardName('alice'),
      location: easy_study,
    });
  });

  it('scores the move to the easy study by the clue the rest of the turn discovers there', () => {
    const toEasy = outlook(
      table,
      { verb: 'moveTo', investigator: cardName('alice'), location: easy_study },
      7,
    );
    const toHard = outlook(
      table,
      { verb: 'moveTo', investigator: cardName('alice'), location: hard_study },
      7,
    );

    expect(toEasy).toBeGreaterThan(toHard);
  });

  it('ranks a step that crashes the engine above every other, so the bot plays into the bug', () => {
    const crashing = table.fork();
    vi.spyOn(crashing, 'play').mockImplementation(() => {
      throw new Error('engine bug');
    });
    vi.spyOn(table, 'fork').mockReturnValueOnce(crashing);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const broken = outlook(
      table,
      { verb: 'moveTo', investigator: cardName('alice'), location: hard_study },
      7,
    );

    expect(broken).toBe(Number.POSITIVE_INFINITY);
  });

  it('ranks a step the table refuses below every other', () => {
    const refused = outlook(table, { verb: 'endTurn', investigator: cardName('bob') }, 7);

    expect(refused).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('how the lookahead bot scores a change of the board', () => {
  /** Alice, health 9 and sanity 3, at a study with 2 clues. */
  const start = () =>
    PlayTable.start(
      newGame()
        .withLocation(easy_study, blankLocation('easy_study'), { revealed: true, clues: 2 })
        .withInvestigator(alice, {
          locationId: easy_study,
          health: { max: 9, damage: 0 },
          sanity: { max: 3, horror: 0 },
        }),
    );

  it.each([
    { change: 'nothing', play: () => {}, points: 0 },
    {
      change: 'a clue discovered: 6 for the clue held, -1 for the clue gone from the study',
      play: (table: PlayTable) => table.investigate(alice, { result: 'pass' }),
      points: 5,
    },
    {
      change: '1 damage of 9 health',
      play: (table: PlayTable) => table.takeDamage(alice, 1),
      points: -3,
    },
    {
      change: '2 horror of 3 sanity, both within 2 of defeat',
      play: (table: PlayTable) => table.takeHorror(alice, 2),
      points: -24,
    },
    {
      change: 'the defeat of the only investigator, by 3 horror',
      play: (table: PlayTable) => table.takeHorror(alice, 3),
      points: -1000,
    },
  ])('scores $change as $points', ({ play, points }) => {
    const table = start();
    const before = table.board;
    const logged = table.events.length;

    play(table);

    expect(progress(before, table.board, table.events.slice(logged))).toBe(points);
  });
});
