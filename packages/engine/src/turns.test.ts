import { describe, expect, it } from 'vitest';
import {
  actionOf,
  checkInvariants,
  decisionId,
  execute,
  instanceId,
  investigatorId,
  type Command,
  type GameState,
  type Investigator,
} from './index';
import {
  contextWith,
  edge,
  fixed,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const ghoul = instanceId('ghoul');
const aloofGhoul = instanceId('aloof_ghoul');

/**
 * The hall (3 clues) next to the cellar; a ghoul engaged with alice and an
 * aloof ghoul in the hall, which only an engage action engages.
 */
const ctx = contextWith(
  makeCard({ code: 'hall', typeCode: 'location', shroud: 1, clues: fixed(3) }),
  makeCard({ code: 'cellar', typeCode: 'location' }),
  makeCard({ code: 'ghoul', typeCode: 'enemy', fight: 2, evade: 2, health: fixed(3) }),
  makeCard({ code: 'aloof_ghoul', typeCode: 'enemy', keywords: [{ name: 'aloof' }] }),
);

const next: Command = { type: 'NextPhase' };
const startTurn = (investigator: typeof alice): Command => ({
  type: 'StartTurn',
  investigatorId: investigator,
});
const endTurn = (investigator: typeof alice): Command => ({
  type: 'EndTurn',
  investigatorId: investigator,
});
const takeAction = (investigator: typeof alice, action: 'draw' | 'resource'): Command => ({
  type: 'TakeAction',
  investigatorId: investigator,
  action,
});

/** Alice (seat 0, the lead) and bob (seat 1) in the revealed hall, still in setup. */
function aliceAndBobInHall(
  overrides: { alice?: Partial<Investigator>; bob?: Partial<Investigator> } = {},
): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { hall: 'hall', cellar: 'cellar' },
        connections: [edge('hall', 'cellar')],
      },
    },
    investigators: [
      makeInvestigator({ id: 'alice', seat: 0, locationId: hall, ...overrides.alice }),
      makeInvestigator({ id: 'bob', seat: 1, locationId: hall, ...overrides.bob }),
    ],
    cards: [
      { id: ghoul, code: 'ghoul', zone: { kind: 'engaged', investigatorId: alice } },
      { id: aloofGhoul, code: 'aloof_ghoul', zone: { kind: 'atLocation', locationId: hall } },
    ],
  });
}

/** Round 1's investigation phase with alice's turn in progress. */
function aliceTurn(overrides: { alice?: Partial<Investigator> } = {}): GameState {
  return stateAfter(
    ctx,
    aliceAndBobInHall(overrides),
    { type: 'RevealLocation', locationId: hall },
    next,
    startTurn(alice),
  );
}

describe('StartTurn', () => {
  it('starts the turn of the investigator the group picks, in any order', () => {
    const investigation = stateAfter(ctx, aliceAndBobInHall(), next);

    const bobFirst = stateAfter(ctx, investigation, startTurn(bob));
    const aliceSecond = stateAfter(ctx, bobFirst, endTurn(bob), startTurn(alice));

    expect(bobFirst.meta.turn).toEqual({
      investigatorId: bob,
      actionsTaken: 0,
      actionAdjustment: 0,
    });
    expect(aliceSecond.meta.turn?.investigatorId).toBe(alice);
    expect(aliceSecond.meta.turnsTaken).toEqual([bob]);
  });

  it('rejects a turn outside the investigation phase', () => {
    expect(rejectionFrom(ctx, aliceAndBobInHall(), startTurn(alice))).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'setup',
    });
  });

  it('rejects a turn while another one is in progress', () => {
    expect(rejectionFrom(ctx, aliceTurn(), startTurn(bob))).toEqual({
      code: 'turnInProgress',
      investigatorId: alice,
    });
  });

  it('rejects a second turn in the same round', () => {
    const turnTaken = stateAfter(ctx, aliceTurn(), endTurn(alice));

    expect(rejectionFrom(ctx, turnTaken, startTurn(alice))).toEqual({
      code: 'turnAlreadyTaken',
      investigatorId: alice,
    });
  });

  it('rejects the turn of a defeated investigator', () => {
    const investigation = stateAfter(ctx, aliceAndBobInHall(), next, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'horror',
      delta: 6,
    });

    expect(rejectionFrom(ctx, investigation, startTurn(bob))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: bob,
    });
  });
});

