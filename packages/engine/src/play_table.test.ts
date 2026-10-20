import { describe, expect, it } from 'vitest';
import {
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  byAny,
  byName,
  cardCode,
  cardDbFrom,
  CommandRejected,
  decisionId,
  engagedWith,
  enemyMatching,
  fixed,
  instanceId,
  investigatorCode,
  investigatorId,
  mapId,
  newGame,
  PlayTable,
  replay,
  skillTestDecision,
  TableError,
  TableRejected,
} from './index';
import { makeDefinition, standardInvestigatorCards } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const hallway = instanceId('hallway');
const ghoul = instanceId('ghoul');

describe('setting up a scenario', () => {
  const studyCode = cardCode('study');
  const seats = [
    { id: alice, code: investigatorCode('tank') },
    { id: bob, code: investigatorCode('seeker') },
  ];
  const ctx = {
    cards: cardDbFrom([...standardInvestigatorCards, blankLocation('study')]),
    scenario: makeDefinition({
      chaosBag: { easy: [], standard: ['+1', '-2'], hard: ['-4'], expert: [] },
      setup: [
        {
          kind: 'addMap',
          mapId: mapId('main'),
          name: 'Main',
          locations: [{ code: studyCode, faceUp: true }],
        },
        { kind: 'moveInvestigators', to: studyCode },
      ],
    }),
  };

  it.each([
    { difficulty: undefined, bag: ['+1', '-2'] },
    { difficulty: 'standard' as const, bag: ['+1', '-2'] },
    { difficulty: 'hard' as const, bag: ['-4'] },
  ])('seats the investigators in $difficulty difficulty ($bag)', ({ difficulty, bag }) => {
    const table = PlayTable.setUp(ctx, {
      investigators: seats,
      seed: 7,
      difficulty,
    });

    expect(table.board.perInvestigator('at')).toEqual({ alice: 'study', bob: 'study' });
    expect(table.board.lead).toBe('alice');
    expect([...table.state.chaosBag].sort()).toEqual([...bag].sort());
    expect(replay(table.events)).toEqual(table.state);
  });
});

describe('starting a table', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withInvestigator(alice, { locationId: study });

  it('starts from a builder with a log that replays to the state', () => {
    const table = PlayTable.start(game);

    expect(replay(table.events)).toEqual(table.state);
    expect(table.state).toEqual(game.start().state);
    expect(table.board.investigator(alice)).toMatchObject({ at: 'study', actions: 3 });
  });

  it('begins the turn the builder names with withTurnOf', () => {
    const table = PlayTable.start(game.withTurnOf(alice));

    expect(table.board).toMatchObject({ round: 1, phase: 'investigation', turn: 'alice' });
    expect(replay(table.events)).toEqual(table.state);
  });

  it('starts from a start command in a given context', () => {
    const table = PlayTable.from(game.context(), game.startCommand());

    expect(replay(table.events)).toEqual(table.state);
    expect(table.board.locations.map((location) => location.name)).toEqual(['study']);
  });

  it('fails when the start leaves the state inconsistent, with the board attached', () => {
    const defeatedAtStart = game.withInvestigator(bob, {
      locationId: study,
      health: { max: 0, damage: 0 },
    });

    expect(() => PlayTable.start(defeatedAtStart)).toThrow(
      /StartScenario broke invariants: investigator bob is active but has no health or sanity left\nRound 0/,
    );
  });

  it('reads a fresh board on each access', () => {
    const table = PlayTable.start(
      game.withLocation(hallway, blankLocation('hallway')).withConnection(study, hallway),
    );
    const before = table.board;
    table.nextPhase();
    table.startTurn(alice);

    table.moveTo(alice, byName('hallway'));

    expect(before.investigator(alice).at).toBe('study');
    expect(table.board.investigator(alice).at).toBe('hallway');
    expect(table.formatted()).toContain('hallway');
  });
});

