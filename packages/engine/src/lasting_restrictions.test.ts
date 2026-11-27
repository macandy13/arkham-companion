import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  boardView,
  instanceId,
  investigatorId,
  newGame,
  type Command,
  type InvestigatorRestriction,
} from './index';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');

/** Alice alone in the hall. */
const aliceInHall = newGame()
  .withLocation(hall, blankLocation('hall'), { revealed: true })
  .withInvestigator(alice, { locationId: hall });

const noSkillsThisRound: InvestigatorRestriction = {
  cannot: ['play', 'commit'],
  what: 'cards',
  cards: { types: ['skill'] },
};
const noCardsThisRound: InvestigatorRestriction = { cannot: ['play', 'commit'], what: 'cards' };

const restrictAlice = (restriction: InvestigatorRestriction): Command => ({
  type: 'RestrictInvestigator',
  investigatorId: alice,
  restriction,
  until: 'round',
});

describe('RestrictInvestigator', () => {
  it.each([
    {
      name: 'one card type, which the players keep to',
      restriction: noSkillsThisRound,
      forbidden: undefined,
    },
    {
      name: 'every card, which the screen also forbids',
      restriction: noCardsThisRound,
      forbidden: { cards: ['play', 'commit'] },
    },
  ])('shows alice what she cannot do this round: $name', ({ restriction, forbidden }) => {
    const { context, state } = aliceInHall.start();

    const after = stateAfter(context, state, restrictAlice(restriction));

    const { thisRound, forbidden: forbiddenNow } = boardView(context, after).investigator(alice);
    expect(thisRound).toEqual([restriction]);
    expect(forbiddenNow).toEqual(forbidden);
  });

  it('lifts the restriction as the round ends', () => {
    const { context, state } = aliceInHall.start();
    const next: Command = { type: 'NextPhase' };
    const restricted = stateAfter(context, state, next, restrictAlice(noSkillsThisRound));

    const nextRound = stateAfter(
      context,
      restricted,
      { type: 'StartTurn', investigatorId: alice },
      { type: 'EndTurn', investigatorId: alice },
      next,
      next,
      next,
    );

    expect(restricted.meta.lastingRestrictions).toHaveLength(1);
    expect(nextRound.meta).toMatchObject({ round: 2, phase: 'mythos' });
    expect(boardView(context, nextRound).investigator(alice).thisRound).toBeUndefined();
  });
});
