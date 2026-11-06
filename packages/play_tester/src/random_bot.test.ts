import { describe, expect, it } from 'vitest';
import { range } from '@arkham/util';
import {
  blankEnemy,
  blankLocation,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  cardName,
} from '@arkham/engine';
import { offeredSteps, randomStep } from './random_bot';
import { SeededRandom } from './run';

const alice = investigatorId('alice');
const study = instanceId('study');
const hallway = instanceId('hallway');
const ghoul = instanceId('ghoul');

describe('the steps the random bot is offered', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withLocation(hallway, blankLocation('hallway'), { revealed: true })
    .withConnection(study, hallway)
    .withInvestigator(alice, { locationId: study });

  it("offers the investigation turns to start before anyone's turn", () => {
    const table = PlayTable.start(game);
    table.nextPhase();

    expect(offeredSteps(table)).toContainEqual({
      verb: 'startTurn',
      investigator: cardName('alice'),
    });
    expect(offeredSteps(table)).not.toContainEqual({
      verb: 'investigate',
      investigator: cardName('alice'),
    });
  });

  it("offers the turn's actions, moves and enemy actions in a turn", () => {
    const table = PlayTable.start(
      game.withCard(ghoul, blankEnemy('ghoul'), engagedWith(alice)).withTurnOf(alice),
    );

    expect(offeredSteps(table)).toEqual(
      expect.arrayContaining([
        { verb: 'nextPhase' },
        { verb: 'endTurn', investigator: cardName('alice') },
        { verb: 'investigate', investigator: cardName('alice') },
        { verb: 'moveTo', investigator: cardName('alice'), location: cardName('hallway') },
        { verb: 'fight', investigator: cardName('alice'), enemy: 'ghoul' },
        { verb: 'evade', investigator: cardName('alice'), enemy: 'ghoul' },
        { verb: 'takeDamage', investigator: cardName('alice') },
        { verb: 'placeDoom' },
      ]),
    );
  });

  it('offers only the options of an open decision, and undo', () => {
    const table = PlayTable.start(game.withTurnOf(alice));
    table.investigate(alice, { result: 'open' });

    expect(offeredSteps(table)).toEqual([
      { verb: 'answer', about: 'study', option: 'pass' },
      { verb: 'answer', about: 'study', option: 'fail' },
      { verb: 'undo' },
    ]);
  });

  it('picks the same steps from the same seed', () => {
    const table = PlayTable.start(game.withTurnOf(alice));
    const fivePicks = (random: SeededRandom) => range(5).map(() => randomStep(table, random));

    const picked = fivePicks(new SeededRandom(7));

    expect(fivePicks(new SeededRandom(7))).toEqual(picked);
  });
});
