import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  checkInvariants,
  decisionId,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  type BuiltGame,
  type Command,
  type GameBuilder,
  type GameState,
  type InstanceId,
  type Zone,
} from './index';
import { rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');

const hunter = instanceId('hunter');

/** Every place of the map diagrams (named by letter in each test) is this location. */
const location = blankLocation('location');
const hunterGhoul = blankEnemy('hunter_ghoul', { keywords: [{ name: 'hunter' }] });
const mostCluesPreyHunter = blankEnemy('most_clues_prey_hunter', {
  keywords: [{ name: 'hunter' }, { name: 'prey', detail: 'Most clues' }],
});
const aloofHunter = blankEnemy('aloof_hunter', {
  keywords: [{ name: 'hunter' }, { name: 'aloof' }],
});
/** An enemy without the hunter keyword. */
const plainGhoul = blankEnemy('plain_ghoul');

/** Unengaged at the place named `place` of the map diagram. */
const at = (place: string): Zone => atLocation(instanceId(place));
const moveHunters: Command = { type: 'MoveHunters' };

const zoneOf = (state: GameState, cardId: InstanceId): Zone | undefined =>
  state.cards[cardId]?.zone;

/** A table of unconnected places: each name is the instance ID of a `location`. */
function places(...names: string[]): GameBuilder {
  return names.reduce((game, name) => game.withLocation(instanceId(name), location), newGame());
}

/** The places `names` in a row, each joined to the next by an undirected connection. */
function line(...names: string[]): GameBuilder {
  return names
    .slice(1)
    .reduce(
      (game, name, i) => game.withConnection(instanceId(names[i] ?? name), instanceId(name)),
      places(...names),
    );
}

/** A diamond a-b-d and a-c-d: two equally short routes from a to d. */
const fork = places('a', 'b', 'c', 'd')
  .withConnection(instanceId('a'), instanceId('b'))
  .withConnection(instanceId('a'), instanceId('c'))
  .withConnection(instanceId('b'), instanceId('d'))
  .withConnection(instanceId('c'), instanceId('d'));

/** a joined to b and to c: investigators at b and c are equally near a hunter at a, apart. */
const split = places('a', 'b', 'c')
  .withConnection(instanceId('a'), instanceId('b'))
  .withConnection(instanceId('a'), instanceId('c'));

describe('MoveHunters', () => {
  it('moves a hunter one step along the path to the investigator', () => {
    const { context, state } = line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const { state: after, events } = execute(context, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  it.each([
    {
      name: 'engages the investigator when it arrives',
      card: hunterGhoul,
      zone: engagedWith(alice),
    },
    { name: 'does not engage an aloof hunter on arrival', card: aloofHunter, zone: at('b') },
  ])('$name', ({ card, zone }) => {
    const { context, state } = line('a', 'b')
      .withInvestigator(alice, { locationId: instanceId('b') })
      .withCard(hunter, card, at('a'))
      .start();

    const { state: after } = execute(context, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(zone);
  });

  it.each([
    {
      name: 'shares a location with an investigator',
      table: line('a', 'b')
        .withInvestigator(alice, { locationId: instanceId('b') })
        .withInvestigator(bob, { locationId: instanceId('a') }),
    },
    {
      name: 'cannot reach anyone',
      table: places('a', 'b').withInvestigator(alice, { locationId: instanceId('b') }),
    },
    {
      name: 'is cut off by a one-way connection',
      table: places('a', 'b')
        .withConnection(instanceId('b'), instanceId('a'), { oneWay: true })
        .withInvestigator(alice, { locationId: instanceId('b') }),
    },
  ])('does not move a hunter that $name', ({ table }) => {
    const { context, state } = table.withCard(hunter, hunterGhoul, at('a')).start();

    expect(execute(context, state, moveHunters).events).toEqual([]);
  });

  it('does not move exhausted, engaged or non-hunter enemies', () => {
    const { context, state } = line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(instanceId('tired_hunter'), hunterGhoul, at('a'))
      .withCard(instanceId('engaged_hunter'), hunterGhoul, engagedWith(alice))
      .withCard(instanceId('plain_ghoul'), plainGhoul, at('a'))
      .start();
    const exhausted = stateAfter(context, state, {
      type: 'ExhaustEnemy',
      enemyId: instanceId('tired_hunter'),
    });

    expect(execute(context, exhausted, moveHunters).events).toEqual([]);
  });

  it('heads for the nearest investigator', () => {
    const { context, state } = line('x', 'far', 'a', 'near')
      .withInvestigator(alice, { locationId: instanceId('x') })
      .withInvestigator(bob, { locationId: instanceId('near') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const { state: after } = execute(context, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
  });

  it('moves the same way when equally near investigators share the first step', () => {
    const { context, state } = places('a', 'b', 'c', 'd')
      .withConnection(instanceId('a'), instanceId('b'))
      .withConnection(instanceId('b'), instanceId('c'))
      .withConnection(instanceId('b'), instanceId('d'))
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withInvestigator(bob, { locationId: instanceId('d') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const { state: after, events } = execute(context, state, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(at('b'));
    expect(events.map((e) => e.type)).toEqual(['CardMoved']);
  });

  describe('ties', () => {
    it('asks for the destination when two shortest paths differ', () => {
      const { context, state } = fork
        .withInvestigator(alice, { locationId: instanceId('d') })
        .withCard(hunter, hunterGhoul, at('a'))
        .start();

      const { state: after } = execute(context, state, moveHunters);

      expect(zoneOf(after, hunter)).toEqual(at('a'));
      expect(after.pending).toMatchObject([
        { kind: 'chooseLocation', subject: hunter, options: [{ target: 'b' }, { target: 'c' }] },
      ]);
    });

    it('rejects another hunter move while the question is open', () => {
      const { context, state } = fork
        .withInvestigator(alice, { locationId: instanceId('d') })
        .withCard(hunter, hunterGhoul, at('a'))
        .start();
      const asked = stateAfter(context, state, moveHunters);

      const rejection = rejectionFrom(context, asked, moveHunters);

      expect(rejection).toEqual({
        code: 'decisionPending',
        decisionId: decisionId('hunter:hunter:location'),
      });
    });

    it('moves the hunter to the location the players chose', () => {
      const { context, state } = fork
        .withInvestigator(alice, { locationId: instanceId('d') })
        .withCard(hunter, hunterGhoul, at('a'))
        .start();
      const asked = stateAfter(context, state, moveHunters);

      const after = stateAfter(context, asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('hunter:hunter:location'),
        optionId: 'c',
      });

      expect(zoneOf(after, hunter)).toEqual(at('c'));
      expect(after.pending).toEqual([]);
    });

    it('asks which investigator to hunt when equally near investigators lead apart', () => {
      const { context, state } = split
        .withInvestigator(alice, { locationId: instanceId('b') })
        .withInvestigator(bob, { locationId: instanceId('c') })
        .withCard(hunter, hunterGhoul, at('a'))
        .start();

      const { state: after } = execute(context, state, moveHunters);

      expect(after.pending).toMatchObject([
        {
          kind: 'chooseInvestigator',
          subject: hunter,
          options: [{ target: alice }, { target: bob }],
        },
      ]);
    });

    it('engages the investigator the players chose when the hunter can reach them', () => {
      const { context, state } = split
        .withInvestigator(alice, { locationId: instanceId('b') })
        .withInvestigator(bob, { locationId: instanceId('c') })
        .withCard(hunter, hunterGhoul, at('a'))
        .start();
      const asked = stateAfter(context, state, moveHunters);

      const after = stateAfter(context, asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('hunter:hunter:investigator'),
        optionId: bob,
      });

      expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
    });

    it('lets prey pick between equally near investigators', () => {
      const { context, state } = split
        .withInvestigator(alice, { locationId: instanceId('b'), clues: 1 })
        .withInvestigator(bob, { locationId: instanceId('c'), clues: 2 })
        .withCard(hunter, mostCluesPreyHunter, at('a'))
        .start();

      const { state: after } = execute(context, state, moveHunters);

      expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
    });

    it('asks for the destination after prey picked one investigator with two routes', () => {
      const { context, state } = fork
        .withInvestigator(alice, { locationId: instanceId('d'), clues: 1 })
        .withInvestigator(bob, { locationId: instanceId('d'), clues: 1 })
        .withCard(hunter, mostCluesPreyHunter, at('a'))
        .start();

      const { state: after } = execute(context, state, moveHunters);

      expect(after.pending).toMatchObject([{ kind: 'chooseLocation', subject: hunter }]);
    });
  });
});

describe('MoveHunters order', () => {
  const first = instanceId('first_hunter');
  const second = instanceId('second_hunter');
  /** a - b - c with alice at c: a hunter at a and one at b both have a step to take. */
  const twoHunters = () =>
    line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(first, hunterGhoul, at('a'))
      .withCard(second, hunterGhoul, at('b'))
      .start();

  it('asks the lead investigator for the order when two hunters would move, and moves none', () => {
    const { context, state } = twoHunters();

    const { state: after, events } = execute(context, state, moveHunters);

    expect(events.map((e) => e.type)).toEqual(['DecisionRequested']);
    expect(after.pending).toMatchObject([
      {
        id: 'hunterOrder',
        kind: 'chooseCard',
        decider: { kind: 'lead' },
        options: [
          { id: first, target: first },
          { id: second, target: second },
        ],
      },
    ]);
    expect(zoneOf(after, first)).toEqual(at('a'));
    expect(zoneOf(after, second)).toEqual(at('b'));
  });

  it('rejects another hunter move while the order question is open', () => {
    const { context, state } = twoHunters();
    const asked = stateAfter(context, state, moveHunters);

    const rejection = rejectionFrom(context, asked, moveHunters);

    expect(rejection).toEqual({ code: 'decisionPending', decisionId: decisionId('hunterOrder') });
  });

  it('moves a single hunter directly when no other hunter would move', () => {
    const { context, state } = line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(first, hunterGhoul, at('a'))
      .withCard(second, hunterGhoul, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, moveHunters);

    expect(zoneOf(after, first)).toEqual(at('b'));
    expect(after.pending).toEqual([]);
  });

  it('skips a hunter that has an open decision about itself', () => {
    const waiting = instanceId('waiting_hunter');
    const { context, state } = line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(waiting, hunterGhoul, at('a'))
      .withCard(second, hunterGhoul, at('b'))
      .start();
    const aboutWaiting: Command = {
      type: 'RequestDecision',
      decision: {
        id: decisionId('about_waiting_hunter'),
        kind: 'confirm',
        subject: waiting,
        prompt: 'Does the waiting hunter stay?',
        decider: { kind: 'group' },
        options: [{ id: 'yes', label: 'Yes', commands: [] }],
      },
    };
    // The follow-up commands of an answer run while the new question is open, unlike commands from outside.
    const asked = stateAfter(context, state, {
      type: 'RequestDecision',
      decision: {
        id: decisionId('start_hunting'),
        kind: 'confirm',
        prompt: 'Start hunting?',
        decider: { kind: 'group' },
        options: [{ id: 'yes', label: 'Yes', commands: [aboutWaiting, moveHunters] }],
      },
    });

    const after = stateAfter(context, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('start_hunting'),
      optionId: 'yes',
    });

    expect(zoneOf(after, second)).toEqual(engagedWith(alice));
    expect(zoneOf(after, waiting)).toEqual(at('a'));
    expect(after.pending.map((decision) => decision.id)).toEqual(['about_waiting_hunter']);
  });

  it('considers only the listed hunters, as the answer to the order question does', () => {
    const { context, state } = twoHunters();

    const afterFirst = stateAfter(context, state, { type: 'MoveHunters', hunters: [first] });
    const afterBoth = stateAfter(context, afterFirst, { type: 'MoveHunters', hunters: [second] });

    expect(zoneOf(afterFirst, first)).toEqual(at('b'));
    expect(zoneOf(afterFirst, second)).toEqual(at('b'));
    expect(zoneOf(afterBoth, first)).toEqual(at('b'));
    expect(zoneOf(afterBoth, second)).toEqual(engagedWith(alice));
  });
});

describe('answering the hunter order', () => {
  const first = instanceId('first_hunter');
  const second = instanceId('second_hunter');
  const third = instanceId('third_hunter');
  const chooseOrder = (hunterId: InstanceId): Command => ({
    type: 'ResolveDecision',
    decisionId: decisionId('hunterOrder'),
    optionId: hunterId,
  });
  /** a - b - c with alice at c: the hunters at a and at b both have a step to take. */
  const twoHunters = () =>
    line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(first, hunterGhoul, at('a'))
      .withCard(second, hunterGhoul, at('b'))
      .start();
  /** a - b - c - d with alice at d: the hunters at a, b and c all have a step to take. */
  const threeHunters = () =>
    line('a', 'b', 'c', 'd')
      .withInvestigator(alice, { locationId: instanceId('d') })
      .withCard(first, hunterGhoul, at('a'))
      .withCard(second, hunterGhoul, at('b'))
      .withCard(third, hunterGhoul, at('c'))
      .start();

  it('moves the chosen hunter, which engages on arrival, then the other one, in one event list', () => {
    const { context, state } = twoHunters();
    const asked = stateAfter(context, state, moveHunters);

    const { state: after, events } = execute(context, asked, chooseOrder(second));

    expect(zoneOf(after, second)).toEqual(engagedWith(alice));
    expect(zoneOf(after, first)).toEqual(at('b'));
    expect(after.pending).toEqual([]);
    expect(events.map((e) => e.type)).toEqual([
      'DecisionResolved',
      'CardMoved',
      'EnemyEngaged',
      'CardMoved',
    ]);
  });

  it('lets the first hunter go first when the lead chooses it', () => {
    const { context, state } = twoHunters();
    const asked = stateAfter(context, state, moveHunters);

    const after = stateAfter(context, asked, chooseOrder(first));

    expect(zoneOf(after, first)).toEqual(at('b'));
    expect(zoneOf(after, second)).toEqual(engagedWith(alice));
  });

  it('asks the order of the remaining hunters again after the first choice', () => {
    const { context, state } = threeHunters();
    const asked = stateAfter(context, state, moveHunters);

    const askedAgain = stateAfter(context, asked, chooseOrder(second));

    expect(asked.pending[0]?.options.map((option) => option.id)).toEqual([first, second, third]);
    expect(zoneOf(askedAgain, second)).toEqual(at('c'));
    expect(zoneOf(askedAgain, first)).toEqual(at('a'));
    expect(askedAgain.pending[0]?.options.map((option) => option.id)).toEqual([first, third]);
  });

  it('moves every hunter exactly once after two rounds of questions', () => {
    const { context, state } = threeHunters();
    const asked = stateAfter(context, state, moveHunters);

    const after = stateAfter(context, asked, chooseOrder(second), chooseOrder(third));

    expect(zoneOf(after, second)).toEqual(at('c'));
    expect(zoneOf(after, third)).toEqual(engagedWith(alice));
    expect(zoneOf(after, first)).toEqual(at('b'));
    expect(after.pending).toEqual([]);
  });

  it("still raises the chosen hunter's own tie decision and moves the others", () => {
    const forked = instanceId('forked_hunter');
    const { context, state } = fork
      .withInvestigator(alice, { locationId: instanceId('d') })
      .withCard(forked, hunterGhoul, at('a'))
      .withCard(second, hunterGhoul, at('b'))
      .start();
    const asked = stateAfter(context, state, moveHunters);

    const after = stateAfter(context, asked, chooseOrder(forked));

    expect(zoneOf(after, forked)).toEqual(at('a'));
    expect(zoneOf(after, second)).toEqual(engagedWith(alice));
    expect(after.pending.map((decision) => decision.id)).toEqual(['hunter:forked_hunter:location']);
  });
});

describe('MoveHunter', () => {
  const engaged = instanceId('engaged_hunter');
  const ghoul = instanceId('plain_ghoul');
  const layout = (): BuiltGame =>
    fork
      .withInvestigator(alice, { locationId: instanceId('d') })
      .withCard(hunter, hunterGhoul, at('a'))
      .withCard(engaged, hunterGhoul, engagedWith(alice))
      .withCard(ghoul, plainGhoul, at('a'))
      .start();

  it.each([
    { name: 'an engaged enemy', enemyId: engaged, to: 'b', code: 'notAHunter' },
    { name: 'an unknown card', enemyId: instanceId('nobody'), to: 'b', code: 'unknownCard' },
    {
      name: 'a location that is not connected',
      enemyId: hunter,
      to: 'd',
      code: 'hunterCannotMove',
    },
  ])('rejects moving $name', ({ enemyId, to, code }) => {
    const { context, state } = layout();

    const rejection = rejectionFrom(context, state, {
      type: 'MoveHunter',
      enemyId,
      to: instanceId(to),
    });

    expect(rejection.code).toBe(code);
  });

  it('rejects moving towards an unknown investigator', () => {
    const { context, state } = layout();

    const rejection = rejectionFrom(context, state, {
      type: 'MoveHunter',
      enemyId: hunter,
      towards: investigatorId('nobody'),
    });

    expect(rejection.code).toBe('unknownInvestigator');
  });

  it('rejects moving towards an investigator the hunter cannot reach', () => {
    const { context, state } = places('a', 'b')
      .withInvestigator(alice, { locationId: instanceId('b') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const rejection = rejectionFrom(context, state, {
      type: 'MoveHunter',
      enemyId: hunter,
      towards: alice,
    });

    expect(rejection.code).toBe('noRoute');
  });

  it('takes the only step towards an investigator', () => {
    const { context, state } = line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const after = stateAfter(context, state, {
      type: 'MoveHunter',
      enemyId: hunter,
      towards: alice,
    });

    expect(zoneOf(after, hunter)).toEqual(at('b'));
  });

  it('moves along its own rule when given neither a location nor an investigator', () => {
    const { context, state } = line('a', 'b', 'c')
      .withInvestigator(alice, { locationId: instanceId('c') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const after = stateAfter(context, state, { type: 'MoveHunter', enemyId: hunter });

    expect(zoneOf(after, hunter)).toEqual(at('b'));
  });

  it('asks the players when its own rule leaves a tie', () => {
    const { context, state } = fork
      .withInvestigator(alice, { locationId: instanceId('d') })
      .withCard(hunter, hunterGhoul, at('a'))
      .start();

    const after = stateAfter(context, state, { type: 'MoveHunter', enemyId: hunter });

    expect(after.pending.map((decision) => decision.id)).toEqual(['hunter:hunter:location']);
  });
});

describe('MoveHunters routes', () => {
  it.each([
    {
      name: 'a line',
      table: line('a', 'b', 'c', 'd').withInvestigator(alice, { locationId: instanceId('d') }),
      zone: at('b'),
    },
    {
      name: 'a cycle where alice is one step away and bob two',
      table: line('a', 'b', 'c', 'd')
        .withConnection(instanceId('d'), instanceId('a'))
        .withInvestigator(alice, { locationId: instanceId('b') })
        .withInvestigator(bob, { locationId: instanceId('c') }),
      zone: engagedWith(alice),
    },
    {
      name: 'a one-way shortcut from the hunter to alice',
      table: line('a', 'b', 'c', 'd')
        .withConnection(instanceId('a'), instanceId('d'), { oneWay: true })
        .withInvestigator(alice, { locationId: instanceId('d') }),
      zone: engagedWith(alice),
    },
    {
      name: 'a map where bob cannot be reached',
      table: line('a', 'b')
        .withLocation(instanceId('e'), location)
        .withInvestigator(alice, { locationId: instanceId('b') })
        .withInvestigator(bob, { locationId: instanceId('e') }),
      zone: engagedWith(alice),
    },
  ])('on $name the hunter ends at $zone', ({ table, zone }) => {
    const { context, state: before } = table.withCard(hunter, hunterGhoul, at('a')).start();

    const after = stateAfter(context, before, moveHunters);

    expect(zoneOf(after, hunter)).toEqual(zone);
    expect(checkInvariants(after)).toEqual([]);
  });
});
