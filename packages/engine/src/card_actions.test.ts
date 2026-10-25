import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  resignAction,
  takeHorror,
  threatAreaOf,
  type CardAction,
  type Command,
  type InstanceId,
  type InvestigatorId,
} from './index';
import { investigatorOf, rejectionFrom, stateAfter } from '../test/utils';

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

function useAction(investigator: InvestigatorId, cardId: InstanceId, action = 0): Command {
  return { type: 'UseCardAction', investigatorId: investigator, cardId, action, asAction: true };
}

describe('UseCardAction', () => {
  it('resolves the effects of the action for the investigator who takes it', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall', { actions: [scareAction] }))
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, useAction(alice, hall));

    expect(investigatorOf(after, alice).sanity.horror).toBe(1);
  });

  it('resigns the investigator who takes a Resign action', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('parlor', { actions: [resignAction()] }))
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, useAction(alice, hall));

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
  ])('lets bob take the action of $name', ({ setup, cardId }) => {
    const { context, state } = setup().withTurnOf(bob).start();

    const after = stateAfter(context, state, useAction(bob, cardId));

    expect(investigatorOf(after, bob).sanity.horror).toBe(1);
  });

  it.each([
    {
      name: 'a location bob is not at',
      setup: () =>
        newGame()
          .withLocation(hall, blankLocation('hall', { actions: [scareAction] }))
          .withLocation(cellar, blankLocation('cellar'))
          .withInvestigator(bob, { locationId: cellar }),
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
      name: 'a treachery in alice`s threat area',
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

    expect(rejectionFrom(context, state, useAction(bob, cardId))).toEqual({
      code: 'cardActionUnavailable',
      cardId,
      investigatorId: bob,
    });
  });

  it('rejects an action outside the investigator`s turn', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall', { actions: [scareAction] }))
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withTurnOf(bob)
      .start();

    expect(rejectionFrom(context, state, useAction(alice, hall))).toMatchObject({
      code: 'turnNotInProgress',
      investigatorId: alice,
    });
  });

  it('rejects an action the card does not print', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall', { actions: [scareAction] }))
      .withInvestigator(alice, { locationId: hall })
      .withTurnOf(alice)
      .start();

    expect(rejectionFrom(context, state, useAction(alice, hall, 1))).toEqual({
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
      .withLocation(hall, scaryHallCard)
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul', { damage: 1 }), engagedWith(alice))
      .withTurnOf(alice);

    it('provokes an attack of opportunity for a plain action', () => {
      const { context, state } = ghoulOnAlice.start();

      const after = stateAfter(context, state, useAction(alice, hall, 0));

      expect(after.pending).toMatchObject([{ id: `attackOfOpportunity:${ghoul}` }]);
      expect(investigatorOf(after, alice).sanity.horror).toBe(0);
    });

    it('provokes none for Resign', () => {
      const { context, state } = ghoulOnAlice.start();

      const after = stateAfter(context, state, useAction(alice, hall, 1));

      expect(after.pending).toEqual([]);
      expect(investigatorOf(after, alice).status).toBe('resigned');
    });
  });
});
