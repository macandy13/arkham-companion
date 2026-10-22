import { describe, expect, it } from 'vitest';
import {
  atEndOfRound,
  atLocation,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  decisionId,
  discardSelf,
  engagedWith,
  execute,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  putIntoThreatArea,
  threatAreaOf,
  whenRevealed,
  type Command,
  type EngineContext,
  type GameState,
  type Zone,
} from './index';
import { answer, rejectionFrom, runFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const firstAgenda = instanceId('first_agenda');
const secondAgenda = instanceId('second_agenda');
const firstAct = instanceId('first_act');
const secondAct = instanceId('second_act');

/** The first agenda advances at 2 doom; the second one, at 9, is not reached by these tests. */
const agendaOf2 = blankAgenda('agenda_of_2', fixed(2));
const agendaOf9 = blankAgenda('agenda_of_9', fixed(9), { stage: { number: 2 } });
/** The first act needs 1 clue to advance. */
const actOf1 = blankAct('act_of_1', { clues: fixed(1) });
const lastAct = blankAct('last_act', { stage: { number: 2 } });
/** A ghoul dealing 2 damage and 1 horror. */
const ghoulCard = blankEnemy('ghoul', { damage: 2, horror: 1 });
const huntingRatCard = blankEnemy('hunting_rat', { damage: 1, keywords: [{ name: 'hunter' }] });
const massiveGhoulCard = blankEnemy('massive_ghoul', {
  damage: 1,
  keywords: [{ name: 'massive' }],
});
const unreadableSpawnGhoulCard = blankEnemy('unreadable_spawn_ghoul', {
  keywords: [{ name: 'spawn', detail: 'the location with the most clues' }],
});
const plainTreachery = blankTreachery('plain_treachery');
/** Dissonant Voices stays in the threat area until the end of the round. */
const dissonantVoices = blankTreachery('dissonant_voices', {
  abilities: [whenRevealed(putIntoThreatArea()), atEndOfRound(discardSelf())],
});

const encounterDeck: Zone = { kind: 'encounterDeck' };

/**
 * The table of these tests, without investigators: the hall - cellar - attic
 * line of locations, the two agendas and the two acts above. The encounter
 * deck is not shuffled, so the draw order is the order the cards are added
 * in. The first investigator added is the lead.
 */
const table = newGame()
  .withLocation(hall, blankLocation('hall'))
  .withLocation(cellar, blankLocation('cellar'))
  .withLocation(attic, blankLocation('attic'))
  .withConnection(hall, cellar)
  .withConnection(cellar, attic)
  .withAgenda(firstAgenda, agendaOf2)
  .withAgenda(secondAgenda, agendaOf9)
  .withAct(firstAct, actOf1)
  .withAct(secondAct, lastAct);

/** The table with alice (seat 0) in the hall. */
const aliceInHall = table.withInvestigator(alice, { locationId: hall });

/** The table with alice (seat 0) and bob (seat 1) in the hall. */
const aliceAndBobInHall = aliceInHall.withInvestigator(bob, { locationId: hall });

const next: Command = { type: 'NextPhase' };

/** A whole turn without actions for each investigator, in the given order. */
function turnsOf(...investigators: (typeof alice)[]): Command[] {
  return investigators.flatMap((investigator): Command[] => [
    { type: 'StartTurn', investigatorId: investigator },
    { type: 'EndTurn', investigatorId: investigator },
  ]);
}

/** The investigator and card of each encounter draw `command` makes from `state`. */
function drawsOf(context: EngineContext, state: GameState, command: Command): string[] {
  return execute(context, state, command).events.flatMap((event) =>
    event.type === 'EncounterCardDrawn' ? [`${event.investigatorId} draws ${event.cardId}`] : [],
  );
}

describe('NextPhase', () => {
  it('starts round 1 with the investigation phase, skipping its mythos phase', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('waiting_treachery'), plainTreachery, encounterDeck)
      .start();

    const after = stateAfter(context, state, next);

    expect(after.meta).toMatchObject({ round: 1, phase: 'investigation', steps: [] });
    expect(after.cards[firstAgenda]!.tokens.doom).toBeUndefined();
    expect(after.cards[instanceId('waiting_treachery')]!.zone).toEqual({ kind: 'encounterDeck' });
  });

  it('walks investigation, enemy and upkeep within a round, then starts the next with mythos', () => {
    const { context, state } = aliceInHall.start();

    const investigation = stateAfter(context, state, next);
    const enemy = stateAfter(context, investigation, ...turnsOf(alice), next);
    const upkeep = stateAfter(context, enemy, next);
    const mythos = stateAfter(context, upkeep, next);

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
    const { context, state } = aliceInHall.start();
    const investigation = stateAfter(
      context,
      state,
      next,
      { type: 'StartTurn', investigatorId: alice },
      { type: 'Investigate', investigatorId: alice },
    );

    expect(rejectionFrom(context, investigation, next)).toEqual({
      code: 'decisionPending',
      decisionId: decisionId('investigate:alice'),
    });
  });

  it('does not leave the investigation phase before every active investigator had a turn', () => {
    const { context, state } = aliceAndBobInHall.start();
    const investigation = stateAfter(context, state, next, ...turnsOf(alice));

    expect(rejectionFrom(context, investigation, next)).toEqual({
      code: 'turnsNotTaken',
      investigatorIds: [bob],
    });
  });

  it('does not leave the investigation phase during a turn', () => {
    const { context, state } = aliceInHall.start();
    const investigation = stateAfter(context, state, next, {
      type: 'StartTurn',
      investigatorId: alice,
    });

    expect(rejectionFrom(context, investigation, next)).toEqual({
      code: 'turnInProgress',
      investigatorId: alice,
    });
  });

  it('lets a defeated investigator`s turn go untaken', () => {
    const { context, state } = aliceInHall
      .withInvestigator(bob, { locationId: hall, health: { max: 1, damage: 0 } })
      .start();
    const investigation = stateAfter(
      context,
      state,
      next,
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'damage', delta: 1 },
      ...turnsOf(alice),
    );

    const enemy = stateAfter(context, investigation, next);

    expect(enemy.meta.phase).toBe('enemy');
  });
});

