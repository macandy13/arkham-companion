import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  perInvestigator,
  PlayTable,
  resignAction,
  takeHorror,
  threatAreaOf,
  type ActionLimit,
  type CardAction,
  type InstanceId,
  type InvestigatorId,
  type UseCardAction,
} from './index';
import { answer, investigatorOf, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const ghoul = instanceId('ghoul');

/** A plain card action: the investigator who takes it takes 1 horror. */
const scareAction: CardAction = { effects: [takeHorror(1)] };
/**
 * A Parley that scares the investigator who takes it: a Parley provokes no attack of
 * opportunity, so an enemy engaged with them can offer it without attacking first.
 */
const scaryParley: CardAction = { designator: 'parley', effects: [takeHorror(1)] };

/** Hall and cellar, connected, with alice in the hall and bob in the cellar. */
const aliceInHallBobInCellar = newGame()
  .withLocation(hall, blankLocation('hall'))
  .withLocation(cellar, blankLocation('cellar'))
  .withConnection(hall, cellar)
  .withInvestigator(alice, { locationId: hall })
  .withInvestigator(bob, { locationId: cellar });

/** `investigator` takes action number `action` of the card `cardId`, spending an action on it. */
function useAsAction(investigator: InvestigatorId, cardId: InstanceId, action = 0): UseCardAction {
  return { type: 'UseCardAction', investigatorId: investigator, cardId, action, asAction: true };
}

describe('UseCardAction', () => {
  it('resolves the effects of the action for the investigator who takes it', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall', { actions: [scareAction] }), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, useAsAction(alice, hall));

    expect(investigatorOf(after, alice).sanity.horror).toBe(1);
  });

  it('resigns the investigator who takes a Resign action', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('parlor', { actions: [resignAction()] }), {
        revealed: true,
      })
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, useAsAction(alice, hall));

    expect(investigatorOf(after, alice).status).toBe('resigned');
  });

  it.each([
    {
      name: 'the current agenda, from the cellar',
      setup: () =>
        aliceInHallBobInCellar.withAgenda(
          instanceId('agenda'),
          blankAgenda('scary_agenda', null, { actions: [scareAction] }),
        ),
      cardId: instanceId('agenda'),
    },
    {
      name: 'an enemy at the cellar (a Parley)',
      setup: () =>
        aliceInHallBobInCellar.withCard(
          ghoul,
          blankEnemy('scary_ghoul', { actions: [scaryParley] }),
          atLocation(cellar),
        ),
      cardId: ghoul,
    },
    {
      name: 'an enemy engaged with bob (a Parley)',
      setup: () =>
        aliceInHallBobInCellar.withCard(
          ghoul,
          blankEnemy('scary_ghoul', { actions: [scaryParley] }),
          engagedWith(bob),
        ),
      cardId: ghoul,
    },
    {
      name: 'a treachery in bob`s threat area',
      setup: () =>
        aliceInHallBobInCellar.withCard(
          instanceId('curse'),
          blankTreachery('scary_curse', { actions: [scareAction] }),
          threatAreaOf(bob),
        ),
      cardId: instanceId('curse'),
    },
    {
      name: 'a treachery in the threat area of alice, at his location',
      setup: () =>
        newGame()
          .withLocation(hall, blankLocation('hall'))
          .withInvestigator(alice, { locationId: hall })
          .withInvestigator(bob, { locationId: hall })
          .withCard(
            instanceId('curse'),
            blankTreachery('scary_curse', { actions: [scareAction] }),
            threatAreaOf(alice),
          ),
      cardId: instanceId('curse'),
    },
  ])('lets bob take the action of $name', ({ setup, cardId }) => {
    const { context, state } = setup().withTurnOf(bob).start();

    const after = stateAfter(context, state, useAsAction(bob, cardId));

    expect(investigatorOf(after, bob).sanity.horror).toBe(1);
  });

  it.each([
    {
      name: 'a location bob is not at',
      setup: () =>
        newGame()
          .withLocation(hall, blankLocation('hall', { actions: [scareAction] }), { revealed: true })
          .withLocation(cellar, blankLocation('cellar'))
          .withInvestigator(bob, { locationId: cellar }),
      cardId: hall,
    },
    {
      name: 'the unrevealed location he is at',
      setup: () =>
        newGame()
          .withLocation(hall, blankLocation('hall', { actions: [scareAction] }))
          .withInvestigator(bob, { locationId: hall }),
      cardId: hall,
    },
    {
      name: 'an enemy at another location',
      setup: () =>
        aliceInHallBobInCellar.withCard(
          ghoul,
          blankEnemy('scary_ghoul', { actions: [scareAction] }),
          atLocation(hall),
        ),
      cardId: ghoul,
    },
    {
      name: 'a treachery in the threat area of alice, at another location',
      setup: () =>
        aliceInHallBobInCellar.withCard(
          instanceId('curse'),
          blankTreachery('scary_curse', { actions: [scareAction] }),
          threatAreaOf(alice),
        ),
      cardId: instanceId('curse'),
    },
  ])('rejects bob taking the action of $name', ({ setup, cardId }) => {
    const { context, state } = setup().withTurnOf(bob).start();

    expect(rejectionFrom(context, state, useAsAction(bob, cardId))).toEqual({
      code: 'cardActionUnavailable',
      cardId,
      investigatorId: bob,
    });
  });

  it('rejects an action outside the investigator`s turn', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall', { actions: [scareAction] }), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withTurnOf(bob)
      .start();

    expect(rejectionFrom(context, state, useAsAction(alice, hall))).toMatchObject({
      code: 'turnNotInProgress',
      investigatorId: alice,
    });
  });

  it('rejects an action the card does not print', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall', { actions: [scareAction] }), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    expect(rejectionFrom(context, state, useAsAction(alice, hall, 1))).toEqual({
      code: 'unknownCardAction',
      cardId: hall,
      action: 1,
    });
  });

  describe('with alice engaged with a ready ghoul', () => {
    const scaryHallCard = blankLocation('hall', {
      actions: [scareAction, resignAction()],
    });
    const ghoulOnAlice = newGame()
      .withLocation(hall, scaryHallCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul', { damage: 1 }), engagedWith(alice))
      .withTurnOf(alice);

    it('provokes an attack of opportunity for a plain action', () => {
      const { context, state } = ghoulOnAlice.start();

      const after = stateAfter(context, state, useAsAction(alice, hall, 0));

      expect(after.pending).toMatchObject([{ id: `attackOfOpportunity:${ghoul}` }]);
      expect(investigatorOf(after, alice).sanity.horror).toBe(0);
    });

    it('resolves the action once the attack of opportunity is answered', () => {
      const { context, state } = ghoulOnAlice.start();

      const after = stateAfter(
        context,
        state,
        useAsAction(alice, hall, 0),
        answer(`attackOfOpportunity:${ghoul}`, 'attack'),
      );

      expect(after.pending).toEqual([]);
      expect(investigatorOf(after, alice)).toMatchObject({
        health: { damage: 1 },
        sanity: { horror: 1 },
      });
    });

    it('provokes none for Resign', () => {
      const { context, state } = ghoulOnAlice.start();

      const after = stateAfter(context, state, useAsAction(alice, hall, 1));

      expect(after.pending).toEqual([]);
      expect(investigatorOf(after, alice).status).toBe('resigned');
    });
  });
});

