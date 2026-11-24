import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  threatAreaOf,
  type BasicAction,
} from './index';
import { rejectionOf } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');

/** A treachery like Frozen in Fear: the first move, fight or evade each round costs 1 more. */
const frozenCard = blankTreachery('frozen', {
  modifiers: [
    {
      value: 'actionCost',
      of: 'threatArea',
      actions: ['move', 'fight', 'evade'],
      first: 'eachRound',
      by: 1,
    },
  ],
});
/** A treachery that makes every investigate action cost 1 more, not only the first. */
const slowingCard = blankTreachery('slowing', {
  modifiers: [{ value: 'actionCost', of: 'threatArea', actions: ['investigate'], by: 1 }],
});

describe('actionCost', () => {
  /** Alice and Bob in the hall, Frozen in Fear in Alice's threat area, Alice's turn. */
  const aliceFrozen = () =>
    PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withInvestigator(bob, { locationId: hall })
        .withCard(instanceId('frozen'), frozenCard, threatAreaOf(alice))
        .withTurnOf(alice),
    );

  it.each<{ action: BasicAction; cost: number }>([
    { action: 'move', cost: 2 },
    { action: 'fight', cost: 2 },
    { action: 'evade', cost: 2 },
    { action: 'investigate', cost: 1 },
    { action: 'resource', cost: 1 },
  ])('costs alice $cost for a first $action of the round while frozen', ({ action, cost }) => {
    expect(aliceFrozen().board.actionCost(alice, action)).toBe(cost);
  });

  it('costs bob, whose threat area is empty, the usual 1 for a move', () => {
    expect(aliceFrozen().board.actionCost(bob, 'move')).toBe(1);
  });

  describe('as alice takes actions, the engine counts them off', () => {
    const study = instanceId('study');
    const ghoul = instanceId('ghoul');
    /** `aliceFrozen` with the study next to the hall. */
    const nextToStudy = () =>
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withConnection(hall, study)
        .withInvestigator(alice, { locationId: hall })
        .withInvestigator(bob, { locationId: hall })
        .withCard(instanceId('frozen'), frozenCard, threatAreaOf(alice))
        .withTurnOf(alice);
    const aliceFrozenNextToStudy = () => PlayTable.start(nextToStudy());

    it("counts off 2 actions for alice's first move and records it for the round", () => {
      const table = aliceFrozenNextToStudy();

      table.moveTo(alice, study);

      expect(table.board.investigator(alice).actions).toBe(1);
      expect(table.state.meta.actionsTaken).toEqual([{ investigatorId: alice, action: 'move' }]);
      expect(table.events).toContainEqual({
        type: 'ActionsSpent',
        investigatorId: alice,
        amount: 2,
        for: { kind: 'basic', action: 'move' },
      });
    });

    it('makes a fight after the first move cost alice the usual 1', () => {
      const table = PlayTable.start(
        nextToStudy().withCard(ghoul, blankEnemy('ghoul'), atLocation(study)),
      );
      table.moveTo(alice, study);

      table.fight(alice, ghoul);

      expect(table.board.investigator(alice).actions).toBe(0);
    });

    it('leaves the first fight raised after an investigation, which Frozen in Fear does not name', () => {
      const table = aliceFrozenNextToStudy();

      table.investigate(alice);

      expect(table.board.actionCost(alice, 'fight')).toBe(2);
    });

    it('charges a free first move only its additional action, and counts it as the first', () => {
      const table = aliceFrozenNextToStudy();

      table.moveTo(alice, study, { free: true });

      expect(table.board.investigator(alice).actions).toBe(2);
      expect(table.board.actionCost(alice, 'fight')).toBe(1);
    });

    it('refuses a first move that costs 2 when alice has only 1 action left', () => {
      const table = aliceFrozenNextToStudy();
      table.spendAction(alice, 2);

      expect(rejectionOf(() => table.moveTo(alice, study))).toEqual({
        code: 'invalidActionAdjustment',
        investigatorId: alice,
        delta: -2,
        actionsRemaining: 1,
      });
    });

    it("raises alice's first move again once the round has ended", () => {
      const table = aliceFrozenNextToStudy();
      table.moveTo(alice, study);
      table.endTurn(alice);
      table.startTurn(bob);
      table.endTurn(bob);

      // The enemy phase, then the upkeep phase, whose end ends the round.
      table.nextPhase();
      table.nextPhase();

      expect(table.state.meta.actionsTaken).toBeUndefined();
      expect(table.board.actionCost(alice, 'move')).toBe(2);
    });
  });

  it("adds the cost of each copy: two frozen cards make alice's first move cost 3", () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(instanceId('frozen_1'), frozenCard, threatAreaOf(alice))
        .withCard(instanceId('frozen_2'), frozenCard, threatAreaOf(alice)),
    );

    expect(table.board.actionCost(alice, 'move')).toBe(3);
  });

  it('raises every investigate action, not only the first, without `first`', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(instanceId('slowing'), slowingCard, threatAreaOf(alice))
        .withTurnOf(alice),
    );

    table.investigate(alice);

    expect(table.board.investigator(alice).actions).toBe(1);
    expect(table.board.actionCost(alice, 'investigate')).toBe(2);
  });

  it("leaves alice's first move of the round raised after a correction of her count", () => {
    const table = aliceFrozen();

    table.adjustActions(alice, -1);

    expect(table.state.meta.actionsTaken).toBeUndefined();
    expect(table.board.actionCost(alice, 'move')).toBe(2);
  });

  it.each([
    { amount: -1, case: 'a negative amount' },
    { amount: 4, case: 'more than her 3 actions' },
  ])('refuses spending $case', ({ amount }) => {
    const table = aliceFrozen();

    expect(
      rejectionOf(() =>
        table.play({
          type: 'SpendActions',
          investigatorId: alice,
          amount,
          for: { kind: 'basic', action: 'move' },
        }),
      ),
    ).toMatchObject({ code: 'invalidActionAdjustment', actionsRemaining: 3 });
  });
});
