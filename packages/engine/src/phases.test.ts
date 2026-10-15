import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  checkInvariants,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  playerOrder,
  type Command,
  type EngineContext,
  type GameState,
  type Investigator,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  fixed,
  makeCard,
  makeInvestigator,
  rejectionOf as rejectionFrom,
  runFrom,
  startBoard,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const id = instanceId;

const ctx = contextWith(
  makeCard({ code: 'AG1', typeCode: 'agenda', stage: { number: 1 }, doom: fixed(2) }),
  makeCard({ code: 'AG2', typeCode: 'agenda', stage: { number: 2 }, doom: fixed(9) }),
  makeCard({ code: 'ACT', typeCode: 'act', stage: { number: 1 }, clues: fixed(1) }),
  makeCard({ code: 'ACT2', typeCode: 'act', stage: { number: 2 } }),
  makeCard({ code: 'LOC', typeCode: 'location', shroud: 2 }),
  makeCard({
    code: 'HNT',
    typeCode: 'enemy',
    damage: 1,
    horror: 2,
    keywords: [{ name: 'hunter' }],
  }),
  makeCard({ code: 'FOE', typeCode: 'enemy', damage: 2, horror: 1 }),
  makeCard({
    code: 'BIG',
    typeCode: 'enemy',
    damage: 1,
    horror: 0,
    keywords: [{ name: 'massive' }],
  }),
  makeCard({ code: 'SPN', typeCode: 'enemy', keywords: [{ name: 'spawn', detail: 'LOC' }] }),
  makeCard({ code: 'SRG', keywords: [{ name: 'surge' }] }),
  makeCard({ code: 'TRE' }),
);

/** An investigator standing at `location`; seats give the player order. */
function investigator(
  who: 'alice' | 'bob' | 'carol',
  location: string,
  overrides: Partial<Omit<Investigator, 'id'>> = {},
): Investigator {
  const seats = { alice: 0, bob: 1, carol: 2 };
  return makeInvestigator({ id: who, seat: seats[who], locationId: id(location), ...overrides });
}

/**
 * Locations `a` - `b` - `c` in a line, agendas AG1 (2 doom) and AG2 (9 doom),
 * acts ACT (1 clue) and ACT2; `cards` by instance ID. The encounter deck is
 * not shuffled, so the draw order is the order of `cards`.
 */
function started(
  investigators: Investigator[],
  cards: Record<string, { code: string; zone: Zone }> = {},
): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { a: 'LOC', b: 'LOC', c: 'LOC' },
        connections: [edge('a', 'b'), edge('b', 'c')],
      },
    },
    investigators,
    shuffleEncounterDeck: false,
    cards: {
      ag1: { code: 'AG1', zone: { kind: 'agendaDeck' } },
      ag2: { code: 'AG2', zone: { kind: 'agendaDeck' } },
      act: { code: 'ACT', zone: { kind: 'actDeck' } },
      act2: { code: 'ACT2', zone: { kind: 'actDeck' } },
      ...cards,
    },
  });
}

const at = (place: string): Zone => ({ kind: 'atLocation', locationId: id(place) });
const engagedWith = (who: typeof alice): Zone => ({ kind: 'engaged', investigatorId: who });
const deck: Zone = { kind: 'encounterDeck' };
const next: Command = { type: 'NextPhase' };

function run(state: GameState, ...commands: Command[]): GameState {
  return runFrom(ctx, state, commands).state;
}

/** `count` times `NextPhase`. */
function nextPhases(state: GameState, count: number, context: EngineContext = ctx): GameState {
  const commands = Array.from({ length: count }, () => next);
  return runFrom(context, state, commands).state;
}

function rejectionOf(state: GameState, command: Command) {
  return rejectionFrom(() => execute(ctx, state, command));
}

function answer(state: GameState, decision: string, option: string): GameState {
  return run(state, {
    type: 'ResolveDecision',
    decisionId: decisionId(decision),
    optionId: option,
  });
}

function codesDrawn(before: GameState, command: Command): string[] {
  return execute(ctx, before, command)
    .events.filter((e) => e.type === 'EncounterCardDrawn')
    .map((e) => `${e.investigatorId}:${e.cardId}`);
}