describe('rejected and broken steps', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'))
    .withLocation(hallway, blankLocation('hallway'))
    .withInvestigator(alice, { locationId: study });

  it('wraps a refusal with the board and leaves state and log untouched', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);
    const stateBefore = table.state;
    const eventsBefore = table.events;

    expect(() => table.moveTo(alice, byName('hallway'))).toThrow(TableRejected);
    expect(() => table.moveTo(alice, byName('hallway'))).toThrow(CommandRejected);
    expect(() => table.moveTo(alice, byName('hallway'))).toThrow(/study.*hallway.*\nRound 1/s);
    expect(table.state).toBe(stateBefore);
    expect(table.events).toEqual(eventsBefore);
  });

  it('keeps the engine rejection unchanged', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);

    expect(() => table.moveTo(alice, byName('hallway'))).toThrow(
      expect.objectContaining({
        rejection: { code: 'notConnected', from: study, to: hallway },
      }),
    );
  });

  it('fails a name that matches no card with a TableError, not a rejection', () => {
    const table = PlayTable.start(game);

    expect(() => table.moveTo(alice, byName('garden'))).toThrow(TableError);
    expect(() => table.moveTo(alice, byName('garden'))).not.toThrow(CommandRejected);
  });

  it('passes on an error the engine throws that is not a rejection', () => {
    const brokenHook = new RangeError('broken doom hook');
    const table = PlayTable.start(
      game.withAgenda(instanceId('agenda'), blankAgenda('agenda', fixed(5))).withHooks({
        afterDoomPlaced: () => {
          throw brokenHook;
        },
      }),
    );

    expect(() => table.placeDoom(1)).toThrow(brokenHook);
    expect(table.board.agenda).toEqual({ name: 'agenda', doom: 0 });
  });
});

describe('the round', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'))
    .withInvestigator(alice, { locationId: study })
    .withCard(ghoul, blankEnemy('ghoul', { damage: 2, horror: 1 }), engagedWith(alice));

  it('reports where each Next stops', () => {
    const table = PlayTable.start(game);

    expect(table.nextPhase()).toMatchObject({ round: 1, phase: 'investigation' });
    table.startTurn(alice);
    table.endTurn(alice);
    expect(table.nextPhase()).toEqual({ round: 1, phase: 'enemy', step: 'enemiesAttack' });
  });

  it('reports the step a phase stops at when it raises a decision', () => {
    const agendaOf1 = blankAgenda('agenda_of_1', fixed(1));
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alice, { locationId: study })
        .withAgenda(instanceId('first_agenda'), agendaOf1)
        .withAgenda(
          instanceId('second_agenda'),
          blankAgenda('second_agenda', fixed(9), { stage: { number: 2 } }),
        ),
    );
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();
    table.nextPhase();

    expect(table.nextPhase()).toEqual({ round: 2, phase: 'mythos', step: 'checkDoomThreshold' });
    expect(table.board.decisions).toMatchObject([{ about: 'agenda_of_1' }]);
  });

  it('resolves the attacks of enemy step 3.3 and exhausts the attacker', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();
    expect(table.board.attacksDue).toEqual([{ enemy: 'ghoul', investigator: alice }]);

    table.resolveEnemyAttacks();

    expect(table.board.investigator(alice)).toMatchObject({ damage: 2, horror: 1 });
    expect(table.board.enemy(byName('ghoul'))).toMatchObject({ exhausted: true });
  });

  it('drops the remaining attacks of an investigator the first attack defeats', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alice, { locationId: study })
        .withCard(ghoul, blankEnemy('ghoul', { damage: 99 }), engagedWith(alice))
        .withCard(instanceId('second_ghoul'), blankEnemy('second_ghoul'), engagedWith(alice)),
    );
    table.nextPhase();
    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();

    table.resolveEnemyAttacks();

    expect(table.board.investigator(alice).status).toBe('defeated');
    expect(table.board.attacksDue).toEqual([]);
  });

  it('fails to resolve attacks when the step lists none, leaving the table as it was', () => {
    const table = PlayTable.start(game);
    const stateBefore = table.state;

    expect(() => table.resolveEnemyAttacks()).toThrow(/no enemy attacks to resolve\nRound 0/);
    expect(table.state).toBe(stateBefore);
  });
});

