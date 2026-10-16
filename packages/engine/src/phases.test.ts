import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  type Command,
  type EngineContext,
  type GameState,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  fixed,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  runFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const firstAgenda = instanceId('first_agenda');
const secondAgenda = instanceId('second_agenda');
const firstAct = instanceId('first_act');
const secondAct = instanceId('second_act');

/**
 * The cards of these tests: the hall - cellar - attic line of locations, a
 * first agenda with a threshold of 2 doom, a second one with 9, an act that
 * needs 1 clue, enemies that differ in what the phase steps do with them,
 * and a plain treachery to draw.
 */
const ctx = contextWith(
  makeCard({ code: 'hall', name: 'Hall', typeCode: 'location' }),
  makeCard({ code: 'cellar', name: 'Cellar', typeCode: 'location' }),
  makeCard({ code: 'attic', name: 'Attic', typeCode: 'location' }),
  makeCard({ code: 'agenda_of_2', typeCode: 'agenda', stage: { number: 1 }, doom: fixed(2) }),
  makeCard({ code: 'agenda_of_9', typeCode: 'agenda', stage: { number: 2 }, doom: fixed(9) }),
  makeCard({ code: 'act_of_1', typeCode: 'act', stage: { number: 1 }, clues: fixed(1) }),
  makeCard({ code: 'last_act', typeCode: 'act', stage: { number: 2 } }),
  makeCard({ code: 'ghoul', typeCode: 'enemy', damage: 2, horror: 1 }),
  makeCard({
    code: 'hunting_rat',
    typeCode: 'enemy',
    damage: 1,
    horror: 0,
    keywords: [{ name: 'hunter' }],
  }),
  makeCard({
    code: 'massive_ghoul',
    typeCode: 'enemy',
    damage: 1,
    horror: 0,
    keywords: [{ name: 'massive' }],
  }),
  makeCard({
    code: 'unreadable_spawn_ghoul',
    typeCode: 'enemy',
    keywords: [{ name: 'spawn', detail: 'the location with the most clues' }],
  }),
  makeCard({ code: 'plain_treachery' }),
);

/**
 * A started scenario on the hall - cellar - attic map with the agendas and
 * acts above and `cards` besides. The encounter deck is not shuffled, so the
 * draw order is the order of `cards`. The first investigator is the lead.
 */
function startedWith(investigators: Investigator[], cards: StartingCard[] = []): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { hall: 'hall', cellar: 'cellar', attic: 'attic' },
        connections: [edge('hall', 'cellar'), edge('cellar', 'attic')],
      },
    },
    investigators,
    shuffleEncounterDeck: false,
    cards: [
      { id: firstAgenda, code: 'agenda_of_2', zone: { kind: 'agendaDeck' } },
      { id: secondAgenda, code: 'agenda_of_9', zone: { kind: 'agendaDeck' } },
      { id: firstAct, code: 'act_of_1', zone: { kind: 'actDeck' } },
      { id: secondAct, code: 'last_act', zone: { kind: 'actDeck' } },
      ...cards,
    ],
  });
}

const at = (locationId: typeof hall): Zone => ({ kind: 'atLocation', locationId });
const engagedWith = (investigator: typeof alice): Zone => ({
  kind: 'engaged',
  investigatorId: investigator,
});
const inDeck = (id: string, code: string): StartingCard => ({
  id: instanceId(id),
  code,
  zone: { kind: 'encounterDeck' },
});
const placed = (id: string, code: string, zone: Zone): StartingCard => ({
  id: instanceId(id),
  code,
  zone,
});

const next: Command = { type: 'NextPhase' };

/** A whole turn without actions for each investigator, in the given order. */
function turnsOf(...investigators: (typeof alice)[]): Command[] {
  return investigators.flatMap((investigator): Command[] => [
    { type: 'StartTurn', investigatorId: investigator },
    { type: 'EndTurn', investigatorId: investigator },
  ]);
}

/** The investigator and card of each encounter draw `command` makes from `state`. */
function drawsOf(state: GameState, command: Command): string[] {
  return execute(ctx, state, command).events.flatMap((event) =>
    event.type === 'EncounterCardDrawn' ? [`${event.investigatorId} draws ${event.cardId}`] : [],
  );
}

