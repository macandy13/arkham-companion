import { describe, expect, it } from 'vitest';
import {
  advanceBySpendingClues,
  attachedTo,
  blankAct,
  blankEnemy,
  blankLocation,
  blankTreachery,
  engagedWith,
  perInvestigator,
  takeHorror,
  threatAreaOf,
  trait,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  setAside,
  type Zone,
} from './index';
import { answer, investigatorOf, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const parlor = instanceId('parlor');
const lockedDoor = instanceId('locked_door');

/** A location whose unrevealed side prints "You cannot move into the parlor". */
const parlorCard = blankLocation('parlor', {
  restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }],
});
/** A treachery whose attached location cannot be investigated. */
const lockedDoorCard = blankTreachery('locked_door', {
  restrictions: [{ cannot: 'investigate', of: 'host' }],
});

/** Alice in the revealed hall, connected to the parlor, revealed or not. */
const aliceNextToParlor = (revealed: boolean) =>
  newGame()
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withLocation(parlor, parlorCard, { revealed })
    .withConnection(hall, parlor)
    .withInvestigator(alice, { locationId: hall });

describe('a location nobody may move into while it is unrevealed (the Parlor)', () => {
  it.each([
    { move: 'the move action', command: { asAction: true } as const },
    { move: 'a card effect that ignores connections', command: { ignoreConnections: true } },
  ])('rejects $move into it while unrevealed', ({ command }) => {
    const { context, state } = aliceNextToParlor(false).start();

    expect(
      rejectionFrom(context, state, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: parlor,
        ...command,
      }),
    ).toEqual({ code: 'restricted', cannot: 'moveInto', locationId: parlor });
  });

  it('lets alice in once it is revealed', () => {
    const { context, state } = aliceNextToParlor(true).start();

    const moved = stateAfter(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: parlor,
    });

    expect(moved.investigators[0]?.locationId).toBe(parlor);
  });

  it.each([
    { side: 'unrevealed', revealed: false, forbidden: ['moveInto'] },
    { side: 'revealed', revealed: true, forbidden: undefined },
  ])('shows the move forbidden on its $side side', ({ revealed, forbidden }) => {
    const table = PlayTable.start(aliceNextToParlor(revealed));

    expect(table.board.location(parlor).forbidden).toEqual(forbidden);
  });
});

describe('a treachery whose attached location cannot be investigated (Locked Door)', () => {
  /** Alice in the revealed hall, with the locked door attached to it or set aside. */
  const aliceInHallWithLockedDoor = (zone: Zone) =>
    newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(lockedDoor, lockedDoorCard, zone);

  it('rejects investigating the hall while the door is attached to it', () => {
    const { context, state } = aliceInHallWithLockedDoor(attachedTo(hall)).start();

    expect(rejectionFrom(context, state, { type: 'Investigate', investigatorId: alice })).toEqual({
      code: 'restricted',
      cannot: 'investigate',
      locationId: hall,
    });
    expect(
      PlayTable.start(aliceInHallWithLockedDoor(attachedTo(hall))).board.location(hall),
    ).toMatchObject({ forbidden: ['investigate'] });
  });

  it('lets alice investigate the hall while the door is set aside', () => {
    const { context, state } = aliceInHallWithLockedDoor(setAside).start();

    const investigating = stateAfter(context, state, {
      type: 'Investigate',
      investigatorId: alice,
    });

    expect(investigating.pending).toMatchObject([{ kind: 'skillTestResult' }]);
    expect(
      PlayTable.start(aliceInHallWithLockedDoor(setAside)).board.location(hall).forbidden,
    ).toBeUndefined();
  });
});

