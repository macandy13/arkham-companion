import { describe, expect, it } from 'vitest';
import {
  apply,
  atLocation,
  blankEnemy,
  blankLocation,
  decisionId,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  type Command,
  type DecisionId,
  type GameState,
  type QueuedStep,
} from './index';
import { answer, investigatorOf, pendingIds, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const ghoul = instanceId('ghoul');
const rat = instanceId('rat');

/** An enemy dealing 1 damage and 2 horror. */
const ghoulCard = blankEnemy('ghoul', { damage: 1, horror: 2 });
/** An enemy dealing 1 damage and no horror. */
const ratCard = blankEnemy('rat', { damage: 1 });
/** A massive enemy dealing 2 damage and 1 horror. */
const bruteCard = blankEnemy('brute', { damage: 2, horror: 1, keywords: [{ name: 'massive' }] });

/** Hall and cellar, connected, without investigators. */
const hallAndCellar = newGame()
  .withLocation(hall, blankLocation('hall'))
  .withLocation(cellar, blankLocation('cellar'))
  .withConnection(hall, cellar);

/** Alice (8 health, 6 sanity) in the hall. */
const aliceInHall = hallAndCellar.withInvestigator(alice, { locationId: hall });

/** Alice in the hall, engaged with the ghoul. */
const ghoulOnAlice = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice));

const moveToCellar: Command = {
  type: 'MoveInvestigator',
  investigatorId: alice,
  to: cellar,
  asAction: true,
};
const ghoulAttack = decisionId(`attackOfOpportunity:${ghoul}`);

function wounds(state: GameState): { damage: number; horror: number } {
  const { health, sanity } = investigatorOf(state, alice);
  return { damage: health.damage, horror: sanity.horror };
}