describe('action limits', () => {
  /** Alice and bob in the hall, whose one action scares its taker, limited by `limit`; round 1's investigation phase. */
  const bothInHallWith = (limit: ActionLimit) => {
    const table = PlayTable.start(
      newGame()
        .withLocation(hall, blankLocation('hall', { actions: [{ ...scareAction, limit }] }), {
          revealed: true,
        })
        .withInvestigator(alice, { locationId: hall })
        .withInvestigator(bob, { locationId: hall }),
    );
    table.nextPhase();
    return table;
  };
  /** Ends round 1 after alice's turn and bob's, and starts alice's turn in round 2. */
  const toAlicesTurnInRound2 = (table: PlayTable) => {
    table.endTurn(alice);
    table.startTurn(bob);
    table.endTurn(bob);
    table.nextPhase();
    table.nextPhase();
    table.nextPhase();
    table.nextPhase();
    expect(table.board).toMatchObject({ round: 2, phase: 'investigation' });
    table.startTurn(alice);
  };
  const limitReached = expect.objectContaining({
    rejection: expect.objectContaining({ code: 'cardActionLimitReached' }),
  });

  it.each([{ per: 'turn' } as const, { per: 'game' } as const])(
    'rejects a second use in the same turn with a limit once per $per',
    (limit) => {
      const table = bothInHallWith(limit);
      table.startTurn(alice);
      table.useCardAction(alice, hall);

      expect(() => table.useCardAction(alice, hall)).toThrow(limitReached);
      expect(table.board.investigator(alice).horror).toBe(1);
    },
  );

  it('lets alice take an action limited once per turn again in her next turn', () => {
    const table = bothInHallWith({ per: 'turn' });
    table.startTurn(alice);
    table.useCardAction(alice, hall);
    toAlicesTurnInRound2(table);

    table.useCardAction(alice, hall);

    expect(table.board.investigator(alice).horror).toBe(2);
  });

  it('rejects an action limited once per game in alice`s next turn', () => {
    const table = bothInHallWith({ per: 'game' });
    table.startTurn(alice);
    table.useCardAction(alice, hall);
    toAlicesTurnInRound2(table);

    expect(() => table.useCardAction(alice, hall)).toThrow(limitReached);
    expect(table.board.cardActions(alice)).toEqual([]);
  });

  it.each([
    { limit: { per: 'game' } as const, bobsActions: 1 },
    { limit: { per: 'game', group: true } as const, bobsActions: 0 },
  ])(
    'counts alice`s use against bob only for a group limit: bob is offered $bobsActions',
    ({ limit, bobsActions }) => {
      const table = bothInHallWith(limit);
      table.startTurn(alice);
      table.useCardAction(alice, hall);
      table.endTurn(alice);
      table.startTurn(bob);

      expect(table.board.cardActions(bob)).toHaveLength(bobsActions);
    },
  );
});

