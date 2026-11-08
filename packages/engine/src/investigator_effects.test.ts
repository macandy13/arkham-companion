import { describe, expect, it } from 'vitest';
import {
  afterEntering,
  blankEnemy,
  blankLocation,
  discoverClues,
  endYourTurn,
  engagedWith,
  instanceId,
  investigatorId,
  loseActions,
  newGame,
  onlyCopy,
  cardCode,
  type AbilityEffect,
  type Command,
} from './index';
import { requireInvestigator } from './investigators';
import { rejectionFrom, stateAfter } from '../test/utils';

const hall = instanceId('hall');
const attic = instanceId('attic');
const alice = investigatorId('alice');
const bob = investigatorId('bob');

/** Alice is moved from the hall into the attic by an effect, which costs her no action. */
const aliceEntersAttic: Command = {
  type: 'MoveInvestigator',
  investigatorId: alice,
  to: attic,
  ignoreConnections: true,
};

/** The hall, and an attic whose "after you enter" ability is `effect`. */
const hallAndAttic = (effect: AbilityEffect) =>
  newGame()
    .withLocation(hall, blankLocation('hall'), { revealed: true })
    .withLocation(attic, blankLocation('attic', { abilities: [afterEntering(effect)] }), {
      revealed: true,
    });

describe('card effects that take actions away', () => {
  it.each([
    { loses: 1, before: 3, after: 2 },
    { loses: 2, before: 1, after: 0 },
    { loses: 1, before: 0, after: 0 },
    { loses: 'all', before: 2, after: 0 },
    { loses: 'all', before: 0, after: 0 },
  ] as const)(
    'leaves alice $after of $before actions when the attic makes her lose $loses',
    ({ loses, before, after }) => {
      const { context, state } = hallAndAttic(loseActions(loses))
        .withInvestigator(alice, { locationId: hall })
        .withTurnOf(alice)
        .start();
      const spent =
        before === 3
          ? state
          : stateAfter(context, state, {
              type: 'AdjustActions',
              investigatorId: alice,
              delta: before - 3,
            });

      const moved = stateAfter(context, spent, aliceEntersAttic);

      expect(requireInvestigator(moved, alice).actionsRemaining).toBe(after);
    },
  );

  it('lets the players take all remaining actions too, but not from an investigator with none', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();
    const loseAll: Command = {
      type: 'AdjustActions',
      investigatorId: alice,
      delta: 'allRemaining',
    };

    const after = stateAfter(context, state, loseAll);

    expect(requireInvestigator(after, alice).actionsRemaining).toBe(0);
    expect(rejectionFrom(context, after, loseAll)).toEqual({
      code: 'invalidActionAdjustment',
      investigatorId: alice,
      delta: 0,
      actionsRemaining: 0,
    });
  });
});

describe('a card effect that ends your turn', () => {
  it('ends the turn of the investigator who entered', () => {
    const { context, state } = hallAndAttic(endYourTurn())
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(after.meta.turn).toBeUndefined();
    expect(after.meta.turnsTaken).toEqual([alice]);
  });

  it("does nothing when she enters during bob's turn", () => {
    const { context, state } = hallAndAttic(endYourTurn())
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withTurnOf(bob)
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(after.meta.turn?.investigatorId).toBe(bob);
    expect(after.meta.turnsTaken).toEqual([]);
  });
});

describe('card effects that discover clues', () => {
  it.each([
    { atticClues: 3, discovered: 2 },
    { atticClues: 1, discovered: 1 },
    { atticClues: 0, discovered: 0 },
  ])(
    'discovers $discovered clues in an attic with $atticClues when told to discover 2',
    ({ atticClues, discovered }) => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withLocation(
          attic,
          blankLocation('attic', { abilities: [afterEntering(discoverClues(2))] }),
          {
            revealed: true,
            clues: atticClues,
          },
        )
        .withInvestigator(alice, { locationId: hall })
        .start();

      const after = stateAfter(context, state, aliceEntersAttic);

      expect(requireInvestigator(after, alice).clues).toBe(discovered);
      expect(after.cards[attic]?.tokens.clue ?? 0).toBe(atticClues - discovered);
    },
  );

  it('discovers a clue at another location the card names', () => {
    const study = instanceId('study');
    const { context, state } = hallAndAttic(discoverClues(1, onlyCopy(cardCode('study'))))
      .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
      .withInvestigator(alice, { locationId: hall })
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(requireInvestigator(after, alice).clues).toBe(1);
    expect(after.cards[study]?.tokens.clue).toBe(1);
  });

  it('discovers nothing for an investigator an engaged enemy forbids to discover clues', () => {
    const hunter = instanceId('hunter');
    /** "You cannot discover clues" while engaged with it (The Masked Hunter). */
    const hunterCard = blankEnemy('hunter', {
      restrictions: [{ cannot: ['discover'], what: 'clues', who: 'threatArea' }],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(
        attic,
        blankLocation('attic', { abilities: [afterEntering(discoverClues(1))] }),
        {
          revealed: true,
          clues: 2,
        },
      )
      .withInvestigator(alice, { locationId: hall })
      .withCard(hunter, hunterCard, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(requireInvestigator(after, alice).clues).toBe(0);
    expect(after.cards[attic]?.tokens.clue).toBe(2);
  });
});