describe('attacks of opportunity', () => {
  it('asks the moving investigator to resolve the attack of a ready engaged enemy, at its printed damage and horror', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, moveToCellar);

    expect(after.pending).toEqual([
      {
        id: ghoulAttack,
        kind: 'confirm',
        subject: ghoul,
        prompt: 'decision.attackOfOpportunity',
        decider: { kind: 'investigator', investigatorId: alice },
        options: [
          {
            id: 'attack',
            label: 'decision.attack',
            commands: [
              {
                type: 'DealEnemyAttack',
                enemyId: ghoul,
                investigatorId: alice,
                damage: { answer: 'damage' },
                horror: { answer: 'horror' },
              },
            ],
            amounts: { damage: { default: 1, min: 0 }, horror: { default: 2, min: 0 } },
          },
          { id: 'skip', label: 'decision.doesNotProvoke', commands: [] },
        ],
      },
    ]);
  });

  it('deals the printed damage and horror on confirm and leaves the enemy ready', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, moveToCellar, answer(ghoulAttack, 'attack'));

    expect(wounds(after)).toEqual({ damage: 1, horror: 2 });
    expect(after.cards[ghoul]?.exhausted).toBe(false);
    expect(after.pending).toEqual([]);
  });

  it('deals the damage and horror the players lower it to when assets soak part of the attack', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, moveToCellar, {
      type: 'ResolveDecision',
      decisionId: ghoulAttack,
      optionId: 'attack',
      amounts: { horror: 0 },
    });

    expect(wounds(after)).toEqual({ damage: 1, horror: 0 });
  });

  it('rejects a negative amount for the attack', () => {
    const { context, state: started } = ghoulOnAlice.withTurnOf(alice).start();
    const state = stateAfter(context, started, moveToCellar);

    expect(
      rejectionFrom(context, state, {
        type: 'ResolveDecision',
        decisionId: ghoulAttack,
        optionId: 'attack',
        amounts: { damage: -1 },
      }),
    ).toEqual({
      code: 'amountOutOfRange',
      decisionId: ghoulAttack,
      optionId: 'attack',
      name: 'damage',
      amount: -1,
      min: 0,
    });
  });

  it('rejects counts for the skip answer, which deals nothing to lower', () => {
    const { context, state: started } = ghoulOnAlice.withTurnOf(alice).start();
    const state = stateAfter(context, started, moveToCellar);

    expect(
      rejectionFrom(context, state, {
        type: 'ResolveDecision',
        decisionId: ghoulAttack,
        optionId: 'skip',
        amounts: { horror: 0 },
      }),
    ).toEqual({
      code: 'amountNotAdjustable',
      decisionId: ghoulAttack,
      optionId: 'skip',
      name: 'horror',
    });
  });

  it('deals nothing when the players skip it for an action that does not provoke', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, moveToCellar, answer(ghoulAttack, 'skip'));

    expect(wounds(after)).toEqual({ damage: 0, horror: 0 });
  });

  it('defeats the investigator once with damage and horror counted together', () => {
    const { context, state } = hallAndCellar
      .withInvestigator(alice, {
        locationId: hall,
        health: { max: 8, damage: 7 },
        sanity: { max: 6, horror: 5 },
      })
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .withTurnOf(alice)
      .start();

    const { events } = execute(
      context,
      stateAfter(context, state, moveToCellar),
      answer(ghoulAttack, 'attack'),
    );

    expect(events.filter((event) => event.type === 'InvestigatorDefeated')).toEqual([
      { type: 'InvestigatorDefeated', investigatorId: alice, cause: 'damageAndHorror' },
    ]);
  });

  it('asks once per ready engaged enemy, and drops the second attack once the first defeated the investigator', () => {
    const { context, state } = hallAndCellar
      .withInvestigator(alice, { locationId: hall, health: { max: 8, damage: 7 } })
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .withCard(rat, ratCard, engagedWith(alice))
      .withTurnOf(alice)
      .start();
    const moved = stateAfter(context, state, moveToCellar);

    const after = stateAfter(context, moved, answer(ghoulAttack, 'attack'));

    expect(pendingIds(moved)).toEqual([
      `attackOfOpportunity:${ghoul}`,
      `attackOfOpportunity:${rat}`,
    ]);
    expect(investigatorOf(after, alice).status).toBe('defeated');
    expect(wounds(after)).toEqual({ damage: 8, horror: 2 });
    // The defeat leaves the rat unengaged in the hall, so it has nobody to attack.
    expect(after.cards[rat]?.zone).toEqual(atLocation(hall));
    expect(pendingIds(after)).toEqual([]);
  });

  it('lets the other engaged enemy attack an engage action, but not the enemy being engaged', () => {
    const bob = investigatorId('bob');
    const { context, state } = ghoulOnAlice
      .withInvestigator(bob, { locationId: hall })
      .withCard(rat, ratCard, engagedWith(bob))
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, {
      type: 'EngageEnemy',
      enemyId: rat,
      investigatorId: alice,
      asAction: true,
    });

    expect(pendingIds(after)).toEqual([`attackOfOpportunity:${ghoul}`]);
  });

  it('lets no enemy attack when a card effect makes bob`s rat engage alice', () => {
    const bob = investigatorId('bob');
    const { context, state } = ghoulOnAlice
      .withInvestigator(bob, { locationId: hall })
      .withCard(rat, ratCard, engagedWith(bob))
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, {
      type: 'EngageEnemy',
      enemyId: rat,
      investigatorId: alice,
    });

    expect(pendingIds(after)).toEqual([]);
  });

  it('includes a ready massive enemy at the investigator location', () => {
    const brute = instanceId('brute');
    const { context, state } = aliceInHall
      .withCard(brute, bruteCard, atLocation(hall))
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, moveToCellar);

    expect(pendingIds(after)).toEqual([`attackOfOpportunity:${brute}`]);
  });

  it.each<[string, Command]>([
    ['a fight action', { type: 'Fight', investigatorId: alice, enemyId: ghoul }],
    ['an evade action', { type: 'Evade', investigatorId: alice, enemyId: ghoul }],
    ['counting off an action', { type: 'AdjustActions', investigatorId: alice, delta: -1 }],
    [
      'a card effect moving her to a connecting location',
      { type: 'MoveInvestigator', investigatorId: alice, to: cellar },
    ],
    [
      'a card effect moving her anywhere',
      { type: 'MoveInvestigator', investigatorId: alice, to: cellar, ignoreConnections: true },
    ],
    ['a card effect making her investigate', { type: 'Investigate', investigatorId: alice }],
  ])('does not ask for %s', (_, command) => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, command);

    expect(pendingIds(after)).not.toContain(`attackOfOpportunity:${ghoul}`);
  });

  it('does not ask when the engaged enemy is exhausted', () => {
    const { context, state: started } = ghoulOnAlice.withTurnOf(alice).start();
    const state = stateAfter(context, started, {
      type: 'ExhaustEnemy',
      enemyId: ghoul,
    });

    const after = stateAfter(context, state, moveToCellar);

    expect(after.pending).toEqual([]);
  });

  it('does not ask for a move outside the investigator turn', () => {
    const { context, state: started } = ghoulOnAlice.withTurnOf(alice).start();
    const state = stateAfter(context, started, {
      type: 'EndTurn',
      investigatorId: alice,
    });

    const after = stateAfter(context, state, moveToCellar);

    expect(after.pending).toEqual([]);
  });

  it('does not ask when a decision answer moves the investigator', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();
    const offer = decisionId('secret_passage');

    const after = stateAfter(
      context,
      state,
      {
        type: 'RequestDecision',
        decision: {
          id: offer,
          kind: 'confirm',
          prompt: 'take the secret passage',
          decider: { kind: 'lead' },
          options: [{ id: 'yes', label: 'decision.yes', commands: [moveToCellar] }],
        },
      },
      answer(offer, 'yes'),
    );

    expect(investigatorOf(after, alice).locationId).toBe(cellar);
    expect(after.pending).toEqual([]);
  });
});