describe('NextPhase', () => {
  it('starts round 1 with the investigation phase, skipping its mythos phase', () => {
    const state = startedWith(
      [makeInvestigator({ id: 'alice', locationId: hall })],
      [inDeck('waiting_treachery', 'plain_treachery')],
    );

    const after = stateAfter(ctx, state, next);

    expect(after.meta).toMatchObject({ round: 1, phase: 'investigation', steps: [] });
    expect(after.cards[firstAgenda]!.tokens.doom).toBeUndefined();
    expect(after.cards[instanceId('waiting_treachery')]!.zone).toEqual({ kind: 'encounterDeck' });
  });

  it('walks investigation, enemy and upkeep within a round, then starts the next with mythos', () => {
    const state = startedWith([makeInvestigator({ id: 'alice', locationId: hall })]);

    const investigation = stateAfter(ctx, state, next);
    const enemy = stateAfter(ctx, investigation, ...turnsOf(alice), next);
    const upkeep = stateAfter(ctx, enemy, next);
    const mythos = stateAfter(ctx, upkeep, next);

    expect([investigation, enemy, upkeep, mythos].map((s) => [s.meta.round, s.meta.phase])).toEqual(
      [
        [1, 'investigation'],
        [1, 'enemy'],
        [1, 'upkeep'],
        [2, 'mythos'],
      ],
    );
  });

  it('is rejected while a decision is pending', () => {
    const investigation = stateAfter(
      ctx,
      startedWith([makeInvestigator({ id: 'alice', locationId: hall })]),
      next,
      { type: 'StartTurn', investigatorId: alice },
      { type: 'Investigate', investigatorId: alice },
    );

    expect(rejectionFrom(ctx, investigation, next)).toEqual({
      code: 'decisionPending',
      decisionId: decisionId('investigate:alice'),
    });
  });

  it('does not leave the investigation phase before every active investigator had a turn', () => {
    const investigation = stateAfter(
      ctx,
      startedWith([
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
      ]),
      next,
      ...turnsOf(alice),
    );

    expect(rejectionFrom(ctx, investigation, next)).toEqual({
      code: 'turnsNotTaken',
      investigatorIds: [bob],
    });
  });

  it('does not leave the investigation phase during a turn', () => {
    const investigation = stateAfter(
      ctx,
      startedWith([makeInvestigator({ id: 'alice', locationId: hall })]),
      next,
      { type: 'StartTurn', investigatorId: alice },
    );

    expect(rejectionFrom(ctx, investigation, next)).toEqual({
      code: 'turnInProgress',
      investigatorId: alice,
    });
  });

  it('lets a defeated investigator`s turn go untaken', () => {
    const investigation = stateAfter(
      ctx,
      startedWith([
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({
          id: 'bob',
          seat: 1,
          locationId: hall,
          health: { max: 1, damage: 0 },
        }),
      ]),
      next,
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'damage', delta: 1 },
      ...turnsOf(alice),
    );

    const enemy = stateAfter(ctx, investigation, next);

    expect(enemy.meta.phase).toBe('enemy');
  });
});