describe('action costs', () => {
  /** Alice in the hall on her turn, with `resources` resources and 1 clue; the hall's action scares its taker for 2 resources. */
  const aliceInHallWith = (resources: number) =>
    newGame()
      .withLocation(
        hall,
        blankLocation('hall', {
          actions: [{ ...scareAction, cost: { spend: 'resources', amount: 2 } }],
        }),
        { revealed: true },
      )
      .withInvestigator(alice, { locationId: hall, resources, clues: 1 })
      .withTurnOf(alice);

  it('makes alice with 5 resources pay 2 before the action scares her', () => {
    const { context, state } = aliceInHallWith(5).start();

    const after = stateAfter(context, state, useAsAction(alice, hall));

    expect(investigatorOf(after, alice)).toMatchObject({ resources: 3, sanity: { horror: 1 } });
  });

  it('neither offers nor accepts the action from alice with 1 resource', () => {
    const table = PlayTable.start(aliceInHallWith(1));

    expect(table.board.cardActions(alice)).toEqual([]);
    expect(rejectionFrom(table.ctx, table.state, useAsAction(alice, hall))).toEqual({
      code: 'cardActionCostUnpaid',
      cardId: hall,
      action: 0,
      investigatorId: alice,
    });
  });
});

describe('hand card costs', () => {
  it('leaves alice’s discard of 4 cards to the players and still scares her', () => {
    const { context, state } = newGame()
      .withLocation(
        hall,
        blankLocation('hall', {
          actions: [{ ...scareAction, cost: { spend: 'handCards', amount: 4 } }],
        }),
        { revealed: true },
      )
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const { state: after, events } = execute(context, state, useAsAction(alice, hall));

    expect(events).toContainEqual({
      type: 'CommandDeferred',
      command: { type: 'DiscardFromHand', investigatorId: alice, amount: 4 },
    });
    expect(investigatorOf(after, alice)).toMatchObject({ sanity: { horror: 1 } });
  });
});