describe('NextPhase', () => {
  it('starts round 1 with the investigation phase, skipping its mythos phase', () => {
    const state = started([investigator('alice', 'a')], { t1: { code: 'TRE', zone: deck } });

    const after = nextPhases(state, 1);

    expect(after.meta).toMatchObject({ round: 1, phase: 'investigation', steps: [] });
    expect(after.cards[id('ag1')]?.tokens.doom).toBeUndefined();
    expect(after.cards[id('t1')]?.zone).toEqual(deck);
  });

  it('walks investigation, enemy and upkeep within a round, then starts the next with mythos', () => {
    const state = started([investigator('alice', 'a')]);

    const phases = [1, 2, 3, 4].map((count) => nextPhases(state, count).meta);

    expect(phases.map((meta) => [meta.round, meta.phase])).toEqual([
      [1, 'investigation'],
      [1, 'enemy'],
      [1, 'upkeep'],
      [2, 'mythos'],
    ]);
  });

  it('is rejected while a decision is pending', () => {
    const state = run(started([investigator('alice', 'a')]), {
      type: 'Investigate',
      investigatorId: alice,
    });

    expect(rejectionOf(state, next).code).toBe('decisionPending');
  });
});

describe('mythos phase', () => {
  it('places 1 doom on the agenda and lets each investigator draw in player order', () => {
    const state = started([investigator('alice', 'a'), investigator('bob', 'a')], {
      t1: { code: 'TRE', zone: deck },
      t2: { code: 'TRE', zone: deck },
    });
    const upkeep = nextPhases(state, 3);

    const draws = codesDrawn(upkeep, next);
    const mythos = nextPhases(upkeep, 1);

    expect(draws).toEqual(['alice:t1', 'bob:t2']);
    expect(mythos.cards[id('ag1')]?.tokens.doom).toBe(1);
    expect(mythos.meta.steps).toEqual([]);
  });

  it('starts the draws with the lead investigator, then follows the seats', () => {
    const state = started([
      investigator('bob', 'a'),
      investigator('alice', 'a'),
      investigator('carol', 'a'),
    ]);

    expect(playerOrder(state).map((inv) => inv.id)).toEqual(['bob', 'carol', 'alice']);
  });

  it('asks to advance the agenda at the threshold check and draws only after the answer', () => {
    const state = run(started([investigator('alice', 'a')], { t1: { code: 'TRE', zone: deck } }), {
      type: 'PlaceDoom',
      amount: 1,
    });
    const upkeep = nextPhases(state, 3);

    const asked = nextPhases(upkeep, 1);
    const answered = run(asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('advanceAgenda:ag1'),
      optionId: 'yes',
    });
    const draws = codesDrawn(answered, next);
    const resumed = nextPhases(answered, 1);

    expect(asked.pending.map((d) => d.id)).toEqual(['advanceAgenda:ag1']);
    expect(asked.meta.steps).toEqual([{ kind: 'drawEncounter', investigatorId: alice }]);
    expect(answered.agenda.current).toBe('ag2');
    expect(draws).toEqual(['alice:t1']);
    expect(resumed.meta).toMatchObject({ phase: 'mythos', steps: [] });
  });

  it('does not ask when doom reached the threshold before the check only to be removed', () => {
    const state = run(started([investigator('alice', 'a')]), {
      type: 'PlaceDoom',
      amount: 3,
    });
    const removed = run(state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: id('ag1'), token: 'doom', delta: -3 },
    });

    const mythos = nextPhases(removed, 4);

    expect(state.pending).toEqual([]);
    expect(mythos.pending).toEqual([]);
  });

  it('keeps the later draws when a draw raises a decision', () => {
    const state = started([investigator('alice', 'a'), investigator('bob', 'c')], {
      spawner: { code: 'SPN', zone: deck },
      t1: { code: 'TRE', zone: deck },
    });
    const upkeep = nextPhases(state, 3);

    const asked = nextPhases(upkeep, 1);
    const answered = run(asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('spawn:spawner'),
      optionId: 'b',
    });
    const draws = codesDrawn(answered, next);

    expect(asked.pending.map((d) => d.id)).toEqual(['spawn:spawner']);
    expect(draws).toEqual(['bob:t1']);
  });

  it('skips the draws when there is no encounter card left', () => {
    const upkeep = nextPhases(started([investigator('alice', 'a')]), 3);

    const mythos = nextPhases(upkeep, 1);

    expect(mythos.meta).toMatchObject({ round: 2, phase: 'mythos', steps: [] });
  });

  it('skips the draw of an investigator defeated before their turn to draw', () => {
    const state = started(
      [investigator('alice', 'a', { health: { max: 3, damage: 0 } }), investigator('bob', 'a')],
      { t1: { code: 'TRE', zone: deck } },
    );
    const upkeep = run(nextPhases(state, 3), {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 3,
    });

    expect(codesDrawn(upkeep, next)).toEqual(['bob:t1']);
  });
});