describe('mythos phase', () => {
  const aliceAndBob = [
    makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
    makeInvestigator({ id: 'bob', seat: 1, locationId: cellar }),
  ];
  /** The state at the end of round 1, so the next `NextPhase` runs the mythos phase of round 2. */
  const upkeepOf = (state: GameState): GameState =>
    stateAfter(ctx, state, next, ...turnsOf(alice, bob), next, next);

  it('places 1 doom on the agenda (1.2) and lets each investigator draw in player order (1.4)', () => {
    const upkeep = upkeepOf(
      startedWith(aliceAndBob, [
        inDeck('first_treachery', 'plain_treachery'),
        inDeck('second_treachery', 'plain_treachery'),
      ]),
    );

    const mythos = stateAfter(ctx, upkeep, next);

    expect(drawsOf(upkeep, next)).toEqual([
      'alice draws first_treachery',
      'bob draws second_treachery',
    ]);
    expect(mythos.cards[firstAgenda]!.tokens.doom).toBe(1);
    expect(mythos.meta).toMatchObject({ round: 2, phase: 'mythos', steps: [] });
  });

  it('starts the draws with the lead investigator, then follows the seats', () => {
    const bobLeads = [
      makeInvestigator({ id: 'bob', seat: 1, locationId: cellar }),
      makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
    ];
    const upkeep = stateAfter(
      ctx,
      startedWith(bobLeads, [
        inDeck('first_treachery', 'plain_treachery'),
        inDeck('second_treachery', 'plain_treachery'),
      ]),
      next,
      ...turnsOf(alice, bob),
      next,
      next,
    );

    expect(drawsOf(upkeep, next)).toEqual([
      'bob draws first_treachery',
      'alice draws second_treachery',
    ]);
  });

  it('asks to advance the agenda at the threshold check (1.3) and draws only after the answer', () => {
    const upkeep = stateAfter(
      ctx,
      upkeepOf(
        startedWith(aliceAndBob, [
          inDeck('first_treachery', 'plain_treachery'),
          inDeck('second_treachery', 'plain_treachery'),
        ]),
      ),
      { type: 'PlaceDoom', amount: 1 },
    );

    const asked = stateAfter(ctx, upkeep, next);
    const answered = stateAfter(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('advanceAgenda:first_agenda'),
      optionId: 'yes',
    });

    expect(asked.pending.map((decision) => decision.id)).toEqual(['advanceAgenda:first_agenda']);
    expect(asked.meta.steps).toEqual([
      { id: '1.4', investigatorId: alice },
      { id: '1.4', investigatorId: bob },
    ]);
    expect(answered.agenda.current).toBe(secondAgenda);
    expect(drawsOf(answered, next)).toEqual([
      'alice draws first_treachery',
      'bob draws second_treachery',
    ]);
  });

  it('does not ask when doom reached the threshold earlier but was corrected before the check', () => {
    const corrected = stateAfter(
      ctx,
      upkeepOf(startedWith(aliceAndBob)),
      { type: 'PlaceDoom', amount: 2 },
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: firstAgenda, token: 'doom', delta: -2 },
      },
    );

    const mythos = stateAfter(ctx, corrected, next);

    expect(mythos.pending).toEqual([]);
    expect(mythos.cards[firstAgenda]!.tokens.doom).toBe(1);
  });

  it('keeps the later draws when a draw raises a decision', () => {
    const upkeep = upkeepOf(
      startedWith(aliceAndBob, [
        inDeck('unreadable_spawner', 'unreadable_spawn_ghoul'),
        inDeck('bobs_treachery', 'plain_treachery'),
      ]),
    );

    const asked = stateAfter(ctx, upkeep, next);
    const answered = stateAfter(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('spawn:unreadable_spawner'),
      optionId: 'attic',
    });

    expect(asked.pending.map((decision) => decision.id)).toEqual(['spawn:unreadable_spawner']);
    expect(answered.cards[instanceId('unreadable_spawner')]!.zone).toEqual(at(attic));
    expect(drawsOf(answered, next)).toEqual(['bob draws bobs_treachery']);
  });

  it('skips the draws when there is no encounter card left', () => {
    const mythos = stateAfter(ctx, upkeepOf(startedWith(aliceAndBob)), next);

    expect(mythos.meta).toMatchObject({ round: 2, phase: 'mythos', steps: [] });
  });

  it('skips the draw of an investigator defeated before their turn to draw', () => {
    const upkeep = stateAfter(
      ctx,
      upkeepOf(startedWith(aliceAndBob, [inDeck('first_treachery', 'plain_treachery')])),
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 8 },
    );

    expect(drawsOf(upkeep, next)).toEqual(['bob draws first_treachery']);
  });
});