describe('turns, actions and tokens', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'))
    .withInvestigator(alice, { locationId: study });

  it('counts actions off and on', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);

    table.spendAction(alice);
    expect(table.board.investigator(alice).actions).toBe(2);
    table.spendAction(alice, 2);
    expect(table.board.investigator(alice).actions).toBe(0);
    table.adjustActions(alice, 1);
    expect(table.board.investigator(alice).actions).toBe(1);
  });

  it('shows whose turn it is until they end it', () => {
    const table = PlayTable.start(game);
    table.nextPhase();

    table.startTurn(alice);
    expect(table.board.turn).toBe(alice);
    table.endTurn(alice);

    expect(table.board.turn).toBeUndefined();
  });

  it('lets an investigator resign', () => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);

    table.resign(alice);

    expect(table.board.investigator(alice).status).toBe('resigned');
  });

  it('gains and spends resources and takes damage and horror', () => {
    const table = PlayTable.start(game);

    table.gainResources(alice, 3);
    table.spendResources(alice, 2);
    table.takeDamage(alice, 2);
    table.takeHorror(alice, 1);

    expect(table.board.investigator(alice)).toMatchObject({
      resources: 6,
      damage: 2,
      horror: 1,
    });
  });

  it('places doom on the agenda', () => {
    const table = PlayTable.start(
      game.withAgenda(instanceId('agenda'), blankAgenda('agenda', fixed(5))),
    );

    table.placeDoom(2);

    expect(table.board.agenda).toEqual({ name: 'agenda', doom: 2 });
  });

  it('advances the act by spending the clues of several investigators', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alice, { locationId: study, clues: 1 })
        .withInvestigator(bob, { locationId: study, clues: 1 })
        .withAct(instanceId('first_act'), blankAct('first_act', { clues: fixed(2) }))
        .withAct(instanceId('last_act'), blankAct('last_act', { stage: { number: 2 } })),
    );

    table.spendCluesToAdvanceAct([
      [alice, 1],
      [bob, 1],
    ]);

    expect(table.board.act).toMatchObject({ name: 'last_act' });
    expect(table.board.investigators.map((inv) => inv.clues)).toEqual([0, 0]);
  });
});

describe('investigating', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study', { shroud: 2 }), { revealed: true, clues: 3 })
    .withInvestigator(alice, { locationId: study });

  it('passes the test and discovers a clue by default', () => {
    const table = PlayTable.start(game);

    table.investigate(alice);

    expect(table.board.investigator(alice).clues).toBe(1);
    expect(table.board.location(byName('study')).clues).toBe(2);
    expect(table.board.decisions).toEqual([]);
  });

  it('discovers the clues the players confirm', () => {
    const table = PlayTable.start(game);

    table.investigate(alice, { clues: 2 });

    expect(table.board.investigator(alice).clues).toBe(2);
  });

  it('discovers nothing when the test fails', () => {
    const table = PlayTable.start(game);

    table.investigate(alice, { result: 'fail' });

    expect(table.board.investigator(alice).clues).toBe(0);
    expect(table.board.decisions).toEqual([]);
  });

  it('leaves an open test pending until it is resolved', () => {
    const table = PlayTable.start(game);

    table.investigate(alice, { result: 'open' });
    expect(table.board.decisions).toMatchObject([{ kind: 'skillTestResult', about: 'study' }]);
    expect(table.board.investigator(alice).clues).toBe(0);
    table.resolveTest('pass', { amount: 2 });

    expect(table.board.investigator(alice).clues).toBe(2);
    expect(table.board.decisions).toEqual([]);
  });

  it('refuses a count for a test that is left open', () => {
    const table = PlayTable.start(game);

    expect(() => table.investigate(alice, { result: 'open', clues: 2 })).toThrow(TableError);
  });

  it('points to the attack of opportunity that comes before the test', () => {
    const table = PlayTable.start(
      game.withCard(ghoul, blankEnemy('ghoul', { damage: 1 }), engagedWith(alice)),
    );

    table.nextPhase();
    table.startTurn(alice);

    table.investigate(alice, { result: 'open' });
    table.takeAttackOfOpportunity(byName('ghoul'), { damage: 0 });
    table.resolveTest('pass');

    expect(table.board.investigator(alice)).toMatchObject({ clues: 1, damage: 0 });
  });

  it('fails an investigate that meets an attack of opportunity first, leaving the table as it was', () => {
    const table = PlayTable.start(
      game.withCard(ghoul, blankEnemy('ghoul', { damage: 1 }), engagedWith(alice)),
    );
    table.nextPhase();
    table.startTurn(alice);
    const stateBefore = table.state;
    const eventsBefore = table.events;

    expect(() => table.investigate(alice)).toThrow(/takeAttackOfOpportunity/);

    expect(table.state).toBe(stateBefore);
    expect(table.events).toEqual(eventsBefore);
  });

  it('does not resolve the test of an investigator who has none open', () => {
    const table = PlayTable.start(game.withInvestigator(bob, { locationId: study }));
    table.investigate(alice, { result: 'open' });

    expect(() => table.resolveTest('pass', { for: bob })).toThrow(
      /open skill test for bob, found 0/,
    );
    table.resolveTest('pass', { for: alice });

    expect(table.board.investigator(alice).clues).toBe(1);
  });

  it('fails when no skill test is open', () => {
    const table = PlayTable.start(game);

    expect(() => table.resolveTest('pass')).toThrow(
      /expected exactly one open skill test, found 0/,
    );
  });
});

