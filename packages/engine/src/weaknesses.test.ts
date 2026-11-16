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
  victoryDisplay,
  whenRevealed,
  type CardStats,
  type Command,
} from './index';
import { cardsInZone } from './lookup';
import { rejectionFrom, resolveRevelation, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const attic = instanceId('attic');
/** The IDs `DrawWeakness` gives alice's first and second weakness. */
const alicesWeakness = instanceId('alice:weakness:1');
const alicesSecondWeakness = instanceId('alice:weakness:2');

/** Weaknesses with no other property than the one in their name. */
const weaknessFoe = blankEnemy('weakness_foe');
const weaknessFoeWithVictory = blankEnemy('weakness_foe_with_victory', { victory: 1 });
const atticWeaknessFoe = blankEnemy('attic_weakness_foe', {
  keywords: [{ name: 'spawn', detail: 'attic' }],
});
const atticWeaknessFoeHuntingItsBearer = blankEnemy('attic_weakness_foe_hunting_its_bearer', {
  keywords: [
    { name: 'spawn', detail: 'attic' },
    { name: 'prey', detail: 'Bearer only' },
  ],
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

  it('spawns a weakness enemy with prey "Bearer only" apart from anyone but its drawer', () => {
    const { context, state } = aliceInHallBobInAttic(atticWeaknessFoeHuntingItsBearer);

    const after = stateAfter(context, state, aliceDraws(atticWeaknessFoeHuntingItsBearer));

    expect(after.cards[alicesWeakness]?.zone).toEqual({ kind: 'atLocation', locationId: attic });
  });

  it('gives a second weakness a card of its own', () => {
    const { context, state } = aliceInHallBobInAttic(weaknessFoe);

    const after = stateAfter(context, state, aliceDraws(weaknessFoe), aliceDraws(weaknessFoe));

    expect(cardsInZone(after, engagedWith(alice))).toEqual([alicesWeakness, alicesSecondWeakness]);
  });

  it('puts a treachery into the threat area its revelation names', () => {
    const { context, state } = aliceInHallBobInAttic(lingeringWeakness);

    const after = stateAfter(
      context,
      state,
      aliceDraws(lingeringWeakness),
      resolveRevelation(alicesWeakness),
    );

    expect(cardsInZone(after, threatAreaOf(alice))).toEqual([alicesWeakness]);
  });

  it('gives a resolved treachery back to its owner, not to the encounter discard', () => {
    const { context, state } = aliceInHallBobInAttic(plainWeakness);

    const after = stateAfter(context, state, aliceDraws(plainWeakness));

    expect(after.cards[alicesWeakness]?.zone).toEqual(outOfGame);
    expect(cardsInZone(after, encounterDiscard)).toEqual([]);
  });

  it('draws an encounter card for surge, as an encounter card does', () => {
    const { context, state } = aliceInHallBobInAttic(surgeWeakness);

    const after = stateAfter(context, state, aliceDraws(surgeWeakness));

    expect(cardsInZone(after, engagedWith(alice))).toEqual(['encounter_foe']);
  });

  it.each([
    { name: 'goes back to its owner', weakness: weaknessFoe, to: outOfGame },
    {
      name: 'with victory goes to the victory display',
      weakness: weaknessFoeWithVictory,
      to: victoryDisplay,
    },
  ])('a defeated weakness enemy $name', ({ weakness, to }) => {
    const { context, state } = aliceInHallBobInAttic(weakness);

    const after = stateAfter(context, state, aliceDraws(weakness), {
      type: 'DefeatEnemy',
      enemyId: alicesWeakness,
    });

    expect(after.cards[alicesWeakness]?.zone).toEqual(to);
  });

  it('gives a discarded weakness in the threat area back to its owner', () => {
    const { context, state } = aliceInHallBobInAttic(lingeringWeakness);

    const after = stateAfter(
      context,
      state,
      aliceDraws(lingeringWeakness),
      resolveRevelation(alicesWeakness),
      { type: 'MoveCard', cardId: alicesWeakness, to: { kind: 'encounterDiscard' } },
    );

    expect(after.cards[alicesWeakness]?.zone).toEqual(outOfGame);
  });

  it.each([
    { name: 'engaged with her', weakness: weaknessFoe, answers: [] },
    { name: 'engaged with bob', weakness: atticWeaknessFoe, answers: [] },
    {
      name: 'in her threat area',
      weakness: lingeringWeakness,
      answers: [resolveRevelation(alicesWeakness)],
    },
  ])(
    'removes a weakness of alice $name from the game when she is defeated',
    ({ weakness, answers }) => {
      const { context, state } = aliceInHallBobInAttic(weakness);

      const after = stateAfter(context, state, aliceDraws(weakness), ...answers, {
        type: 'DefeatInvestigator',
        investigatorId: alice,
      });

      expect(after.cards[alicesWeakness]?.zone).toEqual(outOfGame);
    },
  );

  it('refuses an asset or event weakness, which stays in its owner`s hand', () => {
    const { context, state } = aliceInHallBobInAttic(blankEvent('event_weakness'));

    expect(rejectionFrom(context, state, aliceDraws(blankEvent('event_weakness')))).toMatchObject({
      code: 'notAWeaknessToDraw',
    });
  });
});
