import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardDbFrom,
  checkInvariants,
  decisionId,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  playerOrder,
  type CardStats,
  type Command,
  type EngineContext,
  type GameState,
  type Investigator,
  type Rejection,
  type StartingCard,
  type Zone,
} from './index';

const main = mapId('main');
const alice = investigatorId('alice');
const bob = investigatorId('bob');
const id = instanceId;

const defs: CardStats[] = [
  {
    code: 'AG1',
    name: 'Fake Agenda',
    typeCode: 'agenda',
    traits: [],
    doom: { fixed: 2, perInvestigator: 0 },
  },
  {
    code: 'AG2',
    name: 'Fake Agenda 2',
    typeCode: 'agenda',
    traits: [],
    doom: { fixed: 9, perInvestigator: 0 },
  },
  {
    code: 'ACT',
    name: 'Fake Act',
    typeCode: 'act',
    traits: [],
    clues: { fixed: 1, perInvestigator: 0 },
  },
  { code: 'ACT2', name: 'Fake Act 2', typeCode: 'act', traits: [] },
  { code: 'LOC', name: 'Fake Place', typeCode: 'location', traits: [], shroud: 2 },
  {
    code: 'HNT',
    name: 'Fake Hunter',
    typeCode: 'enemy',
    traits: [],
    damage: 1,
    horror: 2,
    keywords: [{ name: 'hunter' }],
  },
  { code: 'FOE', name: 'Fake Foe', typeCode: 'enemy', traits: [], damage: 2, horror: 1 },
  {
    code: 'BIG',
    name: 'Fake Giant',
    typeCode: 'enemy',
    traits: [],
    damage: 1,
    horror: 0,
    keywords: [{ name: 'massive' }],
  },
  {
    code: 'SPN',
    name: 'Fake Spawner',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'spawn', detail: 'Fake Place' }],
  },
  { code: 'TRE', name: 'Fake Mishap', typeCode: 'treachery', traits: [] },
];
const ctx: EngineContext = { cards: cardDbFrom(defs) };

function investigator(who: typeof alice, location: string, seat: number): Investigator {
  return {
    id: who,
    code: 'inv',
    name: who,
    seat,
    locationId: id(location),
    health: { max: 3, damage: 0 },
    sanity: { max: 3, horror: 0 },
    clues: 0,
    resources: 0,
    doomOnPlayerCards: 0,
    status: 'active',
  };
}

/**
 * Locations `a` - `b` - `c` in a line, agendas AG1 (2 doom) and AG2, acts ACT
 * (1 clue) and ACT2; `extra` cards as `[id, code, zone]`; nothing in the
 * encounter deck unless `extra` puts it there (no shuffle, so order = list order).
 */
function started(investigators: Investigator[], extra: [string, string, Zone][] = []): GameState {
  const cards: StartingCard[] = [
    { id: id('ag1'), code: 'AG1', zone: { kind: 'agendaDeck' }, faceUp: true },
    { id: id('ag2'), code: 'AG2', zone: { kind: 'agendaDeck' }, faceUp: true },
    { id: id('act'), code: 'ACT', zone: { kind: 'actDeck' }, faceUp: true },
    { id: id('act2'), code: 'ACT2', zone: { kind: 'actDeck' }, faceUp: true },
    ...['a', 'b', 'c'].map((place) => ({
      id: id(place),
      code: 'LOC',
      zone: { kind: 'location', mapId: main } as Zone,
      faceUp: true,
    })),
    ...extra.map(([cardId, code, zone]) => ({ id: id(cardId), code, zone, faceUp: true })),
  ];
  return execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'phases',
    difficulty: 'standard',
    seed: 1,
    shuffleEncounterDeck: false,
    investigators,
    maps: { [main]: { name: 'Main' } },
    cards,
    connections: [
      { from: id('a'), to: id('b'), oneWay: false },
      { from: id('b'), to: id('c'), oneWay: false },
    ],
  }).state;
}

const at = (place: string): Zone => ({ kind: 'atLocation', locationId: id(place) });
const deck: Zone = { kind: 'encounterDeck' };
const next: Command = { type: 'NextPhase' };

function run(context: EngineContext, state: GameState, ...commands: Command[]): GameState {
  return commands.reduce((acc, command) => execute(context, acc, command).state, state);
}

/** `count` times `NextPhase`. */
function nextPhases(state: GameState, count: number, context = ctx): GameState {
  return run(context, state, ...Array.from({ length: count }, () => next));
}

function rejectionOf(state: GameState, command: Command): Rejection {
  try {
    execute(ctx, state, command);
  } catch (e) {
    if (e instanceof CommandRejected) return e.rejection;
    throw e;
  }
  throw new Error('expected CommandRejected');
}