describe('an enemy whose engaged investigator cannot discover or spend clues (The Masked Hunter)', () => {
  const bob = investigatorId('bob');
  const hunter = instanceId('hunter');
  const act = instanceId('act');
  const cultist = instanceId('cultist');
  /** An enemy that forbids the investigator engaged with it to discover or spend clues. */
  const hunterCard = blankEnemy('hunter', {
    restrictions: [
      { cannot: 'discoverClues', who: 'threatArea' },
      { cannot: 'spendClues', who: 'threatArea' },
    ],
  });
  /**
   * Alice (2 clues) and bob (2 clues) in the hall with 3 clues, on alice's turn; the hunter is
   * `hunterZone`; the act advances for 1 clue per investigator, spent as a group.
   */
  const hallWithHunter = (hunterZone: Zone) =>
    newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true, clues: 3 })
      .withInvestigator(alice, { locationId: hall, clues: 2 })
      .withInvestigator(bob, { locationId: hall, clues: 2 })
      .withCard(hunter, hunterCard, hunterZone)
      .withAct(act, blankAct('act', { actions: [advanceBySpendingClues(perInvestigator(1))] }))
      .withTurnOf(alice);

  it('rejects alice discovering a clue while the hunter is engaged with her', () => {
    const { context, state } = hallWithHunter(engagedWith(alice)).start();

    expect(
      rejectionFrom(context, state, {
        type: 'DiscoverClues',
        investigatorId: alice,
        locationId: hall,
        amount: 1,
      }),
    ).toEqual({ code: 'restrictedFor', cannot: 'discoverClues', investigatorId: alice });
  });

  it.each([
    { hunter: 'engaged with alice', zone: engagedWith(alice), clues: 2 },
    { hunter: 'engaged with bob', zone: engagedWith(bob), clues: 3 },
  ])(
    'lets alice’s passed investigation end with $clues clues while the hunter is $hunter',
    ({ zone, clues }) => {
      const { context, state } = hallWithHunter(zone).start();

      const passed = stateAfter(
        context,
        state,
        { type: 'Investigate', investigatorId: alice },
        answer(`investigate:${alice}`, 'pass'),
      );

      expect(investigatorOf(passed, alice).clues).toBe(clues);
    },
  );

  it('counts only bob’s 2 clues toward the act while the hunter is engaged with alice', () => {
    const table = PlayTable.start(hallWithHunter(engagedWith(alice)));

    expect(table.board.act?.advance).toMatchObject({ kind: 'spendClues', held: 2 });
    expect(table.board.investigator(alice).forbidden).toEqual(['discoverClues', 'spendClues']);
    expect(table.board.investigator(bob).forbidden).toBeUndefined();
  });

  it('rejects alice paying for the act while the hunter is engaged with her', () => {
    const { context, state } = hallWithHunter(engagedWith(alice)).start();

    expect(
      rejectionFrom(context, state, {
        type: 'UseCardAction',
        investigatorId: alice,
        cardId: act,
        action: 0,
        spend: [
          { investigatorId: alice, amount: 1 },
          { investigatorId: bob, amount: 1 },
        ],
      }),
    ).toEqual({ code: 'restrictedFor', cannot: 'spendClues', investigatorId: alice });
  });
  it('lets bob pay both clues of a group cost when nobody names the payers', () => {
    const cultistCard = blankEnemy('cultist', {
      // Free, so the hunter's attack of opportunity doesn't come first.
      actions: [
        {
          free: true,
          effects: [takeHorror(1)],
          cost: { spend: 'groupClues', amount: perInvestigator(1) },
        },
      ],
    });
    const { context, state } = hallWithHunter(engagedWith(alice))
      .withCard(cultist, cultistCard, engagedWith(bob))
      .start();

    const paid = stateAfter(context, state, {
      type: 'UseCardAction',
      investigatorId: alice,
      cardId: cultist,
      action: 0,
    });

    expect(investigatorOf(paid, alice).clues).toBe(2);
    expect(investigatorOf(paid, bob).clues).toBe(0);
  });

  it('neither offers nor accepts alice an action that costs her own clue', () => {
    const cultistCard = blankEnemy('cultist', {
      actions: [{ effects: [takeHorror(1)], cost: { spend: 'clues', amount: 1 } }],
    });
    const table = PlayTable.start(
      hallWithHunter(engagedWith(alice)).withCard(cultist, cultistCard, engagedWith(bob)),
    );

    expect(table.board.cardActions(alice)).toEqual([]);
    expect(
      rejectionFrom(table.ctx, table.state, {
        type: 'UseCardAction',
        investigatorId: alice,
        cardId: cultist,
        action: 0,
      }),
    ).toEqual({ code: 'cardActionCostUnpaid', cardId: cultist, action: 0, investigatorId: alice });
  });
});

describe('a treachery whose investigator cannot play assets or events (Dissonant Voices)', () => {
  const bob = investigatorId('bob');
  /** A treachery that forbids the investigator whose threat area holds it to play assets or events. */
  const voicesCard = blankTreachery('voices', {
    restrictions: [
      { cannot: 'playCards', who: 'threatArea', cards: { types: ['asset', 'event'] } },
    ],
  });
  /** Alice and bob in the hall, the voices in alice's threat area. */
  const voicesOnAlice = newGame()
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: hall })
    .withCard(instanceId('voices'), voicesCard, threatAreaOf(alice));

  it('rejects alice playing a card, and leaves bob’s play to the players', () => {
    const { context, state } = voicesOnAlice.start();

    expect(rejectionFrom(context, state, { type: 'PlayCard', investigatorId: alice })).toEqual({
      code: 'restrictedFor',
      cannot: 'playCards',
      investigatorId: alice,
    });
    expect(
      stateAfter(context, state, { type: 'PlayCard', investigatorId: bob }).investigators,
    ).toEqual(state.investigators);
  });

  it('shows the play forbidden on alice only', () => {
    const table = PlayTable.start(voicesOnAlice);

    expect(table.board.perInvestigator('forbidden')).toEqual({
      alice: ['playCards'],
      bob: undefined,
    });
  });

  it.each([
    { cards: 'assets only', filter: { types: ['asset'] } as const },
    { cards: 'Firearm cards', filter: { traits: [trait('Firearm')] } },
  ])('leaves alice’s play to the players when a card forbids her $cards', ({ filter }) => {
    const narrower = blankTreachery('voices', {
      restrictions: [{ cannot: 'playCards', who: 'threatArea', cards: filter }],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(instanceId('voices'), narrower, threatAreaOf(alice))
      .start();

    expect(
      stateAfter(context, state, { type: 'PlayCard', investigatorId: alice }).investigators,
    ).toEqual(state.investigators);
  });
});