describe('fighting and evading', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'))
    .withInvestigator(alice, { locationId: study })
    .withCard(ghoul, blankEnemy('ghoul', { health: fixed(4) }), engagedWith(alice));

  it('deals the basic attack on a pass by default', () => {
    const table = PlayTable.start(game);

    table.fight(alice, byName('ghoul'));

    expect(table.board.enemy(byName('ghoul'))).toMatchObject({ damage: 1 });
  });

  it('deals the damage the players confirm', () => {
    const table = PlayTable.start(game);

    table.fight(alice, byName('ghoul'), { damage: 3 });

    expect(table.board.enemy(byName('ghoul'))).toMatchObject({ damage: 3 });
  });

  it('deals no damage on a fail', () => {
    const table = PlayTable.start(game);

    table.fight(alice, byName('ghoul'), { result: 'fail' });

    expect(table.board.enemy(byName('ghoul')).damage).toBeUndefined();
    expect(table.board.decisions).toEqual([]);
  });

  it('exhausts and disengages an enemy that is evaded', () => {
    const table = PlayTable.start(game);

    table.evade(alice, byName('ghoul'));

    expect(table.board.enemy(byName('ghoul'))).toEqual({
      name: 'ghoul',
      at: 'study',
      exhausted: true,
    });
  });

  it('leaves a failed evade without exhausting the enemy', () => {
    const table = PlayTable.start(game);

    table.evade(alice, byName('ghoul'), { result: 'fail' });

    expect(table.board.enemy(byName('ghoul'))).toMatchObject({ engagedWith: alice });
    expect(table.board.enemy(byName('ghoul')).exhausted).toBeUndefined();
  });

  it('switches an enemy to the investigator who engages it', () => {
    const table = PlayTable.start(game.withInvestigator(bob, { locationId: study }));

    table.engage(bob, byName('ghoul'));

    expect(table.board.enemy(byName('ghoul'))).toMatchObject({ engagedWith: bob });
  });

  describe('with two ghouls', () => {
    const ghoulCard = blankEnemy('ghoul', { health: fixed(3) });
    const twoGhouls = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withInvestigator(bob, { locationId: study })
      .withCard(instanceId('ghoul_a'), ghoulCard, engagedWith(alice))
      .withCard(instanceId('ghoul_b'), ghoulCard, engagedWith(bob));

    it('refuses a name that matches both, listing the narrowings', () => {
      const table = PlayTable.start(twoGhouls);

      expect(() => table.fight(alice, byName('ghoul'))).toThrow(
        /2 enemies match named "ghoul".*narrow it/s,
      );
    });

    it('takes an enemy matcher or a bare instance id to pick one', () => {
      const table = PlayTable.start(twoGhouls);

      table.fight(alice, enemyMatching(byName('ghoul'), { engagedWith: alice }));
      table.fight(bob, instanceId('ghoul_b'));

      expect(table.board.enemies).toEqual([
        { name: 'ghoul', at: 'study', engagedWith: alice, damage: 1 },
        { name: 'ghoul', at: 'study', engagedWith: bob, damage: 1 },
      ]);
    });
  });
});

