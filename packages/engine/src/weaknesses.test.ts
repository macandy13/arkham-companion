import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankEvent,
  blankLocation,
  blankTreachery,
  encounterDeck,
  encounterDiscard,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  outOfGame,
  putIntoThreatArea,
  threatAreaOf,
  whenRevealed,
  zoneKey,
  type CardStats,
  type Command,
  type GameState,
  type Zone,
} from './index';
import { rejectionFrom, resolveRevelation, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const attic = instanceId('attic');
/** The ID `DrawWeakness` gives alice's first weakness. */
const alicesWeakness = instanceId('alice:weakness:1');

/** Weaknesses with no other property than the one in their name. */
const weaknessFoe = blankEnemy('weakness_foe');
const weaknessFoeWithVictory = blankEnemy('weakness_foe_with_victory', { victory: 1 });
const atticWeaknessFoe = blankEnemy('attic_weakness_foe', {
  keywords: [{ name: 'spawn', detail: 'attic' }],
});
const plainWeakness = blankTreachery('plain_weakness');
const surgeWeakness = blankTreachery('surge_weakness', { keywords: [{ name: 'surge' }] });
const lingeringWeakness = blankTreachery('lingering_weakness', {
  abilities: [whenRevealed(putIntoThreatArea())],
});

/** Alice in the hall, bob in the attic next door, and an encounter deck of one plain foe. */
const aliceInHallBobInAttic = (weakness: CardStats) =>
  newGame()
    .withLocation(hall, blankLocation('hall'))
    .withLocation(attic, blankLocation('attic'))
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: attic, seat: 1 })
    .withCard(instanceId('encounter_foe'), blankEnemy('encounter_foe'), encounterDeck)
    .withCardData(weakness)
    .start();

const aliceDraws = (weakness: CardStats): Command => ({
  type: 'DrawWeakness',
  investigatorId: alice,
  code: weakness.code,
});

const idsIn = (state: GameState, zone: Zone) => state.order[zoneKey(zone)] ?? [];

describe('DrawWeakness', () => {
  it('spawns a weakness enemy engaged with its drawer, who owns it', () => {
    const { context, state } = aliceInHallBobInAttic(weaknessFoe);

    const after = stateAfter(context, state, aliceDraws(weaknessFoe));

    expect(after.cards[alicesWeakness]).toMatchObject({
      code: 'weakness_foe',
      zone: engagedWith(alice),
      faceUp: true,
      owner: alice,
    });
  });

  it('spawns a weakness enemy where its spawn instruction says, engaging who is there', () => {
    const { context, state } = aliceInHallBobInAttic(atticWeaknessFoe);

    const after = stateAfter(context, state, aliceDraws(atticWeaknessFoe));

    expect(after.cards[alicesWeakness]?.zone).toEqual(engagedWith(bob));
  });

  it('gives a second weakness a card of its own', () => {
    const { context, state } = aliceInHallBobInAttic(weaknessFoe);

    const after = stateAfter(context, state, aliceDraws(weaknessFoe), aliceDraws(weaknessFoe));

    expect(idsIn(after, engagedWith(alice))).toEqual([alicesWeakness, 'alice:weakness:2']);
  });

  it('puts a treachery into the threat area its revelation names', () => {
    const { context, state } = aliceInHallBobInAttic(lingeringWeakness);

    const after = stateAfter(
      context,
      state,
      aliceDraws(lingeringWeakness),
      resolveRevelation('alice:weakness:1'),
    );

    expect(idsIn(after, threatAreaOf(alice))).toEqual([alicesWeakness]);
  });

  it('gives a resolved treachery back to its owner, not to the encounter discard', () => {
    const { context, state } = aliceInHallBobInAttic(plainWeakness);

    const after = stateAfter(context, state, aliceDraws(plainWeakness));

    expect(after.cards[alicesWeakness]?.zone).toEqual(outOfGame);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('draws an encounter card for surge, as an encounter card does', () => {
    const { context, state } = aliceInHallBobInAttic(surgeWeakness);

    const after = stateAfter(context, state, aliceDraws(surgeWeakness));

    expect(idsIn(after, engagedWith(alice))).toEqual(['encounter_foe']);
  });

  it.each([
    { name: 'without victory', weakness: weaknessFoe },
    { name: 'with victory', weakness: weaknessFoeWithVictory },
  ])('gives a defeated weakness enemy $name back to its owner', ({ weakness }) => {
    const { context, state } = aliceInHallBobInAttic(weakness);

    const after = stateAfter(context, state, aliceDraws(weakness), {
      type: 'DefeatEnemy',
      enemyId: alicesWeakness,
    });

    expect(after.cards[alicesWeakness]?.zone).toEqual(outOfGame);
  });

  it('gives a discarded weakness in the threat area back to its owner', () => {
    const { context, state } = aliceInHallBobInAttic(lingeringWeakness);

    const after = stateAfter(
      context,
      state,
      aliceDraws(lingeringWeakness),
      resolveRevelation('alice:weakness:1'),
      { type: 'DiscardCard', cardId: alicesWeakness },
    );

    expect(after.cards[alicesWeakness]?.zone).toEqual(outOfGame);
  });

  it('leaves a weakness enemy at the location when its owner is defeated, until it leaves play', () => {
    const { context, state } = aliceInHallBobInAttic(weaknessFoe);

    const defeated = stateAfter(context, state, aliceDraws(weaknessFoe), {
      type: 'DefeatInvestigator',
      investigatorId: alice,
    });
    const discarded = stateAfter(context, defeated, {
      type: 'DiscardCard',
      cardId: alicesWeakness,
    });

    expect(defeated.cards[alicesWeakness]?.zone).toEqual({ kind: 'atLocation', locationId: hall });
    expect(discarded.cards[alicesWeakness]?.zone).toEqual(outOfGame);
  });

  it('refuses an asset or event weakness, which stays in its owner`s hand', () => {
    const { context, state } = aliceInHallBobInAttic(blankEvent('event_weakness'));

    expect(rejectionFrom(context, state, aliceDraws(blankEvent('event_weakness')))).toMatchObject({
      code: 'notAWeaknessToDraw',
    });
  });
});
