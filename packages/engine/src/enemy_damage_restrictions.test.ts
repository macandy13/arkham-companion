import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardCode,
  fixed,
  instanceId,
  investigatorId,
  newGame,
} from './index';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const ghoul = instanceId('ghoul');

/** An agenda like A Gathering: "Each enemy at a location with a copy of Fire! attached cannot be damaged." */
const burningAgenda = blankAgenda('burning_agenda', fixed(6), {
  restrictions: [
    { cannot: 'damaged', of: 'eachEnemy', atLocationWith: { code: cardCode('fire') } },
  ],
});

describe('an enemy that cannot be damaged at a location with Fire! attached', () => {
  /** The burning agenda current, a Fire! attached to the hall, and a 3-health ghoul `at` the hall or the cellar. */
  const ghoulIn = (at: typeof hall) =>
    newGame()
      .withAgenda(instanceId('agenda'), burningAgenda)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withCard(instanceId('fire'), blankTreachery('fire'), { kind: 'attachedTo', hostId: hall })
      .withInvestigator(alice, { locationId: cellar })
      .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), atLocation(at))
      .start();

  it.each([
    { at: hall, where: 'the burning hall', damage: 0 },
    { at: cellar, where: 'the cellar, with no Fire!', damage: 1 },
  ])('deals the ghoul in $where $damage damage', ({ at, damage }) => {
    const { context, state } = ghoulIn(at);

    const after = stateAfter(context, state, { type: 'DamageEnemy', enemyId: ghoul, amount: 1 });

    expect(after.cards[ghoul]?.tokens.damage ?? 0).toBe(damage);
  });

  it('damages the ghoul in the hall again once the agenda has left play', () => {
    const { context, state } = ghoulIn(hall);

    const after = stateAfter(
      context,
      state,
      { type: 'MoveCard', cardId: instanceId('agenda'), to: { kind: 'outOfGame' } },
      { type: 'DamageEnemy', enemyId: ghoul, amount: 1 },
    );

    expect(after.cards[ghoul]?.tokens.damage).toBe(1);
  });
});
