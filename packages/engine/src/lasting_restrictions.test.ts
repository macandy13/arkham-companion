import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  boardView,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
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
    const table = PlayTable.start(aliceInHall);
    table.nextPhase();
    table.play(restrictAlice(noSkillsThisRound));
    const restricted = table.board.investigator(alice).thisRound;

    table.startTurn(alice);
    table.endTurn(alice);
    table.nextPhase();
    table.nextPhase();
    table.nextPhase();

    expect(restricted).toEqual([noSkillsThisRound]);
    expect(table.board).toMatchObject({ round: 2, phase: 'mythos' });
    expect(table.board.investigator(alice).thisRound).toBeUndefined();
  });

  it('restricts nothing for alice once she has resigned, while bob plays on', () => {
    const { context, state } = aliceInHall
      .withInvestigator(investigatorId('bob'), { locationId: hall })
      .start();

    const after = stateAfter(
      context,
      state,
      { type: 'Resign', investigatorId: alice, immediately: true },
      restrictAlice(noSkillsThisRound),
    );

    expect(after.meta.lastingRestrictions).toBeUndefined();
  });
});
