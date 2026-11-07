import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  cardName,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { SeededRandom } from './run';
import { answersByDraw, drawnTestAnswer } from './test_answers';

const alice = investigatorId('alice');
const study = instanceId('study');

describe('answering a skill test by drawing chaos tokens', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study', { shroud: 2 }), { revealed: true, clues: 2 })
    .withInvestigator(alice, {
      locationId: study,
      skills: { willpower: 2, intellect: 2, combat: 2, agility: 2 },
    })
    .withTurnOf(alice);

  it.each([
    { token: '+1' as const, result: 'pass' },
    { token: '0' as const, result: 'pass' },
    { token: '-1' as const, result: { failedBy: 1 } },
    { token: 'autoFail' as const, result: { failedBy: 2 } },
  ])(
    'answers intellect 2 against shroud 2 with the $token drawn as $result',
    ({ token, result }) => {
      const table = PlayTable.start(game.withChaosBag([token]));
      table.investigate(alice, { result: 'open' });

      expect(drawnTestAnswer(table, new SeededRandom(1))).toEqual({
        verb: 'resolveTest',
        investigator: cardName('alice'),
        tokens: [token],
        result,
      });
    },
  );

  it('picks a modifier for a token the engine cannot value', () => {
    const table = PlayTable.start(game.withChaosBag(['elderSign']));
    table.investigate(alice, { result: 'open' });

    expect(drawnTestAnswer(table, new SeededRandom(1))).toMatchObject({
      verb: 'resolveTest',
      tokens: ['elderSign'],
    });
  });

  it('draws another token after a bless and counts both', () => {
    const table = PlayTable.start(game.withChaosBag(['bless', '-3']));
    table.investigate(alice, { result: 'open' });

    // Seed 2 draws the bless first; bless +2 and −3 leave intellect 2 at 1 against shroud 2.
    expect(drawnTestAnswer(table, new SeededRandom(2))).toMatchObject({
      tokens: ['bless', '-3'],
      result: { failedBy: 1 },
    });
  });

  it('draws nothing from an empty bag, so the test is answered like any decision', () => {
    const table = PlayTable.start(game.withChaosBag([]));
    table.investigate(alice, { result: 'open' });

    expect(drawnTestAnswer(table, new SeededRandom(1))).toBeUndefined();
    expect(answersByDraw(table, table.state.pending[0]!)).toBe(false);
  });

  it('draws nothing while no test is open', () => {
    const table = PlayTable.start(game.withChaosBag(['+1']));

    expect(drawnTestAnswer(table, new SeededRandom(1))).toBeUndefined();
  });
});