describe('group clue costs', () => {
  /**
   * Alice in the hall on her turn with `aliceClues`, bob in the cellar with `bobClues`; the hall's
   * action scares its taker for 2 clues per investigator, paid as a group: 4 clues for the two.
   */
  const groupWith = (aliceClues: number, bobClues: number) =>
    newGame()
      .withLocation(
        hall,
        blankLocation('hall', {
          actions: [{ ...scareAction, cost: { spend: 'groupClues', amount: perInvestigator(2) } }],
        }),
        { revealed: true },
      )
      .withLocation(cellar, blankLocation('cellar'))
      .withInvestigator(alice, { locationId: hall, clues: aliceClues })
      .withInvestigator(bob, { locationId: cellar, clues: bobClues })
      .withTurnOf(alice);

  it('takes the 4 clues from alice and bob as they name them, bob paying from the cellar', () => {
    const { context, state } = groupWith(3, 3).start();

    const after = stateAfter(context, state, {
      ...useAsAction(alice, hall),
      spend: [
        { investigatorId: alice, amount: 1 },
        { investigatorId: bob, amount: 3 },
      ],
    });

    expect(investigatorOf(after, alice)).toMatchObject({ clues: 2, sanity: { horror: 1 } });
    expect(investigatorOf(after, bob)).toMatchObject({ clues: 0 });
  });

  it('takes all of alice’s 1 clue and 3 of bob’s 5 when nobody names the payers', () => {
    const { context, state } = groupWith(1, 5).start();

    const after = stateAfter(context, state, useAsAction(alice, hall));

    expect(investigatorOf(after, alice)).toMatchObject({ clues: 0 });
    expect(investigatorOf(after, bob)).toMatchObject({ clues: 2 });
  });

  it('takes 3 of bob’s 3 first and alice’s 1 when bob, in the second seat, takes it', () => {
    const { context, state } = newGame()
      .withLocation(
        hall,
        blankLocation('hall', {
          actions: [{ ...scareAction, cost: { spend: 'groupClues', amount: perInvestigator(2) } }],
        }),
        { revealed: true },
      )
      .withInvestigator(alice, { locationId: hall, clues: 3 })
      .withInvestigator(bob, { locationId: hall, clues: 3 })
      .withTurnOf(bob)
      .start();

    const after = stateAfter(context, state, useAsAction(bob, hall));

    expect(investigatorOf(after, bob)).toMatchObject({ clues: 0, sanity: { horror: 1 } });
    expect(investigatorOf(after, alice)).toMatchObject({ clues: 2 });
  });

  it('neither offers nor accepts the action while the group holds only 3 clues', () => {
    const table = PlayTable.start(groupWith(1, 2));

    expect(table.board.cardActions(alice)).toEqual([]);
    expect(rejectionFrom(table.ctx, table.state, useAsAction(alice, hall))).toMatchObject({
      code: 'cardActionCostUnpaid',
    });
  });

  it('rejects payers whose clues add up to 3 of the 4', () => {
    const { context, state } = groupWith(3, 3).start();

    expect(
      rejectionFrom(context, state, {
        ...useAsAction(alice, hall),
        spend: [{ investigatorId: bob, amount: 3 }],
      }),
    ).toEqual({ code: 'wrongClueTotal', required: 4, spent: 3 });
  });

  it('rejects named payers for an action whose cost alice pays alone', () => {
    const { context, state } = newGame()
      .withLocation(
        hall,
        blankLocation('hall', {
          actions: [{ ...scareAction, cost: { spend: 'clues', amount: 1 } }],
        }),
        { revealed: true },
      )
      .withInvestigator(alice, { locationId: hall, clues: 1 })
      .withTurnOf(alice)
      .start();

    expect(
      rejectionFrom(context, state, {
        ...useAsAction(alice, hall),
        spend: [{ investigatorId: alice, amount: 1 }],
      }),
    ).toEqual({ code: 'noGroupCost' });
  });
});
