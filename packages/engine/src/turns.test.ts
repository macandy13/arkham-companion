import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  blankTreachery,
  checkInvariants,
  instanceId,
  investigatorId,
  newGame,
  threatAreaOf,
  zoneKey,
  type Command,
  type GameState,
  type InvestigatorId,
} from './index';
import { answer, investigatorOf, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');

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
const aliceAndBobInHall = newGame()
  .withLocation(hall, blankLocation('hall'))
  .withInvestigator(alice, { locationId: hall })
  .withInvestigator(bob, { locationId: hall });

describe('StartTurn', () => {
  it('starts the turn of the investigator the group picks, in any order', () => {
    const { context, state } = aliceAndBobInHall.start();
    const investigation = stateAfter(context, state, next);

    const bobFirst = stateAfter(context, investigation, startTurn(bob));
    const aliceSecond = stateAfter(context, bobFirst, endTurn(bob), startTurn(alice));

    expect(bobFirst.meta.turn).toEqual({ investigatorId: bob });
    expect(aliceSecond.meta.turn).toEqual({ investigatorId: alice });
    expect(aliceSecond.meta.turnsTaken).toEqual([bob]);
  });

  it('rejects a turn outside the investigation phase', () => {
    const { context, state } = aliceAndBobInHall.start();

    expect(rejectionFrom(context, state, startTurn(alice))).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'setup',
    });
  });

  it('rejects a turn while another one is in progress', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();

    expect(rejectionFrom(context, state, startTurn(bob))).toEqual({
      code: 'turnInProgress',
      investigatorId: alice,
    });
  });

  it('rejects a second turn in the same round', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();
    const turnTaken = stateAfter(context, state, endTurn(alice));

    expect(rejectionFrom(context, turnTaken, startTurn(alice))).toEqual({
      code: 'turnAlreadyTaken',
      investigatorId: alice,
    });
  });

  it('rejects the turn of a defeated investigator', () => {
    const { context, state } = aliceAndBobInHall.start();
    const investigation = stateAfter(context, state, next, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'horror',
      delta: 6,
    });

    expect(rejectionFrom(context, investigation, startTurn(bob))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: bob,
    });
  });
});