describe('mythos phase', () => {
  /** Alice (seat 0) in the hall and bob (seat 1) in the cellar. */
  const aliceAndBob = aliceInHall.withInvestigator(bob, { locationId: cellar });
  /** Alice and bob with two plain treacheries in the encounter deck, `first_treachery` on top. */
  const aliceAndBobWithTwoTreacheries = aliceAndBob
    .withCard(instanceId('first_treachery'), plainTreachery, encounterDeck)
    .withCard(instanceId('second_treachery'), plainTreachery, encounterDeck);
  /** The state at the end of round 1, so the next `NextPhase` runs the mythos phase of round 2. */
  const upkeepOf = (context: EngineContext, state: GameState): GameState =>
    stateAfter(context, state, next, ...turnsOf(alice, bob), next, next);

  it('places 1 doom on the agenda (1.2) and lets each investigator draw in player order (1.4)', () => {
    const { context, state } = aliceAndBobWithTwoTreacheries.start();
    const upkeep = upkeepOf(context, state);

    const mythos = stateAfter(context, upkeep, next);

    expect(drawsOf(context, upkeep, next)).toEqual([
      'alice draws first_treachery',
      'bob draws second_treachery',
    ]);
    expect(mythos.cards[firstAgenda]!.tokens.doom).toBe(1);
    expect(mythos.meta).toMatchObject({ round: 2, phase: 'mythos', steps: [] });
  });

  it('starts the draws with the lead investigator, then follows the seats', () => {
    const { context, state } = table
      .withInvestigator(bob, { seat: 1, locationId: cellar })
      .withInvestigator(alice, { seat: 0, locationId: hall })
      .withCard(instanceId('first_treachery'), plainTreachery, encounterDeck)
      .withCard(instanceId('second_treachery'), plainTreachery, encounterDeck)
      .start();
    const upkeep = stateAfter(context, state, next, ...turnsOf(alice, bob), next, next);

    expect(drawsOf(context, upkeep, next)).toEqual([
      'bob draws first_treachery',
      'alice draws second_treachery',
    ]);
  });

  it('asks to advance the agenda at the threshold check (1.3) and draws only after the answer', () => {
    const { context, state } = aliceAndBobWithTwoTreacheries.start();
    const upkeep = stateAfter(context, upkeepOf(context, state), { type: 'PlaceDoom', amount: 1 });

    const asked = stateAfter(context, upkeep, next);
    const answered = stateAfter(context, asked, answer('advanceAgenda:first_agenda', 'yes'));

    expect(asked.pending.map((decision) => decision.id)).toEqual(['advanceAgenda:first_agenda']);
    expect(asked.meta.steps).toEqual([
      { id: 'drawEncounterCard', investigatorId: alice },
      { id: 'drawEncounterCard', investigatorId: bob },
    ]);
    expect(answered.agenda.current).toBe(secondAgenda);
    expect(drawsOf(context, answered, next)).toEqual([
      'alice draws first_treachery',
      'bob draws second_treachery',
    ]);
  });

  it('does not ask when doom reached the threshold earlier but was corrected before the check', () => {
    const { context, state } = aliceAndBob.start();
    const corrected = stateAfter(
      context,
      upkeepOf(context, state),
      { type: 'PlaceDoom', amount: 2 },
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: firstAgenda, token: 'doom', delta: -2 },
      },
    );

    const mythos = stateAfter(context, corrected, next);

    expect(mythos.pending).toEqual([]);
    expect(mythos.cards[firstAgenda]!.tokens.doom).toBe(1);
  });

  it('keeps the later draws when a draw raises a decision', () => {
    const { context, state } = aliceAndBob
      .withCard(instanceId('unreadable_spawner'), unreadableSpawnGhoulCard, encounterDeck)
      .withCard(instanceId('bobs_treachery'), plainTreachery, encounterDeck)
      .start();
    const upkeep = upkeepOf(context, state);

    const asked = stateAfter(context, upkeep, next);
    const answered = stateAfter(context, asked, answer('spawn:unreadable_spawner', 'attic'));

    expect(asked.pending.map((decision) => decision.id)).toEqual(['spawn:unreadable_spawner']);
    expect(answered.cards[instanceId('unreadable_spawner')]!.zone).toEqual(atLocation(attic));
    expect(drawsOf(context, answered, next)).toEqual(['bob draws bobs_treachery']);
  });

  it('skips the draws when there is no encounter card left', () => {
    const { context, state } = aliceAndBob.start();

    const mythos = stateAfter(context, upkeepOf(context, state), next);

    expect(mythos.meta).toMatchObject({ round: 2, phase: 'mythos', steps: [] });
  });

  it('skips the draw of an investigator defeated before their turn to draw', () => {
    const { context, state } = aliceAndBob
      .withCard(instanceId('first_treachery'), plainTreachery, encounterDeck)
      .start();
    const upkeep = stateAfter(context, upkeepOf(context, state), {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 8,
    });

    expect(drawsOf(context, upkeep, next)).toEqual(['bob draws first_treachery']);
  });
});

