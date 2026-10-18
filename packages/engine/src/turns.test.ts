import { describe, expect, it } from 'vitest';
import {
  cardCode,
  checkInvariants,
  decisionId,
  instanceId,
  investigatorId,
  zoneKey,
  type Command,
  type GameState,
  type InvestigatorId,
} from './index';
import {
  contextWith,
  investigatorOf,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
  withScenario,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');

const ctx = contextWith(makeCard({ code: 'hall', typeCode: 'location' }));

const next: Command = { type: 'NextPhase' };
const startTurn = (investigator: InvestigatorId): Command => ({
  type: 'StartTurn',
  investigatorId: investigator,
});
const endTurn = (investigator: InvestigatorId): Command => ({
  type: 'EndTurn',
  investigatorId: investigator,
});
const adjustActions = (investigator: InvestigatorId, delta: number): Command => ({
  type: 'AdjustActions',
  investigatorId: investigator,
  delta,
});

/** Alice (seat 0, the lead) and bob (seat 1) in the hall, still in setup. */
function aliceAndBobInHall(): GameState {
  return startBoard(ctx, {
    maps: { main: { locations: { hall: 'hall' } } },
    investigators: [
      makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
      makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
    ],
  });
}

/** Round 1's investigation phase with alice's turn in progress. */
function aliceTurn(): GameState {
  return stateAfter(ctx, aliceAndBobInHall(), next, startTurn(alice));
}

describe('StartTurn', () => {
  it('starts the turn of the investigator the group picks, in any order', () => {
    const investigation = stateAfter(ctx, aliceAndBobInHall(), next);

    const bobFirst = stateAfter(ctx, investigation, startTurn(bob));
    const aliceSecond = stateAfter(ctx, bobFirst, endTurn(bob), startTurn(alice));

    expect(bobFirst.meta.turn).toEqual({ investigatorId: bob });
    expect(aliceSecond.meta.turn).toEqual({ investigatorId: alice });
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
      code: 'turnNotInProgress',
      investigatorId: bob,
      activeInvestigatorId: alice,
    });
  });

  it('rejects ending a turn that never started', () => {
    const investigation = stateAfter(ctx, aliceAndBobInHall(), next);

    expect(rejectionFrom(ctx, investigation, endTurn(alice))).toEqual({
      code: 'turnNotInProgress',
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

describe('the end of a turn', () => {
  const frozenInFear = instanceId('frozen_in_fear');
  const dissonantVoices = instanceId('dissonant_voices');
  const fearCtx = contextWith(
    makeCard({ code: 'hall', typeCode: 'location' }),
    makeCard({
      code: 'frozen_in_fear',
      entersThreatArea: true,
      turnEndTest: { skill: 'willpower', difficulty: 3 },
    }),
    makeCard({ code: 'dissonant_voices', entersThreatArea: true }),
  );

  /**
   * Alice's turn in progress in the hall, with Frozen in Fear (an end-of-turn
   * willpower test) and Dissonant Voices (none) in her threat area; bob in the
   * hall with an empty threat area.
   */
  function aliceTurnFrozenInFear(): GameState {
    const started = startBoard(fearCtx, {
      maps: { main: { locations: { hall: 'hall' } } },
      investigators: [
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
      ],
      cards: [
        {
          id: frozenInFear,
          code: cardCode('frozen_in_fear'),
          zone: { kind: 'threatArea', investigatorId: alice },
        },
        {
          id: dissonantVoices,
          code: cardCode('dissonant_voices'),
          zone: { kind: 'threatArea', investigatorId: alice },
        },
      ],
    });
    return stateAfter(fearCtx, started, next, startTurn(alice));
  }

  const answer = (optionId: string): Command => ({
    type: 'ResolveDecision',
    decisionId: decisionId('turnEnd:frozen_in_fear'),
    optionId,
  });
  const aliceThreatArea = (state: GameState) =>
    state.order[zoneKey({ kind: 'threatArea', investigatorId: alice })];

  it('asks the investigator for the willpower test of Frozen in Fear in their threat area', () => {
    const ended = stateAfter(fearCtx, aliceTurnFrozenInFear(), endTurn(alice));

    expect(ended.meta.turnsTaken).toEqual([alice]);
    expect(ended.pending).toMatchObject([
      {
        id: 'turnEnd:frozen_in_fear',
        kind: 'skillTestResult',
        prompt: 'decision.turnEndTest',
        subject: frozenInFear,
        decider: { kind: 'investigator', investigatorId: alice },
        skillTest: { skill: 'willpower', difficulty: 3 },
      },
    ]);
  });

  it.each([
    { result: 'pass', threatArea: [dissonantVoices], discard: [frozenInFear] },
    { result: 'fail', threatArea: [frozenInFear, dissonantVoices], discard: undefined },
  ])('$result: Frozen in Fear stays only on a fail', ({ result, threatArea, discard }) => {
    const ended = stateAfter(fearCtx, aliceTurnFrozenInFear(), endTurn(alice), answer(result));

    expect(ended.pending).toEqual([]);
    expect(aliceThreatArea(ended)).toEqual(threatArea);
    expect(ended.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual(discard);
  });

  it("does not test at the end of another investigator's turn", () => {
    const bobsTurn = stateAfter(
      fearCtx,
      aliceTurnFrozenInFear(),
      endTurn(alice),
      answer('fail'),
      startTurn(bob),
    );

    expect(stateAfter(fearCtx, bobsTurn, endTurn(bob)).pending).toEqual([]);
  });

  it('fires the scenario hook onTurnEnd with the investigator whose turn ended', () => {
    const clueAtTurnEnd = withScenario(ctx, {
      hooks: {
        onTurnEnd: (_ctx, _state, event) => [
          {
            type: 'AdjustInvestigator',
            investigatorId: event.investigatorId,
            stat: 'clues',
            delta: 1,
          },
        ],
      },
    });

    const ended = stateAfter(clueAtTurnEnd, aliceTurn(), endTurn(alice));

    expect(investigatorOf(ended, alice).clues).toBe(1);
    expect(investigatorOf(ended, bob).clues).toBe(0);
  });
});

describe('remaining actions', () => {
  it('start at 3 for every investigator when the scenario starts', () => {
    const started = aliceAndBobInHall();

    expect(investigatorOf(started, alice).actionsRemaining).toBe(3);
    expect(investigatorOf(started, bob).actionsRemaining).toBe(3);
  });

  it('count down as the players spend actions in the turn', () => {
    const afterTwo = stateAfter(
      ctx,
      aliceTurn(),
      adjustActions(alice, -1),
      adjustActions(alice, -1),
    );

    expect(investigatorOf(afterTwo, alice).actionsRemaining).toBe(1);
  });

  it('go up for an effect that grants an action this round', () => {
    const granted = stateAfter(ctx, aliceTurn(), adjustActions(alice, 1));

    expect(investigatorOf(granted, alice).actionsRemaining).toBe(4);
  });

  it('change through a manual adjustment as well', () => {
    const adjusted = stateAfter(ctx, aliceTurn(), {
      type: 'ManualAdjust',
      adjustment: { kind: 'actions', investigatorId: alice, delta: -2 },
    });

    expect(investigatorOf(adjusted, alice).actionsRemaining).toBe(1);
  });

  it('change for any investigator in any phase, since the engine does not police turns', () => {
    const setup = aliceAndBobInHall();

    const lostAnAction = stateAfter(ctx, setup, adjustActions(bob, -1));

    expect(investigatorOf(lostAnAction, bob).actionsRemaining).toBe(2);
  });

  it.each([
    { name: 'a zero change', delta: 0 },
    { name: 'a fractional change', delta: 0.5 },
    { name: 'a count below zero', delta: -4 },
  ])('reject $name', ({ delta }) => {
    expect(rejectionFrom(ctx, aliceTurn(), adjustActions(alice, delta))).toEqual({
      code: 'invalidActionAdjustment',
      investigatorId: alice,
      delta,
      actionsRemaining: 3,
    });
  });

  it('reject a change for a defeated investigator', () => {
    const defeated = stateAfter(ctx, aliceAndBobInHall(), {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'horror',
      delta: 6,
    });

    expect(rejectionFrom(ctx, defeated, adjustActions(bob, -1))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: bob,
    });
  });
});