describe('enemy phase', () => {
  const aliceInHall = [makeInvestigator({ id: 'alice', locationId: hall })];
  /** From setup to the enemy phase of round 1, alice having taken her turn. */
  const toEnemyPhase = (state: GameState, ...investigators: (typeof alice)[]): GameState =>
    stateAfter(ctx, state, next, ...turnsOf(...investigators), next);

  it('moves the hunters (3.2), then lists the attacks of the ready engaged enemies (3.3)', () => {
    const state = startedWith(aliceInHall, [placed('rat', 'hunting_rat', at(cellar))]);

    const enemy = toEnemyPhase(state, alice);

    expect(enemy.cards[instanceId('rat')]!.zone).toEqual(engagedWith(alice));
    expect(enemy.meta.steps).toEqual([
      { id: '3.3', attacks: [{ enemyId: instanceId('rat'), investigatorId: alice }] },
    ]);
  });

  it('stops at a hunter decision and lists the attacks once it is answered', () => {
    const state = startedWith(
      [
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: attic }),
      ],
      [placed('rat', 'hunting_rat', at(cellar))],
    );

    const asked = toEnemyPhase(state, alice, bob);
    const answered = stateAfter(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('hunter:rat:investigator'),
      optionId: 'bob',
    });
    const resumed = stateAfter(ctx, answered, next);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['hunter:rat:investigator']);
    expect(asked.meta.steps).toEqual([{ id: '3.3' }]);
    expect(resumed.meta.steps).toEqual([
      { id: '3.3', attacks: [{ enemyId: instanceId('rat'), investigatorId: bob }] },
    ]);
  });

  it('rejects moving on while an attack is due', () => {
    const enemy = toEnemyPhase(
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );

    expect(rejectionFrom(ctx, enemy, next)).toEqual({
      code: 'enemyAttackPending',
      enemyId: instanceId('ghoul'),
      investigatorId: alice,
    });
  });

  it('deals the printed damage and horror of an attack, exhausts the enemy and ends the step', () => {
    const enemy = toEnemyPhase(
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );

    const after = stateAfter(ctx, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('ghoul'),
      investigatorId: alice,
    });

    expect(after.investigators[0]).toMatchObject({ health: { damage: 2 }, sanity: { horror: 1 } });
    expect(after.cards[instanceId('ghoul')]!.exhausted).toBe(true);
    expect(after.meta.steps).toEqual([]);
  });

  it('deals the reduced amounts the players enter when assets soak part of an attack', () => {
    const enemy = toEnemyPhase(
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );

    const after = stateAfter(ctx, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('ghoul'),
      investigatorId: alice,
      damage: 0,
      horror: 0,
    });

    expect(after.investigators[0]).toMatchObject({ health: { damage: 0 }, sanity: { horror: 0 } });
    expect(after.cards[instanceId('ghoul')]!.exhausted).toBe(true);
  });

  it('defeats an investigator once from damage and horror dealt together', () => {
    const fragileAlice = makeInvestigator({
      id: 'alice',
      locationId: hall,
      health: { max: 3, damage: 1 },
      sanity: { max: 3, horror: 2 },
    });
    const enemy = toEnemyPhase(
      startedWith([fragileAlice], [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );

    const { events } = execute(ctx, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('ghoul'),
      investigatorId: alice,
    });

    expect(events.map((event) => event.type)).toEqual([
      'PhaseStepsChanged',
      'InvestigatorChanged',
      'InvestigatorChanged',
      'InvestigatorDefeated',
      'EnemyDisengaged',
      'ScenarioEnded',
      'ExhaustChanged',
    ]);
  });

  it('rejects an attack that is not due', () => {
    const enemy = toEnemyPhase(
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );

    expect(
      rejectionFrom(ctx, enemy, {
        type: 'ResolveEnemyAttack',
        enemyId: instanceId('ghoul'),
        investigatorId: bob,
      }),
    ).toEqual({ code: 'attackNotDue', enemyId: instanceId('ghoul'), investigatorId: bob });
  });

  it('rejects a negative amount', () => {
    const enemy = toEnemyPhase(
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );

    expect(
      rejectionFrom(ctx, enemy, {
        type: 'ResolveEnemyAttack',
        enemyId: instanceId('ghoul'),
        investigatorId: alice,
        damage: -1,
      }),
    ).toEqual({ code: 'invalidAttackAmount', amount: -1 });
  });

  it('exhausts a massive enemy only after it attacked everyone at its location', () => {
    const enemy = toEnemyPhase(
      startedWith(
        [
          makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
          makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
        ],
        [placed('giant', 'massive_ghoul', at(hall))],
      ),
      alice,
      bob,
    );

    const first = stateAfter(ctx, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('giant'),
      investigatorId: alice,
    });
    const second = stateAfter(ctx, first, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('giant'),
      investigatorId: bob,
    });

    expect(first.cards[instanceId('giant')]!.exhausted).toBe(false);
    expect(second.cards[instanceId('giant')]!.exhausted).toBe(true);
  });

  it('drops an attack whose enemy left play meanwhile', () => {
    const enemy = toEnemyPhase(
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', engagedWith(alice))]),
      alice,
    );
    const defeated = stateAfter(ctx, enemy, { type: 'DefeatEnemy', enemyId: instanceId('ghoul') });

    const after = stateAfter(ctx, defeated, next);

    expect(after.meta).toMatchObject({ phase: 'enemy', steps: [] });
  });
});