describe('enemy phase', () => {
  it('moves hunters and lists the attacks of ready engaged enemies', () => {
    const state = started([investigator('alice', 'a')], { hunter: { code: 'HNT', zone: at('b') } });

    const enemy = nextPhases(state, 2);

    expect(enemy.cards[id('hunter')]?.zone).toEqual(engagedWith(alice));
    expect(enemy.meta.steps).toEqual([
      { kind: 'enemyAttack', enemyId: 'hunter', investigatorId: alice },
    ]);
  });

  it('stops at a hunter decision and lists the attacks once it is answered', () => {
    const state = started([investigator('alice', 'a'), investigator('bob', 'c')], {
      hunter: { code: 'HNT', zone: at('b') },
    });

    const asked = nextPhases(state, 2);
    const answered = answer(asked, 'hunter:hunter:investigator', 'bob');
    const resumed = nextPhases(answered, 1);

    expect(asked.pending.map((d) => d.id)).toEqual(['hunter:hunter:investigator']);
    expect(rejectionOf(asked, next).code).toBe('decisionPending');
    expect(answered.cards[id('hunter')]?.zone).toEqual(engagedWith(bob));
    expect(resumed.meta.steps).toEqual([
      { kind: 'enemyAttack', enemyId: 'hunter', investigatorId: bob },
    ]);
  });

  it('rejects moving on while an attack is due', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: engagedWith(alice) } }),
      2,
    );

    expect(rejectionOf(enemy, next)).toEqual({
      code: 'enemyAttackPending',
      enemyId: 'foe',
      investigatorId: alice,
    });
  });

  it('deals the printed damage and horror of an attack and exhausts the enemy', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: engagedWith(alice) } }),
      2,
    );

    const after = run(enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: id('foe'),
      investigatorId: alice,
    });

    expect(after.investigators[0]).toMatchObject({
      health: { damage: 2 },
      sanity: { horror: 1 },
    });
    expect(after.cards[id('foe')]?.exhausted).toBe(true);
    expect(after.meta.steps).toEqual([]);
  });

  it('deals the reduced amounts the players enter when assets soak part of an attack', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: engagedWith(alice) } }),
      2,
    );

    const after = run(enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: id('foe'),
      investigatorId: alice,
      damage: 0,
      horror: 0,
    });

    expect(after.investigators[0]).toMatchObject({ health: { damage: 0 }, sanity: { horror: 0 } });
    expect(after.cards[id('foe')]?.exhausted).toBe(true);
  });

  it('defeats an investigator once from damage and horror dealt together', () => {
    const enemy = nextPhases(
      started(
        [
          investigator('alice', 'a', {
            health: { max: 3, damage: 2 },
            sanity: { max: 3, horror: 2 },
          }),
        ],
        { foe: { code: 'FOE', zone: engagedWith(alice) } },
      ),
      2,
    );

    const { events } = execute(ctx, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: id('foe'),
      investigatorId: alice,
    });

    expect(events.map((e) => e.type)).toEqual([
      'PhaseStepsChanged',
      'InvestigatorChanged',
      'InvestigatorChanged',
      'InvestigatorDefeated',
      'ExhaustChanged',
    ]);
  });

  it('rejects an attack that is not due', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: at('c') } }),
      2,
    );

    expect(
      rejectionOf(enemy, { type: 'ResolveEnemyAttack', enemyId: id('foe'), investigatorId: alice })
        .code,
    ).toBe('attackNotDue');
  });

  it('rejects a negative amount', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: engagedWith(alice) } }),
      2,
    );

    expect(
      rejectionOf(enemy, {
        type: 'ResolveEnemyAttack',
        enemyId: id('foe'),
        investigatorId: alice,
        damage: -1,
      }),
    ).toEqual({ code: 'invalidAttackAmount', amount: -1 });
  });

  it('exhausts a massive enemy only after it attacked everyone at its location', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a'), investigator('bob', 'a')], {
        giant: { code: 'BIG', zone: at('a') },
      }),
      2,
    );

    const first = run(enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: id('giant'),
      investigatorId: alice,
    });
    const second = run(first, {
      type: 'ResolveEnemyAttack',
      enemyId: id('giant'),
      investigatorId: bob,
    });

    expect(first.cards[id('giant')]?.exhausted).toBe(false);
    expect(second.cards[id('giant')]?.exhausted).toBe(true);
  });

  it('drops an attack whose enemy was evaded or defeated meanwhile', () => {
    const enemy = nextPhases(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: engagedWith(alice) } }),
      2,
    );
    const evaded = run(enemy, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: id('foe'), to: { kind: 'encounterDiscard' } },
    });

    const after = nextPhases(evaded, 1);

    expect(after.meta).toMatchObject({ phase: 'enemy', steps: [] });
  });
});

