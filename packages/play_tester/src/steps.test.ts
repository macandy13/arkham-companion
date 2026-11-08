import { describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankEnemy,
  blankTreachery,
  blankLocation,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  cardName,
  resignAction,
  type InvestigatorView,
} from '@arkham/engine';
import { describeStep, playStep, type CardEffect } from './steps';

const alice = investigatorId('alice');
const study = instanceId('study');
const hallway = instanceId('hallway');
const ghoul = instanceId('ghoul');
const agenda = instanceId('agenda');
const parlor = instanceId('parlor');

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

  it.each([
    { printed: 'a resign', action: resignAction(), actions: 2 },
    { printed: 'a free resign', action: { ...resignAction(), free: true as const }, actions: 3 },
  ])('counts off what $printed on a card costs: $actions left', ({ action, actions }) => {
    const table = PlayTable.start(
      newGame()
        .withLocation(parlor, blankLocation('parlor', { actions: [action] }), { revealed: true })
        .withInvestigator(alice, { locationId: parlor })
        .withTurnOf(alice),
    );

    playStep(table, {
      verb: 'useCardAction',
      investigator: cardName('alice'),
      card: parlor,
      action: 0,
    });

    expect(table.board.investigator(alice)).toMatchObject({ status: 'resigned', actions });
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

  it('confirms the damage a weapon adds when a fight passes', () => {
    const table = PlayTable.start(
      game.withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), engagedWith(alice)),
    );

    playStep(table, { verb: 'fight', investigator: cardName('alice'), enemy: ghoul });
    playStep(table, {
      verb: 'resolveTest',
      investigator: cardName('alice'),
      tokens: ['0'],
      result: 'pass',
      amount: 2,
      cards: [cardName('Machete')],
    });

    expect(table.board.enemy(ghoul).damage).toBe(2);
  });

  it('plays the effects of a player card as table commands', () => {
    const table = PlayTable.start(
      game.withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), engagedWith(alice)),
    );

    playStep(table, {
      verb: 'playerCard',
      investigator: cardName('alice'),
      card: cardName('Sneak Attack'),
      effects: [
        { kind: 'resources', delta: -2 },
        { kind: 'damageEnemy', enemy: ghoul, amount: 2 },
      ],
    });

    expect(table.board.investigator(alice).resources).toBe(3);
    expect(table.board.enemy(ghoul).damage).toBe(2);
  });

  it('evades an engaged enemy, heals what the card hurt and draws an encounter card', () => {
    const topCard = instanceId('top_card');
    const table = PlayTable.start(
      game
        .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), engagedWith(alice))
        .withCard(topCard, blankTreachery('top_card'), { kind: 'encounterDeck' })
        .withCard(instanceId('next_card'), blankTreachery('next_card'), { kind: 'encounterDeck' }),
    );

    playStep(table, {
      verb: 'playerCard',
      investigator: cardName('alice'),
      card: cardName('a card'),
      effects: [
        { kind: 'evadeEnemy', enemy: ghoul },
        { kind: 'hurt', damage: 2, horror: 0 },
        { kind: 'heal', stat: 'damage', amount: 1 },
        { kind: 'drawEncounterCard' },
      ],
    });

    expect(table.board.enemy(ghoul).exhausted).toBe(true);
    expect(table.board.enemy(ghoul).engagedWith).toBeUndefined();
    expect(table.board.investigator(alice).damage).toBe(1);
    expect(table.board.encounter.deckCount).toBe(1);
  });

  it('takes no action for a player card, as its play action is a step of its own', () => {
    const table = PlayTable.start(game);

    playStep(table, {
      verb: 'playerCard',
      investigator: cardName('alice'),
      card: cardName('Working a Hunch'),
      effects: [
        { kind: 'resources', delta: -2 },
        { kind: 'discoverClues', amount: 1 },
      ],
    });

    expect(table.board.investigator(alice)).toMatchObject({ actions: 3, resources: 3, clues: 1 });
  });

  it.each<{ effect: CardEffect; changed: Partial<InvestigatorView> }>([
    { effect: { kind: 'hurt', damage: 1, horror: 2 }, changed: { damage: 1, horror: 2 } },
    {
      effect: { kind: 'skillBoost', skill: 'combat', delta: 1 },
      changed: { boosts: { combat: 1 } },
    },
    { effect: { kind: 'actions', delta: 1 }, changed: { actions: 4 } },
    { effect: { kind: 'doomOnPlayerCards', delta: 1 }, changed: { doom: 1 } },
    {
      effect: { kind: 'moveTo', location: cardName('hallway') },
      changed: { at: cardName('hallway') },
    },
  ])('takes the effect $effect.kind on the table', ({ effect, changed }) => {
    const table = PlayTable.start(game);

    playStep(table, {
      verb: 'playerCard',
      investigator: cardName('alice'),
      card: cardName('a card'),
      effects: [effect],
    });

    expect(table.board.investigator(alice)).toMatchObject(changed);
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