describe('the action that provokes attacks of opportunity', () => {
  const ratAttack = decisionId(`attackOfOpportunity:${rat}`);
  it('waits in the hall until the attack is answered, then moves', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const asked = stateAfter(context, state, moveToCellar);
    const answered = stateAfter(context, asked, answer(ghoulAttack, 'attack'));

    expect(investigatorOf(asked, alice).locationId).toBe(hall);
    expect(asked.meta.queue).toEqual([{ kind: 'action', command: moveToCellar }]);
    expect(investigatorOf(answered, alice).locationId).toBe(cellar);
    expect(answered.meta.queue).toBeUndefined();
  });

  it('moves after a skipped attack too', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, moveToCellar, answer(ghoulAttack, 'skip'));

    expect(investigatorOf(after, alice).locationId).toBe(cellar);
  });

  it('engages the enemy waiting in the cellar only once the held move resumes', () => {
    const { context, state } = ghoulOnAlice
      .withCard(rat, ratCard, atLocation(cellar))
      .withTurnOf(alice)
      .start();

    const asked = stateAfter(context, state, moveToCellar);
    const answered = stateAfter(context, asked, answer(ghoulAttack, 'attack'));

    expect(asked.cards[rat]?.zone).toEqual(atLocation(cellar));
    expect(answered.cards[rat]?.zone).toEqual(engagedWith(alice));
    expect(answered.cards[ghoul]?.zone).toEqual(engagedWith(alice));
  });

  it('drops the move when the attack defeats the investigator, who stays in the hall', () => {
    const { context, state } = hallAndCellar
      .withInvestigator(alice, { locationId: hall, health: { max: 8, damage: 7 } })
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .withTurnOf(alice)
      .start();

    const { events, state: after } = execute(
      context,
      stateAfter(context, state, moveToCellar),
      answer(ghoulAttack, 'attack'),
    );

    expect(investigatorOf(after, alice).status).toBe('defeated');
    expect(investigatorOf(after, alice).locationId).toBe(hall);
    expect(events).toContainEqual({
      type: 'ActionDropped',
      command: moveToCellar,
      reason: { code: 'investigatorNotActive', investigatorId: alice },
    });
    expect(events.some((event) => event.type === 'InvestigatorMoved')).toBe(false);
  });

  it('drops the move, with nothing of it left in the log, once the cellar has left play', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();
    const cellarRemoved = stateAfter(context, state, moveToCellar, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: cellar, to: { kind: 'outOfGame' } },
    });

    const { events } = execute(context, cellarRemoved, answer(ghoulAttack, 'attack'));

    expect(events.map((event) => event.type)).not.toContain('StepResumed');
    expect(events.at(-1)).toMatchObject({
      type: 'ActionDropped',
      command: moveToCellar,
      reason: { code: 'notALocation' },
    });
    expect(events.some((event) => event.type === 'InvestigatorMoved')).toBe(false);
  });

  it('asks for the investigate test only after the attack is resolved', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const asked = stateAfter(context, state, {
      type: 'Investigate',
      investigatorId: alice,
      asAction: true,
    });
    const answered = stateAfter(context, asked, answer(ghoulAttack, 'attack'));

    expect(pendingIds(asked)).toEqual([`attackOfOpportunity:${ghoul}`]);
    expect(pendingIds(answered)).toEqual([`investigate:${alice}`]);
  });

  it.each<[string, DecisionId, DecisionId]>([
    ['ghoul first', ghoulAttack, ratAttack],
    ['rat first', ratAttack, ghoulAttack],
  ])('moves once both attacks are answered, in any order (%s)', (_, first, second) => {
    const { context, state } = ghoulOnAlice
      .withCard(rat, ratCard, engagedWith(alice))
      .withTurnOf(alice)
      .start();

    const halfway = stateAfter(context, state, moveToCellar, answer(first, 'attack'));
    const after = stateAfter(context, halfway, answer(second, 'attack'));

    expect(investigatorOf(halfway, alice).locationId).toBe(hall);
    expect(investigatorOf(after, alice).locationId).toBe(cellar);
    expect(wounds(after)).toEqual({ damage: 2, horror: 2 });
  });

  it('rejects an illegal action before any enemy attacks', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    expect(rejectionFrom(context, state, { ...moveToCellar, to: hall })).toEqual({
      code: 'alreadyAtLocation',
      investigatorId: alice,
      locationId: hall,
    });
  });
});