describe('upkeep phase', () => {
  it('readies exhausted enemies, which engage investigators at their location', () => {
    const state = run(
      started([investigator('alice', 'a')], { foe: { code: 'FOE', zone: at('a') } }),
      { type: 'DisengageEnemy', enemyId: id('foe') },
      { type: 'ExhaustEnemy', enemyId: id('foe') },
    );

    const upkeep = nextPhases(state, 3);

    expect(upkeep.cards[id('foe')]).toMatchObject({
      exhausted: false,
      zone: engagedWith(alice),
    });
  });

  it('gives each active investigator 1 resource', () => {
    const state = run(
      started([
        investigator('alice', 'a', { resources: 0 }),
        investigator('bob', 'a', { resources: 0, sanity: { max: 3, horror: 0 } }),
      ]),
      {
        type: 'AdjustInvestigator',
        investigatorId: bob,
        stat: 'horror',
        delta: 3,
      },
    );

    const upkeep = nextPhases(state, 3);

    expect(upkeep.investigators.map((inv) => inv.resources)).toEqual([1, 0]);
  });

  it('ends the round: fires onRoundEnd and clears the turns taken', () => {
    const hooked: EngineContext = {
      ...ctx,
      hooks: {
        onRoundEnd: (_ctx, _state, event) => [
          { type: 'AdjustInvestigator', investigatorId: alice, stat: 'clues', delta: event.round },
        ],
      },
    };
    const investigation = nextPhases(started([investigator('alice', 'a')]), 1, hooked);
    const turnTaken = runFrom(hooked, investigation, [
      { type: 'EndTurn', investigatorId: alice },
    ]).state;

    const upkeep = nextPhases(turnTaken, 2, hooked);

    expect(turnTaken.meta.turnsTaken).toEqual([alice]);
    expect(upkeep.meta.turnsTaken).toEqual([]);
    expect(upkeep.investigators[0]?.clues).toBe(1);
    expect(upkeep.meta).toMatchObject({ round: 1, phase: 'upkeep', steps: [] });
  });
});

describe('EndTurn', () => {
  it('rejects a second turn in the same round', () => {
    const investigation = nextPhases(started([investigator('alice', 'a')]), 1);
    const turnTaken = run(investigation, { type: 'EndTurn', investigatorId: alice });

    expect(rejectionOf(turnTaken, { type: 'EndTurn', investigatorId: alice })).toEqual({
      code: 'turnAlreadyTaken',
      investigatorId: alice,
    });
  });

  it('rejects ending a turn outside the investigation phase', () => {
    const enemy = nextPhases(started([investigator('alice', 'a')]), 2);

    expect(rejectionOf(enemy, { type: 'EndTurn', investigatorId: alice })).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'enemy',
    });
  });
});

describe('investigation phase', () => {
  it('lets the investigators advance the act during a turn', () => {
    const investigation = run(nextPhases(started([investigator('alice', 'a')]), 1), {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'clues',
      delta: 1,
    });

    const after = run(investigation, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: alice, amount: 1 }],
    });

    expect(after.act.current).toBe('act2');
    expect(after.meta.phase).toBe('investigation');
    expect(checkInvariants(after)).toEqual([]);
  });
});

