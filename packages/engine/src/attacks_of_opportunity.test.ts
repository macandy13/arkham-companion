import { describe, expect, it } from 'vitest';
import {
  cardCode,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  type Command,
  type DecisionId,
  type GameState,
  type InstanceId,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  investigatorOf,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const ghoul = instanceId('ghoul');
const rat = instanceId('rat');

/**
 * Hall and cellar, connected. The ghoul deals 1 damage and 2 horror, the rat
 * 1 damage and no horror; the massive brute 2 damage and 1 horror.
 */
const ctx = contextWith(
  makeCard({ code: 'hall', name: 'Hall', typeCode: 'location', shroud: 2 }),
  makeCard({ code: 'cellar', name: 'Cellar', typeCode: 'location' }),
  makeCard({ code: 'ghoul', name: 'Ghoul', typeCode: 'enemy', damage: 1, horror: 2 }),
  makeCard({ code: 'rat', name: 'Rat', typeCode: 'enemy', damage: 1, horror: 0 }),
  makeCard({
    code: 'brute',
    name: 'Brute',
    typeCode: 'enemy',
    damage: 2,
    horror: 1,
    keywords: [{ name: 'massive' }],
  }),
);

const engagedWithAlice: Zone = { kind: 'engaged', investigatorId: alice };
const moveToCellar: Command = { type: 'MoveInvestigator', investigatorId: alice, to: cellar };
const ghoulAttack = decisionId(`attackOfOpportunity:${ghoul}`);

function placed(id: InstanceId, code: string, zone: Zone): StartingCard {
  return { id, code: cardCode(code), zone };
}

/**
 * Round 1, investigation phase, with alice's turn in progress: alice (8
 * health, 6 sanity, unless `aliceStats` says otherwise) in the hall with
 * `cards`, and any `others` after her in seat order.
 */
function aliceTurnWith(
  cards: StartingCard[],
  aliceStats: Partial<Investigator> = {},
  others: Investigator[] = [],
): GameState {
  const started = startBoard(ctx, {
    maps: {
      main: {
        locations: { hall: 'hall', cellar: 'cellar' },
        connections: [edge('hall', 'cellar')],
      },
    },
    investigators: [makeInvestigator({ id: 'alice', locationId: hall, ...aliceStats }), ...others],
    cards,
  });
  return stateAfter(
    ctx,
    started,
    { type: 'NextPhase' },
    { type: 'StartTurn', investigatorId: alice },
  );
}

function pendingIds(state: GameState): string[] {
  return state.pending.map((decision) => decision.id);
}

function wounds(state: GameState): { damage: number; horror: number } {
  const { health, sanity } = investigatorOf(state, alice);
  return { damage: health.damage, horror: sanity.horror };
}

describe('attacks of opportunity', () => {
  it('asks the moving investigator to resolve the attack of a ready engaged enemy, at its printed damage and horror', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, moveToCellar);

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
                damage: 1,
                horror: 2,
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
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, moveToCellar, {
      type: 'ResolveDecision',
      decisionId: ghoulAttack,
      optionId: 'attack',
    });

    expect(wounds(after)).toEqual({ damage: 1, horror: 2 });
    expect(after.cards[ghoul]?.exhausted).toBe(false);
    expect(after.pending).toEqual([]);
  });

  it('deals the damage and horror the players lower it to when assets soak part of the attack', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, moveToCellar, {
      type: 'ResolveDecision',
      decisionId: ghoulAttack,
      optionId: 'attack',
      amounts: { horror: 0 },
    });

    expect(wounds(after)).toEqual({ damage: 1, horror: 0 });
  });

  it('rejects a negative amount for the attack', () => {
    const state = stateAfter(
      ctx,
      aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]),
      moveToCellar,
    );

    expect(
      rejectionFrom(ctx, state, {
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

  it('deals nothing when the players skip it for an action that does not provoke', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, moveToCellar, {
      type: 'ResolveDecision',
      decisionId: ghoulAttack,
      optionId: 'skip',
    });

    expect(wounds(after)).toEqual({ damage: 0, horror: 0 });
  });

  it('defeats the investigator once with damage and horror counted together', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)], {
      health: { max: 8, damage: 7 },
      sanity: { max: 6, horror: 5 },
    });

    const { events } = execute(ctx, stateAfter(ctx, state, moveToCellar), {
      type: 'ResolveDecision',
      decisionId: ghoulAttack,
      optionId: 'attack',
    });

    expect(events.filter((event) => event.type === 'InvestigatorDefeated')).toEqual([
      { type: 'InvestigatorDefeated', investigatorId: alice, cause: 'damage' },
    ]);
  });

  it('asks once per ready engaged enemy, and drops the second attack once the first defeated the investigator', () => {
    const state = aliceTurnWith(
      [placed(ghoul, 'ghoul', engagedWithAlice), placed(rat, 'rat', engagedWithAlice)],
      { health: { max: 8, damage: 7 } },
    );
    const moved = stateAfter(ctx, state, moveToCellar);

    const after = stateAfter(ctx, moved, {
      type: 'ResolveDecision',
      decisionId: ghoulAttack,
      optionId: 'attack',
    });

    expect(pendingIds(moved)).toEqual([
      `attackOfOpportunity:${ghoul}`,
      `attackOfOpportunity:${rat}`,
    ]);
    expect(investigatorOf(after, alice).status).toBe('defeated');
    expect(wounds(after)).toEqual({ damage: 8, horror: 2 });
    // The defeat leaves the rat unengaged in the hall, so it has nobody to attack.
    expect(after.cards[rat]?.zone).toEqual({ kind: 'atLocation', locationId: hall });
    expect(pendingIds(after)).toEqual([]);
  });

  it('lets the other engaged enemy attack an engage action, but not the enemy being engaged', () => {
    const bob = makeInvestigator({ id: 'bob', seat: 1, locationId: hall });
    const state = aliceTurnWith(
      [
        placed(ghoul, 'ghoul', engagedWithAlice),
        placed(rat, 'rat', { kind: 'engaged', investigatorId: bob.id }),
      ],
      {},
      [bob],
    );

    const after = stateAfter(ctx, state, {
      type: 'EngageEnemy',
      enemyId: rat,
      investigatorId: alice,
    });

    expect(pendingIds(after)).toEqual([`attackOfOpportunity:${ghoul}`]);
  });

  it('includes a ready massive enemy at the investigator location', () => {
    const brute = instanceId('brute');
    const state = aliceTurnWith([placed(brute, 'brute', { kind: 'atLocation', locationId: hall })]);

    const after = stateAfter(ctx, state, moveToCellar);

    expect(pendingIds(after)).toEqual([`attackOfOpportunity:${brute}`]);
  });

  it.each<[string, Command]>([
    ['a fight action', { type: 'Fight', investigatorId: alice, enemyId: ghoul }],
    ['an evade action', { type: 'Evade', investigatorId: alice, enemyId: ghoul }],
    ['counting off an action', { type: 'AdjustActions', investigatorId: alice, delta: -1 }],
    ['a card effect moving her anywhere', { ...moveToCellar, ignoreConnections: true }],
  ])('does not ask for %s', (_, command) => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, command);

    expect(pendingIds(after)).not.toContain(`attackOfOpportunity:${ghoul}`);
  });

  it('does not ask when the engaged enemy is exhausted', () => {
    const state = stateAfter(ctx, aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]), {
      type: 'ExhaustEnemy',
      enemyId: ghoul,
    });

    const after = stateAfter(ctx, state, moveToCellar);

    expect(after.pending).toEqual([]);
  });

  it('does not ask for a move outside the investigator turn', () => {
    const state = stateAfter(ctx, aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]), {
      type: 'EndTurn',
      investigatorId: alice,
    });

    const after = stateAfter(ctx, state, moveToCellar);

    expect(after.pending).toEqual([]);
  });

  it('does not ask when a decision answer moves the investigator', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);
    const offer = decisionId('secret_passage');

    const after = stateAfter(
      ctx,
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
      { type: 'ResolveDecision', decisionId: offer, optionId: 'yes' },
    );

    expect(investigatorOf(after, alice).locationId).toBe(cellar);
    expect(after.pending).toEqual([]);
  });
});