function codesDrawn(before: GameState, command: Command): string[] {
  return execute(ctx, before, command)
    .events.filter((e) => e.type === 'EncounterCardDrawn')
    .map((e) => `${e.investigatorId}:${e.cardId}`);
}

describe('NextPhase', () => {
  it('starts round 1 with the investigation phase, skipping its mythos phase', () => {
    const state = started([investigator(alice, 'a', 1)], [['t1', 'TRE', deck]]);

    const after = nextPhases(state, 1);

    expect(after.meta).toMatchObject({ round: 1, phase: 'investigation', steps: [] });
    expect(after.cards[id('ag1')]?.tokens.doom).toBeUndefined();
    expect(after.cards[id('t1')]?.zone).toEqual(deck);
  });

  it('walks investigation, enemy and upkeep within a round, then starts the next with mythos', () => {
    const state = started([investigator(alice, 'a', 1)]);

    const phases = [1, 2, 3, 4].map((count) => nextPhases(state, count).meta);

    expect(phases.map((meta) => [meta.round, meta.phase])).toEqual([
      [1, 'investigation'],
      [1, 'enemy'],
      [1, 'upkeep'],
      [2, 'mythos'],
    ]);
  });

  it('is rejected while a decision is pending', () => {
    const state = run(ctx, started([investigator(alice, 'a', 1)]), {
      type: 'Investigate',
      investigatorId: alice,
    });

    expect(rejectionOf(state, next).code).toBe('decisionPending');
  });
});

