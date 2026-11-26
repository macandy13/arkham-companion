import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankAgenda,
  blankEnemy,
  blankLocation,
  encounterDiscard,
  fixed,
  instanceId,
  investigatorId,
  newGame,
} from './index';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const bystander = instanceId('bystander');
const pastCurfew = instanceId('past_curfew');

/** A doomed bystander with 1 health, like the Core Set (2026) Bystander. */
const doomedBystander = blankEnemy('bystander', {
  health: fixed(1),
  keywords: [{ name: 'doomed' }],
});

describe('Doomed', () => {
  /** Alice in the hall with the bystander; the current agenda, Past Curfew, advances at `threshold` doom. */
  const bystanderInTheHall = (threshold: number) =>
    newGame()
      .withAgenda(pastCurfew, blankAgenda('past_curfew', fixed(threshold)))
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(bystander, doomedBystander, atLocation(hall))
      .start();

  it('places 1 doom on Past Curfew, threshold 3, when 1 damage defeats the bystander', () => {
    const { context, state } = bystanderInTheHall(3);

    const after = stateAfter(context, state, {
      type: 'DamageEnemy',
      enemyId: bystander,
      amount: 1,
    });

    expect(after.cards[bystander]?.zone).toEqual(encounterDiscard);
    expect(after.cards[pastCurfew]?.tokens.doom).toBe(1);
    expect(after.agenda.current).toBe(pastCurfew);
  });

  it('asks to advance Past Curfew, threshold 1, when that doom reaches it', () => {
    const { context, state } = bystanderInTheHall(1);

    const after = stateAfter(context, state, { type: 'DefeatEnemy', enemyId: bystander });

    expect(after.pending.map(({ id }) => id)).toEqual(['advanceAgenda:past_curfew']);
  });

  it('places no doom when the bystander is discarded, which is no defeat', () => {
    const { context, state } = bystanderInTheHall(3);

    const after = stateAfter(context, state, {
      type: 'MoveCard',
      cardId: bystander,
      to: encounterDiscard,
    });

    expect(after.cards[pastCurfew]?.tokens.doom).toBeUndefined();
  });
});