describe('upkeep phase', () => {
  const aliceInHall = [makeInvestigator({ id: 'alice', locationId: hall })];

  it('resets the remaining actions of each active investigator to 3 (4.2)', () => {
    const state = stateAfter(
      ctx,
      startedWith([
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
      ]),
      next,
      { type: 'AdjustActions', investigatorId: alice, delta: -3 },
      { type: 'AdjustActions', investigatorId: bob, delta: 1 },
      ...turnsOf(alice, bob),
    );

    const upkeep = stateAfter(ctx, state, next, next);

    expect(upkeep.investigators.map((inv) => [inv.id, inv.actionsRemaining])).toEqual([
      ['alice', 3],
      ['bob', 3],
    ]);
  });

  it('readies exhausted enemies (4.3), which engage investigators at their location', () => {
    const state = stateAfter(
      ctx,
      startedWith(aliceInHall, [placed('ghoul', 'ghoul', at(hall))]),
      { type: 'DisengageEnemy', enemyId: instanceId('ghoul') },
      { type: 'ExhaustEnemy', enemyId: instanceId('ghoul') },
    );

    const upkeep = stateAfter(ctx, state, next, ...turnsOf(alice), next, next);

    expect(upkeep.cards[instanceId('ghoul')]).toMatchObject({
      exhausted: false,
      zone: engagedWith(alice),
    });
  });

  it('gives each active investigator 1 resource (4.4)', () => {
    const state = stateAfter(
      ctx,
      startedWith([
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall, resources: 0 }),
        makeInvestigator({
          id: 'bob',
          seat: 1,
          locationId: hall,
          resources: 0,
          sanity: { max: 3, horror: 0 },
        }),
      ]),
      next,
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'horror', delta: 3 },
      ...turnsOf(alice),
    );

    const upkeep = stateAfter(ctx, state, next, next);

    expect(upkeep.investigators.map((inv) => [inv.id, inv.resources])).toEqual([
      ['alice', 1],
      ['bob', 0],
    ]);
  });

  it('ends the round (4.6): fires onRoundEnd and clears the turns taken', () => {
    const cluePerRound: EngineContext = {
      ...ctx,
      hooks: {
        onRoundEnd: (_ctx, _state, event) => [
          { type: 'AdjustInvestigator', investigatorId: alice, stat: 'clues', delta: event.round },
        ],
      },
    };
    const enemy = runFrom(cluePerRound, startedWith(aliceInHall), [
      next,
      ...turnsOf(alice),
      next,
    ]).state;

    const upkeep = runFrom(cluePerRound, enemy, [next]).state;

    expect(enemy.meta.turnsTaken).toEqual([alice]);
    expect(upkeep.meta.turnsTaken).toEqual([]);
    expect(upkeep.investigators[0]!.clues).toBe(1);
    expect(upkeep.meta).toMatchObject({ round: 1, phase: 'upkeep', steps: [] });
  });
});

describe('investigation phase', () => {
  it('lets the investigators advance the act during a turn', () => {
    const turn = stateAfter(
      ctx,
      startedWith([makeInvestigator({ id: 'alice', locationId: hall, clues: 1 })]),
      next,
      { type: 'StartTurn', investigatorId: alice },
    );

    const after = stateAfter(ctx, turn, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: alice, amount: 1 }],
    });

    expect(after.act.current).toBe(secondAct);
    expect(after.meta.turn).toEqual({ investigatorId: alice });
    expect(checkInvariants(after)).toEqual([]);
  });
});