describe('mythos phase', () => {
  it('places 1 doom on the agenda and lets each investigator draw in player order', () => {
    const state = started(
      [investigator(alice, 'a', 1), investigator(bob, 'a', 2)],
      [
        ['t1', 'TRE', deck],
        ['t2', 'TRE', deck],
      ],
    );
    const upkeep = nextPhases(state, 3);

    const draws = codesDrawn(upkeep, next);
    const mythos = nextPhases(upkeep, 1);

    expect(draws).toEqual(['alice:t1', 'bob:t2']);
    expect(mythos.cards[id('ag1')]?.tokens.doom).toBe(1);
    expect(mythos.meta.steps).toEqual([]);
  });

  it('starts the draws with the lead investigator, then follows the seats', () => {
    const state = started([
      investigator(bob, 'a', 2),
      investigator(alice, 'a', 1),
      investigator(investigatorId('carol'), 'a', 3),
    ]);

    expect(playerOrder(state).map((inv) => inv.id)).toEqual(['bob', 'carol', 'alice']);
  });

  it('asks to advance the agenda at the threshold check and draws only after the answer', () => {
    const state = run(ctx, started([investigator(alice, 'a', 1)], [['t1', 'TRE', deck]]), {
      type: 'PlaceDoom',
      amount: 1,
    });
    const upkeep = nextPhases(state, 3);

    const asked = nextPhases(upkeep, 1);
    const answered = run(ctx, asked, {
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
    const state = run(ctx, started([investigator(alice, 'a', 1)]), {
      type: 'PlaceDoom',
      amount: 3,
    });
    const removed = run(ctx, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: id('ag1'), token: 'doom', delta: -3 },
    });

    const mythos = nextPhases(removed, 4);

    expect(state.pending).toEqual([]);
    expect(mythos.pending).toEqual([]);
  });

  it('keeps the later draws when a draw raises a decision', () => {
    const state = started(
      [investigator(alice, 'a', 1), investigator(bob, 'c', 2)],
      [
        ['spawner', 'SPN', deck],
        ['t1', 'TRE', deck],
      ],
    );
    const upkeep = nextPhases(state, 3);

    const asked = nextPhases(upkeep, 1);
    const answered = run(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('spawn:spawner'),
      optionId: 'b',
    });
    const draws = codesDrawn(answered, next);

    expect(asked.pending.map((d) => d.id)).toEqual(['spawn:spawner']);
    expect(draws).toEqual(['bob:t1']);
  });

  it('skips the draws when there is no encounter card left', () => {
    const upkeep = nextPhases(started([investigator(alice, 'a', 1)]), 3);

    const mythos = nextPhases(upkeep, 1);

    expect(mythos.meta).toMatchObject({ round: 2, phase: 'mythos', steps: [] });
  });

  it('skips the draw of an investigator defeated before their turn to draw', () => {
    const state = started(
      [investigator(alice, 'a', 1), investigator(bob, 'a', 2)],
      [['t1', 'TRE', deck]],
    );
    const upkeep = run(ctx, nextPhases(state, 3), {
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
    const state = started([investigator(alice, 'a', 1)], [['hunter', 'HNT', at('b')]]);

    const enemy = nextPhases(state, 2);

    expect(enemy.cards[id('hunter')]?.zone).toEqual({ kind: 'engaged', investigatorId: alice });
    expect(enemy.meta.steps).toEqual([
      { kind: 'enemyAttack', enemyId: 'hunter', investigatorId: alice },
    ]);
  });

  it('rejects moving on while an attack is due', () => {
    const enemy = nextPhases(
      started(
        [investigator(alice, 'a', 1)],
        [['foe', 'FOE', { kind: 'engaged', investigatorId: alice }]],
      ),
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
      started(
        [investigator(alice, 'a', 1)],
        [['foe', 'FOE', { kind: 'engaged', investigatorId: alice }]],
      ),
      2,
    );

    const after = run(ctx, enemy, {
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
      started(
        [investigator(alice, 'a', 1)],
        [['foe', 'FOE', { kind: 'engaged', investigatorId: alice }]],
      ),
      2,
    );

    const after = run(ctx, enemy, {
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
          {
            ...investigator(alice, 'a', 1),
            health: { max: 3, damage: 2 },
            sanity: { max: 3, horror: 2 },
          },
        ],
        [['foe', 'FOE', { kind: 'engaged', investigatorId: alice }]],
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
    const enemy = nextPhases(started([investigator(alice, 'a', 1)], [['foe', 'FOE', at('c')]]), 2);

    expect(
      rejectionOf(enemy, { type: 'ResolveEnemyAttack', enemyId: id('foe'), investigatorId: alice })
        .code,
    ).toBe('attackNotDue');
  });

  it('rejects a negative amount', () => {
    const enemy = nextPhases(
      started(
        [investigator(alice, 'a', 1)],
        [['foe', 'FOE', { kind: 'engaged', investigatorId: alice }]],
      ),
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
      started(
        [investigator(alice, 'a', 1), investigator(bob, 'a', 2)],
        [['giant', 'BIG', at('a')]],
      ),
      2,
    );

    const first = run(ctx, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: id('giant'),
      investigatorId: alice,
    });
    const second = run(ctx, first, {
      type: 'ResolveEnemyAttack',
      enemyId: id('giant'),
      investigatorId: bob,
    });

    expect(first.cards[id('giant')]?.exhausted).toBe(false);
    expect(second.cards[id('giant')]?.exhausted).toBe(true);
  });

  it('drops an attack whose enemy was evaded or defeated meanwhile', () => {
    const enemy = nextPhases(
      started(
        [investigator(alice, 'a', 1)],
        [['foe', 'FOE', { kind: 'engaged', investigatorId: alice }]],
      ),
      2,
    );
    const evaded = run(ctx, enemy, {
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
      ctx,
      started([investigator(alice, 'a', 1)], [['foe', 'FOE', at('a')]]),
      { type: 'DisengageEnemy', enemyId: id('foe') },
      { type: 'ExhaustEnemy', enemyId: id('foe') },
    );

    const upkeep = nextPhases(state, 3);

    expect(upkeep.cards[id('foe')]).toMatchObject({
      exhausted: false,
      zone: { kind: 'engaged', investigatorId: alice },
    });
  });

  it('gives each active investigator 1 resource', () => {
    const state = run(ctx, started([investigator(alice, 'a', 1), investigator(bob, 'a', 2)]), {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'horror',
      delta: 3,
    });

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
    const investigation = nextPhases(started([investigator(alice, 'a', 1)]), 1, hooked);
    const turnTaken = run(hooked, investigation, { type: 'EndTurn', investigatorId: alice });

    const upkeep = nextPhases(turnTaken, 2, hooked);

    expect(turnTaken.meta.turnsTaken).toEqual([alice]);
    expect(upkeep.meta.turnsTaken).toEqual([]);
    expect(upkeep.investigators[0]?.clues).toBe(1);
    expect(upkeep.meta).toMatchObject({ round: 1, phase: 'upkeep', steps: [] });
  });
});

describe('EndTurn', () => {
  it('rejects a second turn in the same round', () => {
    const investigation = nextPhases(started([investigator(alice, 'a', 1)]), 1);
    const turnTaken = run(ctx, investigation, { type: 'EndTurn', investigatorId: alice });

    expect(rejectionOf(turnTaken, { type: 'EndTurn', investigatorId: alice })).toEqual({
      code: 'turnAlreadyTaken',
      investigatorId: alice,
    });
  });

  it('rejects ending a turn outside the investigation phase', () => {
    const enemy = nextPhases(started([investigator(alice, 'a', 1)]), 2);

    expect(rejectionOf(enemy, { type: 'EndTurn', investigatorId: alice })).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'enemy',
    });
  });
});

describe('investigation phase', () => {
  it('lets the investigators advance the act during a turn', () => {
    const investigation = run(ctx, nextPhases(started([investigator(alice, 'a', 1)]), 1), {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'clues',
      delta: 1,
    });

    const after = run(ctx, investigation, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: alice, amount: 1 }],
    });

    expect(after.act.current).toBe('act2');
    expect(after.meta.phase).toBe('investigation');
    expect(checkInvariants(after)).toEqual([]);
  });
});