describe('enemy phase', () => {
  /** Alice in the hall, engaged with the ghoul (2 damage, 1 horror). */
  const engagedWithGhoul = aliceInHall.withCard(instanceId('ghoul'), ghoulCard, engagedWith(alice));
  /** From setup to the enemy phase of round 1, the given investigators having taken their turns. */
  const toEnemyPhase = (
    context: EngineContext,
    state: GameState,
    ...investigators: (typeof alice)[]
  ): GameState => stateAfter(context, state, next, ...turnsOf(...investigators), next);

  it('moves the hunters (3.2), then lists the attacks of the ready engaged enemies (3.3)', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('rat'), huntingRatCard, atLocation(cellar))
      .start();

    const enemy = toEnemyPhase(context, state, alice);

    expect(enemy.cards[instanceId('rat')]!.zone).toEqual(engagedWith(alice));
    expect(enemy.meta.steps).toEqual([
      { id: 'enemiesAttack', attacks: [{ enemyId: instanceId('rat'), investigatorId: alice }] },
    ]);
  });

  it('stops at a hunter decision and lists the attacks once it is answered', () => {
    const { context, state } = aliceInHall
      .withInvestigator(bob, { locationId: attic })
      .withCard(instanceId('rat'), huntingRatCard, atLocation(cellar))
      .start();

    const asked = toEnemyPhase(context, state, alice, bob);
    const answered = stateAfter(context, asked, answer('hunter:rat:investigator', 'bob'));
    const resumed = stateAfter(context, answered, next);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['hunter:rat:investigator']);
    expect(asked.meta.steps).toEqual([{ id: 'enemiesAttack' }]);
    expect(resumed.meta.steps).toEqual([
      { id: 'enemiesAttack', attacks: [{ enemyId: instanceId('rat'), investigatorId: bob }] },
    ]);
  });

  it('rejects moving on while an attack is due', () => {
    const { context, state } = engagedWithGhoul.start();
    const enemy = toEnemyPhase(context, state, alice);

    expect(rejectionFrom(context, enemy, next)).toEqual({
      code: 'enemyAttackPending',
      enemyId: instanceId('ghoul'),
      investigatorId: alice,
    });
  });

  it('deals the printed damage and horror of an attack, exhausts the enemy and ends the step', () => {
    const { context, state } = engagedWithGhoul.start();
    const enemy = toEnemyPhase(context, state, alice);

    const after = stateAfter(context, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('ghoul'),
      investigatorId: alice,
    });

    expect(after.investigators[0]).toMatchObject({ health: { damage: 2 }, sanity: { horror: 1 } });
    expect(after.cards[instanceId('ghoul')]!.exhausted).toBe(true);
    expect(after.meta.steps).toEqual([]);
  });

  it('deals the reduced amounts the players enter when assets soak part of an attack', () => {
    const { context, state } = engagedWithGhoul.start();
    const enemy = toEnemyPhase(context, state, alice);

    const after = stateAfter(context, enemy, {
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
    const { context, state } = table
      .withInvestigator(alice, {
        locationId: hall,
        health: { max: 3, damage: 1 },
        sanity: { max: 3, horror: 2 },
      })
      .withCard(instanceId('ghoul'), ghoulCard, engagedWith(alice))
      .start();
    const enemy = toEnemyPhase(context, state, alice);

    const { events } = execute(context, enemy, {
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
    const { context, state } = engagedWithGhoul.start();
    const enemy = toEnemyPhase(context, state, alice);

    expect(
      rejectionFrom(context, enemy, {
        type: 'ResolveEnemyAttack',
        enemyId: instanceId('ghoul'),
        investigatorId: bob,
      }),
    ).toEqual({ code: 'attackNotDue', enemyId: instanceId('ghoul'), investigatorId: bob });
  });

  it('rejects a negative amount', () => {
    const { context, state } = engagedWithGhoul.start();
    const enemy = toEnemyPhase(context, state, alice);

    expect(
      rejectionFrom(context, enemy, {
        type: 'ResolveEnemyAttack',
        enemyId: instanceId('ghoul'),
        investigatorId: alice,
        damage: -1,
      }),
    ).toEqual({ code: 'invalidAttackAmount', amount: -1 });
  });

  it('exhausts a massive enemy only after it attacked everyone at its location', () => {
    const { context, state } = aliceAndBobInHall
      .withCard(instanceId('giant'), massiveGhoulCard, atLocation(hall))
      .start();
    const enemy = toEnemyPhase(context, state, alice, bob);

    const first = stateAfter(context, enemy, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('giant'),
      investigatorId: alice,
    });
    const second = stateAfter(context, first, {
      type: 'ResolveEnemyAttack',
      enemyId: instanceId('giant'),
      investigatorId: bob,
    });

    expect(first.cards[instanceId('giant')]!.exhausted).toBe(false);
    expect(second.cards[instanceId('giant')]!.exhausted).toBe(true);
  });

  it('drops an attack whose enemy left play meanwhile', () => {
    const { context, state } = engagedWithGhoul.start();
    const enemy = toEnemyPhase(context, state, alice);
    const defeated = stateAfter(context, enemy, {
      type: 'DefeatEnemy',
      enemyId: instanceId('ghoul'),
    });

    const after = stateAfter(context, defeated, next);

    expect(after.meta).toMatchObject({ phase: 'enemy', steps: [] });
  });
});

describe('upkeep phase', () => {
  it('resets the remaining actions of each active investigator to 3 (4.2)', () => {
    const { context, state: started } = aliceAndBobInHall.start();
    const state = stateAfter(
      context,
      started,
      next,
      { type: 'AdjustActions', investigatorId: alice, delta: -3 },
      { type: 'AdjustActions', investigatorId: bob, delta: 1 },
      ...turnsOf(alice, bob),
    );

    const upkeep = stateAfter(context, state, next, next);

    expect(upkeep.investigators.map((inv) => [inv.id, inv.actionsRemaining])).toEqual([
      ['alice', 3],
      ['bob', 3],
    ]);
  });

  it('readies exhausted enemies (4.3), which engage investigators at their location', () => {
    const { context, state: started } = aliceInHall
      .withCard(instanceId('ghoul'), ghoulCard, atLocation(hall))
      .start();
    const state = stateAfter(
      context,
      started,
      { type: 'DisengageEnemy', enemyId: instanceId('ghoul') },
      { type: 'ExhaustEnemy', enemyId: instanceId('ghoul') },
    );

    const upkeep = stateAfter(context, state, next, ...turnsOf(alice), next, next);

    expect(upkeep.cards[instanceId('ghoul')]).toMatchObject({
      exhausted: false,
      zone: engagedWith(alice),
    });
  });

  it('gives each active investigator 1 resource (4.4)', () => {
    const { context, state: started } = table
      .withInvestigator(alice, { locationId: hall, resources: 0 })
      .withInvestigator(bob, { locationId: hall, resources: 0, sanity: { max: 3, horror: 0 } })
      .start();
    const state = stateAfter(
      context,
      started,
      next,
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'horror', delta: 3 },
      ...turnsOf(alice),
    );

    const upkeep = stateAfter(context, state, next, next);

    expect(upkeep.investigators.map((inv) => [inv.id, inv.resources])).toEqual([
      ['alice', 1],
      ['bob', 0],
    ]);
  });

  it('ends the round (4.6): clears the turns taken', () => {
    const { context, state } = aliceInHall.start();
    const enemy = runFrom(context, state, [next, ...turnsOf(alice), next]).state;

    const upkeep = runFrom(context, enemy, [next]).state;

    expect(enemy.meta.turnsTaken).toEqual([alice]);
    expect(upkeep.meta.turnsTaken).toEqual([]);
    expect(upkeep.meta).toMatchObject({ round: 1, phase: 'upkeep', steps: [] });
  });

  it('ends the round (4.6) by discarding the cards that last until the end of the round', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('dissonant_voices'), dissonantVoices, threatAreaOf(alice))
      .withCard(instanceId('plain_treachery'), plainTreachery, threatAreaOf(alice))
      .start();
    const enemy = stateAfter(context, state, next, ...turnsOf(alice), next);

    const upkeep = stateAfter(context, enemy, next);

    expect(upkeep.cards[instanceId('dissonant_voices')]!.zone).toEqual({
      kind: 'encounterDiscard',
    });
    expect(upkeep.cards[instanceId('plain_treachery')]!.zone).toEqual(threatAreaOf(alice));
  });
});

describe('investigation phase', () => {
  it('lets the investigators advance the act during a turn', () => {
    const { context, state } = table
      .withInvestigator(alice, { locationId: hall, clues: 1 })
      .start();
    const turn = stateAfter(context, state, next, { type: 'StartTurn', investigatorId: alice });

    const after = stateAfter(context, turn, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: alice, amount: 1 }],
    });

    expect(after.act.current).toBe(secondAct);
    expect(after.meta.turn).toEqual({ investigatorId: alice });
    expect(checkInvariants(after)).toEqual([]);
  });
});