describe('EndTurn', () => {
  it('ends the turn and marks it taken for the round', () => {
    const ended = stateAfter(ctx, aliceTurn(), endTurn(alice));

    expect(ended.meta.turn).toBeUndefined();
    expect(ended.meta.turnsTaken).toEqual([alice]);
  });

  it('rejects ending the turn of someone else', () => {
    expect(rejectionFrom(ctx, aliceTurn(), endTurn(bob))).toEqual({
      code: 'notTheirTurn',
      investigatorId: bob,
      activeInvestigatorId: alice,
    });
  });

  it('rejects ending a turn that never started', () => {
    const investigation = stateAfter(ctx, aliceAndBobInHall(), next);

    expect(rejectionFrom(ctx, investigation, endTurn(alice))).toEqual({
      code: 'notTheirTurn',
      investigatorId: alice,
    });
  });

  it('ends the turn of an investigator who is defeated during it', () => {
    const defeated = stateAfter(ctx, aliceTurn(), {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'damage',
      delta: 8,
    });

    expect(defeated.meta.turn).toBeUndefined();
    expect(defeated.meta.turnsTaken).toEqual([alice]);
    expect(checkInvariants(defeated)).toEqual([]);
  });
});

describe('actions', () => {
  it.each<{ name: string; command: Command; kind: string }>([
    {
      name: 'a move',
      command: { type: 'MoveInvestigator', investigatorId: alice, to: cellar },
      kind: 'move',
    },
    {
      name: 'an investigation',
      command: { type: 'Investigate', investigatorId: alice },
      kind: 'investigate',
    },
    {
      name: 'a fight',
      command: { type: 'Fight', investigatorId: alice, enemyId: ghoul },
      kind: 'fight',
    },
    {
      name: 'an evasion',
      command: { type: 'Evade', investigatorId: alice, enemyId: ghoul },
      kind: 'evade',
    },
    {
      name: 'an engagement',
      command: { type: 'EngageEnemy', investigatorId: alice, enemyId: aloofGhoul },
      kind: 'engage',
    },
    { name: 'a card draw', command: takeAction(alice, 'draw'), kind: 'draw' },
    { name: 'a resource', command: takeAction(alice, 'resource'), kind: 'resource' },
    {
      name: 'playing a card',
      command: { type: 'TakeAction', investigatorId: alice, action: 'play' },
      kind: 'play',
    },
    {
      name: 'activating an ability',
      command: { type: 'TakeAction', investigatorId: alice, action: 'activate' },
      kind: 'activate',
    },
  ])('counts $name as one action of the turn', ({ command, kind }) => {
    const { state, events } = execute(ctx, aliceTurn(), command);

    expect(events[0]).toEqual({ type: 'ActionTaken', investigatorId: alice, action: kind });
    expect(state.meta.turn?.actionsTaken).toBe(1);
  });

  it.each<{ name: string; command: Command }>([
    {
      name: 'a move by a card effect',
      command: { type: 'MoveInvestigator', investigatorId: alice, to: cellar, free: true },
    },
    {
      name: 'an engagement by a rule',
      command: { type: 'EngageEnemy', investigatorId: alice, enemyId: aloofGhoul, free: true },
    },
    {
      name: 'a resource from a card',
      command: { type: 'AdjustInvestigator', investigatorId: alice, stat: 'resources', delta: 1 },
    },
    {
      name: 'a clue from a card',
      command: { type: 'DiscoverClues', investigatorId: alice, locationId: hall, amount: 1 },
    },
    {
      name: 'a change of the allowance',
      command: { type: 'AdjustActions', investigatorId: alice, delta: 1 },
    },
  ])('does not count $name', ({ command }) => {
    const after = stateAfter(ctx, aliceTurn(), command);

    expect(after.meta.turn?.actionsTaken).toBe(0);
  });

  it('does not count the answer to a skill test', () => {
    const tested = stateAfter(ctx, aliceTurn(), { type: 'Investigate', investigatorId: alice });

    const answered = stateAfter(ctx, tested, {
      type: 'ResolveDecision',
      decisionId: decisionId('investigate:alice'),
      optionId: 'pass',
    });

    expect(answered.meta.turn?.actionsTaken).toBe(1);
    expect(answered.investigators[0]!.clues).toBe(1);
  });

  it('does not count commands outside the investigation phase', () => {
    const setup = aliceAndBobInHall();

    const moved = stateAfter(ctx, setup, {
      type: 'MoveInvestigator',
      investigatorId: bob,
      to: cellar,
    });

    expect(moved.investigators[1]!.locationId).toBe(cellar);
    expect(moved.meta.turn).toBeUndefined();
  });

  it('gives 1 resource for the resource action', () => {
    const after = stateAfter(
      ctx,
      aliceTurn({ alice: { resources: 5 } }),
      takeAction(alice, 'resource'),
    );

    expect(after.investigators[0]!.resources).toBe(6);
  });

  it('rejects a fourth action', () => {
    const threeTaken = stateAfter(
      ctx,
      aliceTurn(),
      takeAction(alice, 'draw'),
      takeAction(alice, 'draw'),
      takeAction(alice, 'resource'),
    );

    expect(rejectionFrom(ctx, threeTaken, takeAction(alice, 'draw'))).toEqual({
      code: 'noActionsLeft',
      investigatorId: alice,
      allowance: 3,
    });
  });

  it('rejects an action by an investigator whose turn it is not', () => {
    expect(
      rejectionFrom(ctx, aliceTurn(), {
        type: 'MoveInvestigator',
        investigatorId: bob,
        to: cellar,
      }),
    ).toEqual({ code: 'notTheirTurn', investigatorId: bob, activeInvestigatorId: alice });
  });

  it('rejects an action between turns', () => {
    const betweenTurns = stateAfter(ctx, aliceTurn(), endTurn(alice));

    expect(rejectionFrom(ctx, betweenTurns, takeAction(bob, 'draw'))).toEqual({
      code: 'notTheirTurn',
      investigatorId: bob,
    });
  });

  it('rejects a table action outside the investigation phase', () => {
    expect(rejectionFrom(ctx, aliceAndBobInHall(), takeAction(alice, 'draw'))).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'setup',
    });
  });

  it('knows which commands are actions', () => {
    expect(actionOf({ type: 'Investigate', investigatorId: alice })).toEqual({
      kind: 'investigate',
      investigatorId: alice,
    });
    expect(actionOf({ type: 'Investigate', investigatorId: alice, free: true })).toBeUndefined();
    expect(actionOf({ type: 'NextPhase' })).toBeUndefined();
  });
});

