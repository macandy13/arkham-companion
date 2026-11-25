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

  it('logs a free move with no cost raised as spending 0 actions, and records it as taken', () => {
    const study = instanceId('study');
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withConnection(hall, study)
        .withInvestigator(alice, { locationId: hall })
        .withTurnOf(alice),
    );

    table.moveTo(alice, study, { free: true });

    expect(table.board.investigator(alice).actions).toBe(3);
    expect(table.events).toContainEqual({
      type: 'ActionsSpent',
      investigatorId: alice,
      amount: 0,
      for: { kind: 'basic', action: 'move' },
    });
    expect(table.state.meta.actionsTaken).toEqual([{ investigatorId: alice, action: 'move' }]);
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

describe('actionCost of an action aimed at a location', () => {
  const cellar = instanceId('cellar');
  /** A location like Waterfront District: investigating it costs 1 more. */
  const slowToSearch = blankLocation('slow_to_search', {
    modifiers: [{ value: 'actionCost', of: 'self', actions: ['investigate'], by: 1 }],
  });
  /** A treachery like Arcane Lock: entering or leaving the location it is attached to costs 1 more. */
  const lockCard = blankTreachery('lock', {
    modifiers: [{ value: 'actionCost', of: 'host', actions: ['enter', 'leave'], by: 1 }],
  });

  it('costs alice and bob in the search-resistant hall 2 to investigate it', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, slowToSearch, { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withInvestigator(bob, { locationId: hall })
        .withTurnOf(alice),
    );

    expect(table.board.actionCost(alice, 'investigate')).toBe(2);
    expect(table.board.actionCost(bob, 'investigate')).toBe(2);
  });

  it('costs the usual action to investigate the hall while it is unrevealed', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, slowToSearch, { revealed: false })
        .withInvestigator(alice, { locationId: hall })
        .withTurnOf(alice),
    );

    expect(table.board.actionCost(alice, 'investigate')).toBe(1);
  });

  describe('alice in the hall, a lock attached to the cellar', () => {
    const study = instanceId('study');
    const lockedCellar = () =>
      PlayTable.start(
        newGame()
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withLocation(cellar, blankLocation('cellar'), { revealed: true })
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withConnection(hall, cellar)
          .withInvestigator(alice, { locationId: hall })
          .withCard(instanceId('lock'), lockCard, { kind: 'attachedTo', hostId: cellar })
          .withTurnOf(alice),
      );

    it.each([
      { to: 'cellar', free: false, cost: 2 },
      { to: 'cellar', free: true, cost: 1 },
      { to: 'study', free: false, cost: 1 },
    ])('costs $cost to move to the $to (free: $free)', ({ to, free, cost }) => {
      expect(lockedCellar().board.actionCost(alice, 'move', { free, to: instanceId(to) })).toBe(
        cost,
      );
    });

    it('costs the usual action for a move whose destination is not named', () => {
      expect(lockedCellar().board.actionCost(alice, 'move')).toBe(1);
    });

    it('pays 2 actions for the move action into the cellar', () => {
      const table = lockedCellar();

      table.moveTo(alice, cellar);

      expect(table.board.investigator(alice)).toMatchObject({ at: 'cellar', actions: 1 });
    });
  });

  it('costs alice 2 to move out of the locked cellar', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(cellar, blankLocation('cellar'), { revealed: true })
        .withInvestigator(alice, { locationId: cellar })
        .withCard(instanceId('lock'), lockCard, { kind: 'attachedTo', hostId: cellar })
        .withTurnOf(alice),
    );

    expect(table.board.actionCost(alice, 'move', { to: hall })).toBe(2);
  });

  it('costs alice the usual action to investigate the locked cellar', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(cellar, blankLocation('cellar'), { revealed: true })
        .withInvestigator(alice, { locationId: cellar })
        .withCard(instanceId('lock'), lockCard, { kind: 'attachedTo', hostId: cellar })
        .withTurnOf(alice),
    );

    expect(table.board.actionCost(alice, 'investigate')).toBe(1);
  });

  it('costs alice 3 to move from the locked cellar into the locked hall', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(cellar, blankLocation('cellar'), { revealed: true })
        .withInvestigator(alice, { locationId: cellar })
        .withCard(instanceId('cellar_lock'), lockCard, { kind: 'attachedTo', hostId: cellar })
        .withCard(instanceId('hall_lock'), lockCard, { kind: 'attachedTo', hostId: hall })
        .withTurnOf(alice),
    );

    expect(table.board.actionCost(alice, 'move', { to: hall })).toBe(3);
  });
});
