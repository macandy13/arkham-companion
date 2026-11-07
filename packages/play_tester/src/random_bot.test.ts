import { describe, expect, it } from 'vitest';
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
import { offeredSteps, rareShareWeights } from './random_bot';
import type { Step } from './steps';

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

  it('offers no action once the actions are spent', () => {
    const table = PlayTable.start(game.withTurnOf(alice));
    table.spendAction(alice);
    table.spendAction(alice);
    table.spendAction(alice);

    expect(offeredSteps(table)).not.toContainEqual({
      verb: 'investigate',
      investigator: cardName('alice'),
    });
    expect(offeredSteps(table)).toContainEqual({
      verb: 'endTurn',
      investigator: cardName('alice'),
    });
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
});

describe('weighing the steps by their share', () => {
  const next = { verb: 'nextPhase' } as const;
  const undo = { verb: 'undo' } as const;
  const doom = { verb: 'placeDoom' } as const;
  const moveTo = (location: string) =>
    ({ verb: 'moveTo', investigator: cardName('alice'), location: cardName(location) }) as const;
  const rare = (step: Step) => step.verb === 'undo' || step.verb === 'placeDoom';

  it('gives each verb the same weight, split over its steps', () => {
    expect(rareShareWeights([next, moveTo('hallway'), moveTo('attic')], rare, 1 / 100)).toEqual([
      1 / 2,
      1 / 4,
      1 / 4,
    ]);
  });

  it('gives the rare steps their share, split over their verbs', () => {
    expect(rareShareWeights([next, undo, doom], rare, 1 / 100)).toEqual([0.99, 0.005, 0.005]);
  });

  it('gives the rare steps everything when nothing else is offered', () => {
    expect(rareShareWeights([undo], rare, 1 / 100)).toEqual([1]);
  });
});