describe('action allowance', () => {
  const threeDraws = [
    takeAction(alice, 'draw'),
    takeAction(alice, 'draw'),
    takeAction(alice, 'draw'),
  ];

  it('allows a fourth action in the turn an effect grants one', () => {
    const granted = stateAfter(ctx, aliceTurn(), {
      type: 'AdjustActions',
      investigatorId: alice,
      delta: 1,
    });

    const fourth = stateAfter(ctx, granted, ...threeDraws, takeAction(alice, 'resource'));

    expect(fourth.meta.turn?.actionsTaken).toBe(4);
  });

  it('allows the same through a manual adjustment', () => {
    const granted = stateAfter(ctx, aliceTurn(), {
      type: 'ManualAdjust',
      adjustment: { kind: 'actions', investigatorId: alice, delta: 1 },
    });

    const fourth = stateAfter(ctx, granted, ...threeDraws, takeAction(alice, 'resource'));

    expect(fourth.meta.turn?.actionsTaken).toBe(4);
  });

  it('forgets the extra action when the turn ends', () => {
    const nextRound = stateAfter(
      ctx,
      aliceTurn(),
      { type: 'AdjustActions', investigatorId: alice, delta: 1 },
      endTurn(alice),
      startTurn(bob),
      endTurn(bob),
      next,
      { type: 'ResolveEnemyAttack', enemyId: ghoul, investigatorId: alice },
      next,
      next,
      next,
      startTurn(alice),
      ...threeDraws,
    );

    expect(rejectionFrom(ctx, nextRound, takeAction(alice, 'draw'))).toEqual({
      code: 'noActionsLeft',
      investigatorId: alice,
      allowance: 3,
    });
  });

  it('allows a fourth action in every turn of an investigator with an extra action', () => {
    const fourth = stateAfter(
      ctx,
      aliceTurn({ alice: { extraActions: 1 } }),
      ...threeDraws,
      takeAction(alice, 'resource'),
    );

    expect(fourth.meta.turn?.actionsTaken).toBe(4);
  });

  it('can take an action away', () => {
    const reduced = stateAfter(ctx, aliceTurn(), {
      type: 'AdjustActions',
      investigatorId: alice,
      delta: -1,
    });

    const two = stateAfter(ctx, reduced, takeAction(alice, 'draw'), takeAction(alice, 'draw'));

    expect(rejectionFrom(ctx, two, takeAction(alice, 'draw'))).toEqual({
      code: 'noActionsLeft',
      investigatorId: alice,
      allowance: 2,
    });
  });

  it.each([
    { name: 'a zero change', delta: 0 },
    { name: 'a fractional change', delta: 0.5 },
    { name: 'an allowance below zero', delta: -4 },
  ])('rejects $name', ({ delta }) => {
    expect(
      rejectionFrom(ctx, aliceTurn(), { type: 'AdjustActions', investigatorId: alice, delta }),
    ).toEqual({
      code: 'invalidActionAdjustment',
      investigatorId: alice,
      delta,
      allowance: 3,
    });
  });

  it('rejects changing the allowance of an investigator whose turn it is not', () => {
    expect(
      rejectionFrom(ctx, aliceTurn(), { type: 'AdjustActions', investigatorId: bob, delta: 1 }),
    ).toEqual({
      code: 'notTheirTurn',
      investigatorId: bob,
      activeInvestigatorId: alice,
    });
  });
});