describe('the action that provokes attacks of opportunity', () => {
  const ratAttack = decisionId(`attackOfOpportunity:${rat}`);
  const answer = (id: DecisionId, optionId: 'attack' | 'skip'): Command => ({
    type: 'ResolveDecision',
    decisionId: id,
    optionId,
  });

  it('waits in the hall until the attack is answered, then moves', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const asked = stateAfter(ctx, state, moveToCellar);
    const answered = stateAfter(ctx, asked, answer(ghoulAttack, 'attack'));

    expect(investigatorOf(asked, alice).locationId).toBe(hall);
    expect(asked.meta.heldAction).toEqual(moveToCellar);
    expect(investigatorOf(answered, alice).locationId).toBe(cellar);
    expect(answered.meta.heldAction).toBeUndefined();
  });

  it('moves after a skipped attack too', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, moveToCellar, answer(ghoulAttack, 'skip'));

    expect(investigatorOf(after, alice).locationId).toBe(cellar);
  });

  it('engages the enemy waiting in the cellar only once the held move resumes', () => {
    const state = aliceTurnWith([
      placed(ghoul, 'ghoul', engagedWithAlice),
      placed(rat, 'rat', { kind: 'atLocation', locationId: cellar }),
    ]);

    const asked = stateAfter(ctx, state, moveToCellar);
    const answered = stateAfter(ctx, asked, answer(ghoulAttack, 'attack'));

    expect(asked.cards[rat]?.zone).toEqual({ kind: 'atLocation', locationId: cellar });
    expect(answered.cards[rat]?.zone).toEqual(engagedWithAlice);
    expect(answered.cards[ghoul]?.zone).toEqual(engagedWithAlice);
  });

  it('drops the move when the attack defeats the investigator, who stays in the hall', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)], {
      health: { max: 8, damage: 7 },
    });

    const { events, state: after } = execute(
      ctx,
      stateAfter(ctx, state, moveToCellar),
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
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);
    const cellarRemoved = stateAfter(ctx, state, moveToCellar, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: cellar, to: { kind: 'outOfGame' } },
    });

    const { events } = execute(ctx, cellarRemoved, answer(ghoulAttack, 'attack'));

    expect(events.map((event) => event.type)).not.toContain('ActionResumed');
    expect(events.at(-1)).toMatchObject({
      type: 'ActionDropped',
      command: moveToCellar,
      reason: { code: 'notALocation' },
    });
    expect(events.some((event) => event.type === 'InvestigatorMoved')).toBe(false);
  });

  it('asks for the investigate test only after the attack is resolved', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const asked = stateAfter(ctx, state, { type: 'Investigate', investigatorId: alice });
    const answered = stateAfter(ctx, asked, answer(ghoulAttack, 'attack'));

    expect(pendingIds(asked)).toEqual([`attackOfOpportunity:${ghoul}`]);
    expect(pendingIds(answered)).toEqual([`investigate:${alice}`]);
  });

  it.each<[string, DecisionId, DecisionId]>([
    ['ghoul first', ghoulAttack, ratAttack],
    ['rat first', ratAttack, ghoulAttack],
  ])('moves once both attacks are answered, in any order (%s)', (_, first, second) => {
    const state = aliceTurnWith([
      placed(ghoul, 'ghoul', engagedWithAlice),
      placed(rat, 'rat', engagedWithAlice),
    ]);

    const halfway = stateAfter(ctx, state, moveToCellar, answer(first, 'attack'));
    const after = stateAfter(ctx, halfway, answer(second, 'attack'));

    expect(investigatorOf(halfway, alice).locationId).toBe(hall);
    expect(investigatorOf(after, alice).locationId).toBe(cellar);
    expect(wounds(after)).toEqual({ damage: 2, horror: 2 });
  });

  it('rejects an illegal action before any enemy attacks', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    expect(
      rejectionFrom(ctx, state, { type: 'MoveInvestigator', investigatorId: alice, to: hall }),
    ).toEqual({ code: 'alreadyAtLocation', investigatorId: alice, locationId: hall });
  });
});

describe('DealEnemyAttack', () => {
  it('deals damage and horror without exhausting the enemy', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);

    const after = stateAfter(ctx, state, {
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
    const state = aliceTurnWith([placed(ghoul, 'ghoul', engagedWithAlice)]);
    const nobody = investigatorId('nobody');

    expect(
      rejectionFrom(ctx, state, {
        type: 'DealEnemyAttack',
        enemyId: ghoul,
        investigatorId: nobody,
        damage: 1,
        horror: 0,
      }),
    ).toEqual({ code: 'unknownInvestigator', investigatorId: nobody });
  });

  it('does nothing when the enemy is no longer in play', () => {
    const state = aliceTurnWith([placed(ghoul, 'ghoul', { kind: 'encounterDiscard' })]);

    const { events } = execute(ctx, state, {
      type: 'DealEnemyAttack',
      enemyId: ghoul,
      investigatorId: alice,
      damage: 1,
      horror: 2,
    });

    expect(events).toEqual([]);
  });
});