describe('answering decisions', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withInvestigator(alice, { locationId: study });

  it('answers the decision about a card by the option shown', () => {
    const table = PlayTable.start(game);
    table.investigate(alice, { result: 'open' });

    table.answer(byName('study'), 'pass');

    expect(table.board.investigator(alice).clues).toBe(1);
  });

  it('confirms an amount where the option takes one', () => {
    const table = PlayTable.start(game);
    table.investigate(alice, { result: 'open' });

    table.answer(byName('study'), 'pass', { amount: 2 });

    expect(table.board.investigator(alice).clues).toBe(2);
  });

  it('answers the only open decision without naming its card', () => {
    const table = PlayTable.start(game);
    table.investigate(alice, { result: 'open' });

    table.answerOnly('fail');

    expect(table.board.decisions).toEqual([]);
    expect(table.board.investigator(alice).clues).toBe(0);
  });

  it('fails with the decision shown when the option is not offered', () => {
    const table = PlayTable.start(game);
    table.investigate(alice, { result: 'open' });

    expect(() => table.answer(byName('study'), 'maybe')).toThrow(
      /no option maybe in: .*pass.*fail/,
    );
  });

  it('fails when no decision is about the card', () => {
    const table = PlayTable.start(game);
    table.investigate(alice, { result: 'open' });

    expect(() => table.answer(byName('ghoul'), 'pass')).toThrow(
      /expected exactly one open decision about a card named "ghoul", found 0/,
    );
  });

  it('fails to answer the only decision when none is open', () => {
    const table = PlayTable.start(game);

    expect(() => table.answerOnly('pass')).toThrow(/open decision, found 0/);
  });

  describe('with an attack of opportunity open from each of two ghouls', () => {
    const ghoulCard = blankEnemy('ghoul', { damage: 1 });
    const twoGhoulsOnAlice = newGame()
      .withLocation(study, blankLocation('study'))
      .withLocation(hallway, blankLocation('hallway'))
      .withConnection(study, hallway)
      .withInvestigator(alice, { locationId: study })
      .withCard(instanceId('ghoul_a'), ghoulCard, engagedWith(alice))
      .withCard(instanceId('ghoul_b'), ghoulCard, engagedWith(alice));

    it('refuses to answer "the only" decision or a name that fits both', () => {
      const table = PlayTable.start(twoGhoulsOnAlice);
      table.nextPhase();
      table.startTurn(alice);
      table.moveTo(alice, byName('hallway'));

      expect(() => table.answerOnly('attack')).toThrow(/open decision, found 2/);
      expect(() => table.answer(byName('ghoul'), 'attack')).toThrow(
        /open decision about a card named "ghoul", found 2/,
      );
    });

    it('answers by instance id', () => {
      const table = PlayTable.start(twoGhoulsOnAlice);
      table.nextPhase();
      table.startTurn(alice);
      table.moveTo(alice, byName('hallway'));

      table.answer(instanceId('ghoul_b'), 'attack');

      expect(table.board.investigator(alice).damage).toBe(1);
      expect(table.board.decisions).toMatchObject([{ about: 'ghoul' }]);
    });
  });

  it('reports a test failed by a margin', () => {
    const table = PlayTable.start(game);
    table.play({
      type: 'RequestDecision',
      decision: skillTestDecision(
        {
          id: decisionId('crypt_chill'),
          prompt: 'decision.cryptChill',
          decider: { kind: 'investigator', investigatorId: alice },
          test: { skill: 'willpower', difficulty: 4 },
        },
        {
          onPass: [],
          onFail: [],
          failedBy: {
            2: [{ type: 'AdjustInvestigator', investigatorId: alice, stat: 'horror', delta: 2 }],
          },
        },
      ),
    });

    table.resolveTest({ failedBy: 2 });

    expect(table.board.investigator(alice).horror).toBe(2);
    expect(table.events).toContainEqual(
      expect.objectContaining({ type: 'SkillTestResolved', outcome: 'fail', failedBy: 2 }),
    );
  });
});