/** The commands that could move the game on from `state`, in the order a pick rotates through. */
function candidates(state: GameState): Command[] {
  const [decision] = state.pending;
  if (decision)
    return decision.options.map((option) => ({
      type: 'ResolveDecision',
      decisionId: decision.id,
      optionId: option.id,
    }));
  const attacks: Command[] = state.meta.steps.flatMap((step) =>
    step.kind === 'enemyAttack'
      ? [{ type: 'ResolveEnemyAttack', enemyId: step.enemyId, investigatorId: step.investigatorId }]
      : [],
  );
  return [next, ...attacks];
}

/** The state after the first accepted candidate, starting at `pick`; `undefined` if all are rejected. */
function firstAccepted(state: GameState, pick: number): GameState | undefined {
  const commands = candidates(state);
  for (let i = 0; i < commands.length; i++) {
    const command = commands[(pick + i) % commands.length];
    if (!command) continue;
    try {
      return execute(ctx, state, command).state;
    } catch (e) {
      if (!(e instanceof CommandRejected)) throw e;
    }
  }
  return undefined;
}

/**
 * Plays `picks` (one accepted command each, see `candidates`) from `state`;
 * returns every state visited, and whether play got stuck with nothing accepted.
 */
function playThrough(state: GameState, picks: readonly number[]) {
  const states = [state];
  for (const pick of picks) {
    const current = states[states.length - 1] ?? state;
    if (current.meta.resolution !== undefined) break;
    const following = firstAccepted(current, pick);
    if (!following) return { states, stuck: true };
    states.push(following);
  }
  return { states, stuck: false };
}

describe('phase assistant over several rounds', () => {
  const fragile = { health: { max: 4, damage: 0 }, sanity: { max: 4, horror: 0 } };
  const inDeck = (...codes: string[]) =>
    Object.fromEntries(codes.map((code, i) => [`e${i}`, { code, zone: deck }]));

  it.each([
    {
      name: 'a solo investigator always taking the first option',
      investigators: [investigator('alice', 'a', fragile)],
      cards: inDeck('HNT', 'SRG', 'TRE', 'FOE'),
      picks: Array.from({ length: 30 }, () => 0),
    },
    {
      name: 'two investigators facing a massive enemy and a spawner',
      investigators: [investigator('alice', 'a', fragile), investigator('bob', 'c', fragile)],
      cards: inDeck('BIG', 'SPN', 'FOE', 'TRE'),
      picks: [1, 2, 0, 1, 1, 2, 0, 0, 1, 2, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 2, 1, 0],
    },
    {
      name: 'three investigators with an empty encounter deck',
      investigators: [
        investigator('alice', 'a', fragile),
        investigator('bob', 'b', fragile),
        investigator('carol', 'c', fragile),
      ],
      cards: {},
      picks: Array.from({ length: 20 }, (_, i) => i % 3),
    },
    {
      name: 'three investigators drawing hunters, surges and spawners',
      investigators: [
        investigator('alice', 'a', fragile),
        investigator('bob', 'b', fragile),
        investigator('carol', 'c', fragile),
      ],
      cards: inDeck('SPN', 'SRG', 'HNT', 'SRG', 'FOE', 'SPN', 'HNT'),
      picks: [2, 0, 1, 3, 2, 0, 4, 1, 1, 0, 2, 3, 0, 1, 2, 4, 0, 3, 1, 2, 0, 1, 2, 3, 4, 0],
    },
    {
      name: 'two investigators with hunters already on the board',
      investigators: [investigator('alice', 'a', fragile), investigator('bob', 'a', fragile)],
      cards: { h1: { code: 'HNT', zone: at('c') }, h2: { code: 'HNT', zone: at('b') } },
      picks: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
    },
  ])('$name keeps the invariants, never lowers the round and never gets stuck', (setup) => {
    const { states, stuck } = playThrough(started(setup.investigators, setup.cards), setup.picks);
    const rounds = states.map((state) => state.meta.round);

    expect(stuck).toBe(false);
    expect(states.flatMap((state) => checkInvariants(state))).toEqual([]);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
  });
});