describe('EndTurn', () => {
  it('ends the turn and marks it taken for the round', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();
    const ended = stateAfter(context, state, endTurn(alice));

    expect(ended.meta.turn).toBeUndefined();
    expect(ended.meta.turnsTaken).toEqual([alice]);
  });

  it('rejects ending the turn of someone else', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();

    expect(rejectionFrom(context, state, endTurn(bob))).toEqual({
      code: 'turnNotInProgress',
      investigatorId: bob,
      activeInvestigatorId: alice,
    });
  });

  it('rejects ending a turn that never started', () => {
    const { context, state } = aliceAndBobInHall.start();
    const investigation = stateAfter(context, state, next);

    expect(rejectionFrom(context, investigation, endTurn(alice))).toEqual({
      code: 'turnNotInProgress',
      investigatorId: alice,
    });
  });

  it('ends the turn of an investigator who is defeated during it', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();
    const defeated = stateAfter(context, state, {
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
  /** A threat-area treachery with a willpower (3) test at the end of its investigator's turn. */
  const frozenInFearCard = blankTreachery('frozen_in_fear', {
    entersThreatArea: true,
    turnEndTest: { skill: 'willpower', difficulty: 3 },
  });
  /** A threat-area treachery without an end-of-turn test. */
  const dissonantVoicesCard = blankTreachery('dissonant_voices', { entersThreatArea: true });

  /**
   * Alice and bob in the hall, with Frozen in Fear (an end-of-turn willpower
   * test) and Dissonant Voices (none) in alice's threat area and none in bob's.
   */
  const frozenInFearOnAlice = aliceAndBobInHall
    .withCard(frozenInFear, frozenInFearCard, threatAreaOf(alice))
    .withCard(dissonantVoices, dissonantVoicesCard, threatAreaOf(alice));

  const aliceThreatArea = (state: GameState) => state.order[zoneKey(threatAreaOf(alice))];

  it('asks the investigator for the willpower test of Frozen in Fear in their threat area', () => {
    const { context, state } = frozenInFearOnAlice.withTurnOf(alice).start();
    const ended = stateAfter(context, state, endTurn(alice));

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
    const { context, state } = frozenInFearOnAlice.withTurnOf(alice).start();
    const ended = stateAfter(
      context,
      state,
      endTurn(alice),
      answer('turnEnd:frozen_in_fear', result),
    );

    expect(ended.pending).toEqual([]);
    expect(aliceThreatArea(ended)).toEqual(threatArea);
    expect(ended.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual(discard);
  });

  it("does not test at the end of another investigator's turn", () => {
    const { context, state } = frozenInFearOnAlice.withTurnOf(alice).start();
    const bobsTurn = stateAfter(
      context,
      state,
      endTurn(alice),
      answer('turnEnd:frozen_in_fear', 'fail'),
      startTurn(bob),
    );

    expect(stateAfter(context, bobsTurn, endTurn(bob)).pending).toEqual([]);
  });

  it('fires the scenario hook onTurnEnd with the investigator whose turn ended', () => {
    const { context: clueAtTurnEnd, state } = aliceAndBobInHall
      .withHooks({
        onTurnEnd: (_ctx, _state, event) => [
          {
            type: 'AdjustInvestigator',
            investigatorId: event.investigatorId,
            stat: 'clues',
            delta: 1,
          },
        ],
      })
      .withTurnOf(alice)
      .start();

    const ended = stateAfter(clueAtTurnEnd, state, endTurn(alice));

    expect(investigatorOf(ended, alice).clues).toBe(1);
    expect(investigatorOf(ended, bob).clues).toBe(0);
  });
});

describe('remaining actions', () => {
  it('start at 3 for every investigator when the scenario starts', () => {
    const { state: started } = aliceAndBobInHall.start();

    expect(investigatorOf(started, alice).actionsRemaining).toBe(3);
    expect(investigatorOf(started, bob).actionsRemaining).toBe(3);
  });

  it('count down as the players spend actions in the turn', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();
    const afterTwo = stateAfter(context, state, adjustActions(alice, -1), adjustActions(alice, -1));

    expect(investigatorOf(afterTwo, alice).actionsRemaining).toBe(1);
  });

  it('go up for an effect that grants an action this round', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();
    const granted = stateAfter(context, state, adjustActions(alice, 1));

    expect(investigatorOf(granted, alice).actionsRemaining).toBe(4);
  });

  it('change through a manual adjustment as well', () => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();
    const adjusted = stateAfter(context, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'actions', investigatorId: alice, delta: -2 },
    });

    expect(investigatorOf(adjusted, alice).actionsRemaining).toBe(1);
  });

  it('change for any investigator in any phase, since the engine does not police turns', () => {
    const { context, state: setup } = aliceAndBobInHall.start();

    const lostAnAction = stateAfter(context, setup, adjustActions(bob, -1));

    expect(investigatorOf(lostAnAction, bob).actionsRemaining).toBe(2);
  });

  it.each([
    { name: 'a zero change', delta: 0 },
    { name: 'a fractional change', delta: 0.5 },
    { name: 'a count below zero', delta: -4 },
  ])('reject $name', ({ delta }) => {
    const { context, state } = aliceAndBobInHall.withTurnOf(alice).start();

    expect(rejectionFrom(context, state, adjustActions(alice, delta))).toEqual({
      code: 'invalidActionAdjustment',
      investigatorId: alice,
      delta,
      actionsRemaining: 3,
    });
  });

  it('reject a change for a defeated investigator', () => {
    const { context, state } = aliceAndBobInHall.start();
    const defeated = stateAfter(context, state, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'horror',
      delta: 6,
    });

    expect(rejectionFrom(context, defeated, adjustActions(bob, -1))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: bob,
    });
  });
});