describe('undo', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
    .withInvestigator(alice, { locationId: study });

  it('takes back the last command with everything it caused', () => {
    const table = PlayTable.start(game);
    table.takeDamage(alice, 1);
    const stateBefore = table.state;
    const eventsBefore = table.events;
    table.takeHorror(alice, 2);

    table.undo();

    expect(table.state).toEqual(stateBefore);
    expect(table.events).toEqual(eventsBefore);
  });

  it('takes back an action together with its skill test', () => {
    const table = PlayTable.start(game);
    const stateBefore = table.state;
    table.investigate(alice);

    table.undo();

    expect(table.state).toEqual(stateBefore);
  });

  it('takes back several verbs played as one step together', () => {
    const table = PlayTable.start(game);
    const stateBefore = table.state;
    table.step(() => {
      table.takeDamage(alice, 1);
      table.takeHorror(alice, 1);
    });

    table.undo();

    expect(table.state).toEqual(stateBefore);
  });

  it('keeps nothing of a step whose second verb is refused', () => {
    const table = PlayTable.start(game);
    const stateBefore = table.state;

    expect(() =>
      table.step(() => {
        table.takeDamage(alice, 1);
        table.endTurn(alice);
      }),
    ).toThrow(TableRejected);

    expect(table.state).toBe(stateBefore);
    expect(table.canUndo).toBe(false);
  });

  it('refuses to take back the start', () => {
    const table = PlayTable.start(game);
    const stateBefore = table.state;

    expect(() => table.undo()).toThrow(TableError);
    expect(() => table.undo()).toThrow(/nothing to undo/);

    expect(table.state).toBe(stateBefore);
  });
});

describe('naming an investigator by a matcher', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'))
    .withLocation(hallway, blankLocation('hallway'))
    .withConnection(study, hallway)
    .withInvestigator(alice, { locationId: study })
    .withInvestigator(bob, { locationId: study });

  it.each([
    { ref: byName('Alice'), step: (table: PlayTable) => table.startTurn(byName('Alice')) },
    { ref: byAny('alice'), step: (table: PlayTable) => table.startTurn(byAny('alice')) },
    { ref: alice, step: (table: PlayTable) => table.startTurn(alice) },
  ])('starts a turn with $ref', ({ step }) => {
    const table = PlayTable.start(game);
    table.nextPhase();

    step(table);

    expect(table.board.turn).toBe(alice);
  });

  it.each([
    {
      step: 'moveTo',
      act: (table: PlayTable) => table.moveTo(byName('Alice'), byName('hallway')),
      expected: { at: 'hallway' },
    },
    {
      step: 'moveTo to a bare location id',
      act: (table: PlayTable) => table.moveTo(byName('Alice'), hallway),
      expected: { at: 'hallway' },
    },
    {
      step: 'gainResources',
      act: (table: PlayTable) => table.gainResources(byName('Alice'), 3),
      expected: { resources: 8 },
    },
    {
      step: 'spendResources',
      act: (table: PlayTable) => table.spendResources(byName('Alice'), 2),
      expected: { resources: 3 },
    },
    {
      step: 'takeDamage',
      act: (table: PlayTable) => table.takeDamage(byName('Alice'), 2),
      expected: { damage: 2 },
    },
    {
      step: 'takeHorror',
      act: (table: PlayTable) => table.takeHorror(byName('Alice'), 1),
      expected: { horror: 1 },
    },
    {
      step: 'spendAction',
      act: (table: PlayTable) => table.spendAction(byName('Alice')),
      expected: { actions: 2 },
    },
  ])('$step accepts byName for the investigator', ({ act, expected }) => {
    const table = PlayTable.start(game);
    table.nextPhase();
    table.startTurn(alice);

    act(table);

    expect(table.board.investigator(alice)).toMatchObject(expected);
  });

  it('fails with the board when the name matches no investigator', () => {
    const table = PlayTable.start(game);

    expect(() => table.startTurn(byName('Carol'))).toThrow(/^no investigator named "Carol"\n/);
  });
});

describe('resuming a stored log', () => {
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withInvestigator(alice, { locationId: study });

  it("goes on from the log's state and keeps its undo groups", () => {
    const played = PlayTable.start(game);
    played.takeDamage(alice, 1);
    const afterStart = PlayTable.start(game).state;

    const resumed = PlayTable.resume(played.ctx, played.entries);
    resumed.takeHorror(alice, 2);
    resumed.undo();
    resumed.undo();

    expect(resumed.state).toEqual(afterStart);
  });

  it('starts a new undo group after a log with undone steps', () => {
    const played = PlayTable.start(game);
    played.takeDamage(alice, 1);
    played.takeDamage(alice, 1);
    played.undo();
    played.takeHorror(alice, 1);
    const beforeResume = played.state;

    const resumed = PlayTable.resume(played.ctx, played.entries);
    resumed.takeHorror(alice, 1);
    resumed.takeHorror(alice, 1);
    resumed.undo();
    resumed.undo();

    expect(resumed.state).toEqual(beforeResume);
  });
});
