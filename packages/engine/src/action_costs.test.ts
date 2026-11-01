import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  blankTreachery,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  threatAreaOf,
  type BasicAction,
} from './index';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');

/** A treachery like Frozen in Fear: the first move, fight or evade each round costs 1 more. */
const frozenCard = blankTreachery('frozen', {
  actionCosts: [
    { actions: ['move', 'fight', 'evade'], by: 1, who: 'threatArea', first: 'eachRound' },
  ],
});
/** A treachery that makes every investigate action cost 1 more, not only the first. */
const slowingCard = blankTreachery('slowing', {
  actionCosts: [{ actions: ['investigate'], by: 1, who: 'threatArea' }],
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

  it.each<{ first: BasicAction; then: BasicAction; cost: number }>([
    { first: 'fight', then: 'move', cost: 1 },
    { first: 'move', then: 'evade', cost: 1 },
    { first: 'investigate', then: 'fight', cost: 2 },
  ])(
    'costs alice $cost for a $then after counting off a $first this round',
    ({ first, then, cost }) => {
      const table = aliceFrozen();

      table.spendActionFor(alice, first);

      expect(table.board.actionCost(alice, then)).toBe(cost);
    },
  );

  it("counts off 2 actions for alice's first fight and records it for the round", () => {
    const table = aliceFrozen();

    table.spendActionFor(alice, 'fight');

    expect(table.board.investigator(alice).actions).toBe(1);
    expect(table.state.meta.actionsTaken).toEqual([{ investigatorId: alice, action: 'fight' }]);
  });

  it("raises alice's first move again once the round has ended", () => {
    const table = aliceFrozen();
    table.spendActionFor(alice, 'move');
    table.endTurn(alice);
    table.startTurn(bob);
    table.endTurn(bob);

    table.nextPhase();
    table.nextPhase();

    expect(table.state.meta.actionsTaken).toBeUndefined();
    expect(table.board.actionCost(alice, 'move')).toBe(2);
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

    table.spendActionFor(alice, 'investigate');

    expect(table.board.actionCost(alice, 'investigate')).toBe(2);
  });

  it('refuses a first fight that costs 2 when alice has only 1 action left', () => {
    const table = aliceFrozen();
    table.spendAction(alice, 2);

    expect(() => table.spendActionFor(alice, 'fight')).toThrow(/invalidActionAdjustment|actions/);
    expect(table.board.investigator(alice).actions).toBe(1);
  });
});
