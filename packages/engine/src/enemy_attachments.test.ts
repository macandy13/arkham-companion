import { describe, expect, it } from 'vitest';
import {
  atLocation,
  attachedTo,
  blankEnemy,
  blankEvent,
  blankLocation,
  blankPlayerAsset,
  boardView,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  trait,
  zoneKey,
  zoneOf,
  type Command,
  type GameState,
  type InstanceId,
} from './index';
import { rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const location = blankLocation('location');
const plainGhoul = blankEnemy('plain_ghoul');
const eliteGhoul = blankEnemy('elite_ghoul', { traits: [trait('Elite')] });

/** Handcuffs: "If the attached enemy is non-Elite, it cannot ready and doom cannot be placed on it." */
const handcuffs = blankPlayerAsset('handcuffs', {
  restrictions: [
    { cannot: 'ready', of: 'host', exceptTraits: [trait('Elite')] },
    { cannot: 'placeDoom', of: 'host', exceptTraits: [trait('Elite')] },
  ],
});
const handcuffsOnGhoul: Command = { type: 'AttachPlayerCard', hostId: ghoul, code: handcuffs.code };
/** The ghoul engages Alice as the game starts; evading it leaves it exhausted, unengaged at the hall. */
const aliceEvadesGhoul: Command = { type: 'EvadeEnemy', enemyId: ghoul, investigatorId: alice };

/** Hiding Spot: "Each non-Elite enemy at attached location gains aloof." */
const hidingSpot = blankEvent('hiding_spot', {
  keywordGrants: [{ gains: 'aloof', of: 'enemiesAtHost', exceptTraits: [trait('Elite')] }],
});
const hidingSpotInHall: Command = {
  type: 'AttachPlayerCard',
  hostId: hall,
  code: hidingSpot.code,
};

/** The only card attached to `hostId` in `state`. */
function onlyAttachmentOf(state: GameState, hostId: InstanceId): InstanceId {
  const [only, ...more] = state.order[zoneKey(attachedTo(hostId))] ?? [];
  if (only === undefined || more.length > 0) throw new Error(`one card is attached to ${hostId}`);
  return only;
}

describe('Handcuffs on an exhausted enemy at the hall', () => {
  /** The hall with Alice in it; each test adds the ghoul, which Alice evades first. */
  const hallWithAlice = newGame()
    .withLocation(hall, location)
    .withInvestigator(alice, { locationId: hall })
    .withCardData(handcuffs);

  it.each([
    { name: 'keeps a non-Elite enemy exhausted', enemy: plainGhoul, exhausted: true },
    { name: 'lets an Elite enemy ready', enemy: eliteGhoul, exhausted: false },
  ])('$name', ({ enemy, exhausted }) => {
    const { context, state } = hallWithAlice.withCard(ghoul, enemy, atLocation(hall)).start();

    const after = stateAfter(context, state, aliceEvadesGhoul, handcuffsOnGhoul, {
      type: 'ReadyEnemy',
      enemyId: ghoul,
    });

    expect(after.cards[ghoul]?.exhausted).toBe(exhausted);
  });

  it('keeps doom off it', () => {
    const { context, state } = hallWithAlice.withCard(ghoul, plainGhoul, atLocation(hall)).start();

    const after = stateAfter(context, state, handcuffsOnGhoul, {
      type: 'MoveTokens',
      token: 'doom',
      amount: 1,
      from: 'pool',
      to: { card: ghoul },
    });

    expect(after.cards[ghoul]?.tokens.doom).toBeUndefined();
  });
});

describe('Hiding Spot at the hall, where Alice is', () => {
  /** The hall with Alice in it; each test adds the ghoul, which Alice evades and which then readies. */
  const hallWithAlice = newGame()
    .withLocation(hall, location)
    .withInvestigator(alice, { locationId: hall })
    .withCardData(hidingSpot);

  it.each([
    {
      name: 'makes a non-Elite enemy aloof, so it does not engage',
      enemy: plainGhoul,
      zone: atLocation(hall),
    },
    { name: 'leaves an Elite enemy to engage', enemy: eliteGhoul, zone: engagedWith(alice) },
  ])('$name', ({ enemy, zone }) => {
    const { context, state } = hallWithAlice.withCard(ghoul, enemy, atLocation(hall)).start();

    const after = stateAfter(context, state, aliceEvadesGhoul, hidingSpotInHall, {
      type: 'ReadyEnemy',
      enemyId: ghoul,
    });

    expect(zoneOf(after, ghoul)).toEqual(zone);
  });

  it('keeps Alice from fighting the evaded, unengaged enemy', () => {
    const { context, state } = hallWithAlice.withCard(ghoul, plainGhoul, atLocation(hall)).start();
    const hidden = stateAfter(context, state, aliceEvadesGhoul, hidingSpotInHall);

    const rejection = rejectionFrom(context, hidden, {
      type: 'Fight',
      investigatorId: alice,
      enemyId: ghoul,
    });

    expect(rejection.code).toBe('aloofNotEngaged');
  });

  it('shows the gained aloof among the enemy keywords', () => {
    const { context, state } = hallWithAlice.withCard(ghoul, plainGhoul, atLocation(hall)).start();

    const after = stateAfter(context, state, aliceEvadesGhoul, hidingSpotInHall);

    expect(boardView(context, after).enemyStats(ghoul).keywords).toEqual([{ name: 'aloof' }]);
  });

  it('has a ready enemy engage Alice once Hiding Spot is discarded', () => {
    const { context, state } = hallWithAlice.withCard(ghoul, plainGhoul, atLocation(hall)).start();
    const hidden = stateAfter(context, state, aliceEvadesGhoul, hidingSpotInHall, {
      type: 'ReadyEnemy',
      enemyId: ghoul,
    });

    const after = stateAfter(context, hidden, {
      type: 'DiscardCard',
      cardId: onlyAttachmentOf(hidden, hall),
    });

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });
});
