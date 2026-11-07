import { describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankEnemy,
  blankLocation,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  cardName,
} from '@arkham/engine';
import { describeStep, playStep } from './steps';

const alice = investigatorId('alice');
const study = instanceId('study');
const hallway = instanceId('hallway');
const ghoul = instanceId('ghoul');
const agenda = instanceId('agenda');

describe('playing a step', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withLocation(hallway, blankLocation('hallway'), { revealed: true })
    .withConnection(study, hallway)
    .withInvestigator(alice, { locationId: study, resources: 5 })
    .withTurnOf(alice);

  it('moves an investigator by the names of the investigator and the location', () => {
    const table = PlayTable.start(game);

    playStep(table, {
      verb: 'moveTo',
      investigator: cardName('alice'),
      location: cardName('hallway'),
    });

    expect(table.board.investigator(alice).at).toBe('hallway');
  });

  it('counts off an action before taking it, as the app does', () => {
    const table = PlayTable.start(game);

    playStep(table, { verb: 'takeResource', investigator: cardName('alice') });

    expect(table.board.investigator(alice)).toMatchObject({ actions: 2, resources: 6 });
  });

  it('leaves the actions as they were when the action is refused', () => {
    const table = PlayTable.start(game);

    expect(() =>
      playStep(table, {
        verb: 'moveTo',
        investigator: cardName('alice'),
        location: cardName('study'),
      }),
    ).toThrow();
    expect(table.board.investigator(alice).actions).toBe(3);
  });

  it('leaves an investigation open and answers it by the card it is about', () => {
    const table = PlayTable.start(game);

    playStep(table, { verb: 'investigate', investigator: cardName('alice') });
    playStep(table, { verb: 'answer', about: study, option: 'pass' });

    expect(table.board.investigator(alice).clues).toBe(1);
  });

  it('reports an open test with the result a drawn token gave', () => {
    const table = PlayTable.start(game);

    playStep(table, { verb: 'investigate', investigator: cardName('alice') });
    playStep(table, {
      verb: 'resolveTest',
      investigator: cardName('alice'),
      tokens: ['+1'],
      result: 'pass',
    });

    expect(table.board.investigator(alice).clues).toBe(1);
  });

  it('fights an enemy by its instance id and answers the open test as the only decision', () => {
    const table = PlayTable.start(
      game.withCard(ghoul, blankEnemy('ghoul', { health: fixed(2) }), engagedWith(alice)),
    );

    playStep(table, { verb: 'fight', investigator: cardName('alice'), enemy: ghoul });
    playStep(table, { verb: 'answer', option: 'pass' });

    expect(table.board.enemy(ghoul).damage).toBe(1);
  });

  it.each([
    { verb: 'takeDamage' as const, stat: 'damage' as const, after: 1 },
    { verb: 'takeHorror' as const, stat: 'horror' as const, after: 1 },
    { verb: 'gainResources' as const, stat: 'resources' as const, after: 6 },
  ])('$verb corrects $stat by one, to $after', ({ verb, stat, after }) => {
    const table = PlayTable.start(game);

    playStep(table, { verb, investigator: cardName('alice') });

    expect(table.board.investigator(alice)[stat]).toBe(after);
  });

  it('places one doom on the agenda', () => {
    const table = PlayTable.start(game.withAgenda(agenda, blankAgenda('agenda', fixed(5))));

    playStep(table, { verb: 'placeDoom' });

    expect(table.board.doomInPlay).toBe(1);
  });

  it('takes back the last step with undo', () => {
    const table = PlayTable.start(game);
    playStep(table, { verb: 'spendAction', investigator: cardName('alice') });

    playStep(table, { verb: 'undo' });

    expect(table.board.investigator(alice).actions).toBe(3);
  });
});

describe('a step as text', () => {
  it.each([
    { step: { verb: 'nextPhase' as const }, text: 'nextPhase()' },
    {
      step: {
        verb: 'moveTo' as const,
        investigator: cardName('Daisy Walker'),
        location: cardName('Attic'),
      },
      text: 'moveTo("Daisy Walker", "Attic")',
    },
    {
      step: { verb: 'answer' as const, about: instanceId('ghoul_minion'), option: 'attack' },
      text: 'answer("ghoul_minion", "attack")',
    },
  ])('reads $text', ({ step, text }) => {
    expect(describeStep(step)).toBe(text);
  });
});