describe('several steps waiting in the queue', () => {
  const skipGhoulAttack: Command = answer(ghoulAttack, 'skip');
  const investigateHall: QueuedStep = {
    kind: 'action',
    command: { type: 'Investigate', investigatorId: alice, asAction: true },
  };
  const surgeFromEmptyDeck: QueuedStep = {
    kind: 'surge',
    draw: { type: 'DrawEncounter', investigatorId: alice },
  };

  const { context, state: started } = ghoulOnAlice.withTurnOf(alice).start();

  /** The ghoul's attack on alice's move to the cellar is open, and `first` waits in front of the move. */
  function moveQueuedBehind(first: QueuedStep): GameState {
    const asked = stateAfter(context, started, moveToCellar);
    return apply(asked, { type: 'StepsQueued', steps: [first] });
  }

  it('resolves every queued step in order once the last answer comes in', () => {
    const { state, events } = execute(
      context,
      moveQueuedBehind(surgeFromEmptyDeck),
      skipGhoulAttack,
    );

    const outcomes = events.filter(
      (event) => event.type === 'StepResumed' || event.type === 'InvestigatorMoved',
    );
    // The surge finds no card to draw; the move follows.
    expect(outcomes.map((event) => event.type)).toEqual([
      'StepResumed',
      'StepResumed',
      'InvestigatorMoved',
    ]);
    expect(investigatorOf(state, alice).locationId).toBe(cellar);
    expect(state.meta.queue).toBeUndefined();
  });

  it('stops after a step that asks something, leaving the rest queued', () => {
    const state = stateAfter(context, moveQueuedBehind(investigateHall), skipGhoulAttack);

    expect(pendingIds(state)).toEqual([`investigate:${alice}`]);
    expect(state.meta.queue).toEqual([{ kind: 'action', command: moveToCellar }]);
    expect(investigatorOf(state, alice).locationId).toBe(hall);
  });
});

describe('DealEnemyAttack', () => {
  it('deals damage and horror without exhausting the enemy', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();

    const after = stateAfter(context, state, {
      type: 'DealEnemyAttack',
      enemyId: ghoul,
      investigatorId: alice,
      damage: 2,
      horror: 1,
    });

    expect(wounds(after)).toEqual({ damage: 2, horror: 1 });
    expect(after.cards[ghoul]?.exhausted).toBe(false);
  });

  it('rejects an unknown investigator', () => {
    const { context, state } = ghoulOnAlice.withTurnOf(alice).start();
    const nobody = investigatorId('nobody');

    expect(
      rejectionFrom(context, state, {
        type: 'DealEnemyAttack',
        enemyId: ghoul,
        investigatorId: nobody,
        damage: 1,
        horror: 0,
      }),
    ).toEqual({ code: 'unknownInvestigator', investigatorId: nobody });
  });

  it('does nothing when the enemy is no longer in play', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, { kind: 'encounterDiscard' })
      .withTurnOf(alice)
      .start();

    const { events } = execute(context, state, {
      type: 'DealEnemyAttack',
      enemyId: ghoul,
      investigatorId: alice,
      damage: 1,
      horror: 2,
    });

    expect(events).toEqual([]);
  });
});
