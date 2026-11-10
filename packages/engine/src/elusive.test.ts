import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  type Command,
  type Zone,
} from './index';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const bat = instanceId('bat');

/** An elusive bat: fight 2, 3 health, attacks for 1 damage. */
const elusiveBat = blankEnemy('bat', {
  fight: 2,
  health: fixed(3),
  damage: 1,
  keywords: [{ name: 'elusive' }],
});
const retreat: Command = { type: 'RetreatEnemy', enemyId: bat };
const exhaustedAt = (zone: Zone) => ({ zone, exhausted: true });

describe('RetreatEnemy', () => {
  /** The cellar and the attic both connect to the hall, where alice is engaged with the bat. */
  const hallBetweenCellarAndAttic = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withLocation(cellar, blankLocation('cellar'))
    .withLocation(attic, blankLocation('attic'))
    .withConnection(hall, cellar)
    .withConnection(hall, attic)
    .withInvestigator(alice, { locationId: hall });

  it('moves to the connecting location without investigators, disengaged and exhausted', () => {
    const { context, state } = hallBetweenCellarAndAttic
      .withInvestigator(bob, { locationId: attic })
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, retreat);

    expect(after.cards[bat]).toMatchObject(exhaustedAt(atLocation(cellar)));
  });

  it('asks the lead between connecting locations without investigators, and moves there', () => {
    const { context, state } = hallBetweenCellarAndAttic
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();
    const asked = stateAfter(context, state, retreat);

    const after = stateAfter(context, asked, answer('retreat:bat', 'attic'));

    expect(asked.pending).toMatchObject([
      { kind: 'chooseLocation', options: [{ target: cellar }, { target: attic }] },
    ]);
    expect(after.cards[bat]).toMatchObject(exhaustedAt(atLocation(attic)));
  });

  it('moves next to an investigator when every connecting location has one, without engaging', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'))
      .withLocation(cellar, blankLocation('cellar'))
      .withConnection(hall, cellar)
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: cellar })
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, retreat);

    expect(after.cards[bat]).toMatchObject(exhaustedAt(atLocation(cellar)));
  });

  it('only disengages and exhausts without a connecting location', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'))
      .withInvestigator(alice, { locationId: hall })
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, retreat);

    expect(after.cards[bat]).toMatchObject(exhaustedAt(atLocation(hall)));
  });

  it('does nothing for an exhausted enemy', () => {
    const { context, state } = hallBetweenCellarAndAttic
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: bat }, retreat);

    expect(after.cards[bat]?.zone).toEqual(engagedWith(alice));
  });

  it('rejects a destination that does not connect', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'))
      .withLocation(cellar, blankLocation('cellar'))
      .withInvestigator(alice, { locationId: hall })
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    expect(rejectionFrom(context, state, { ...retreat, to: cellar })).toEqual({
      code: 'notConnected',
      from: hall,
      to: cellar,
    });
  });
});

describe('an elusive enemy after it attacks or is attacked', () => {
  /** Alice in the hall, engaged with the bat; the cellar connects and is empty. */
  const aliceEngagedWithBat = newGame()
    .withLocation(hall, blankLocation('hall'))
    .withLocation(cellar, blankLocation('cellar'))
    .withConnection(hall, cellar)
    .withInvestigator(alice, { locationId: hall });
  const fight: Command = { type: 'Fight', investigatorId: alice, enemyId: bat };

  it.each([
    { name: 'a hit', outcome: 'pass', damage: 1 },
    { name: 'a miss', outcome: 'fail', damage: 0 },
  ] as const)('retreats after $name', ({ outcome, damage }) => {
    const { context, state } = aliceEngagedWithBat
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, fight, answer('fight:alice:bat', outcome));

    expect(after.cards[bat]).toMatchObject({
      ...exhaustedAt(atLocation(cellar)),
      tokens: damage > 0 ? { damage } : {},
    });
  });

  it('stays defeated when the hit defeats it', () => {
    const { context, state } = aliceEngagedWithBat
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, fight, answer('fight:alice:bat', 'pass', 3));

    expect(after.cards[bat]?.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('retaliates on a miss first, then retreats after that attack', () => {
    const retaliatingBat = blankEnemy('bat', {
      fight: 2,
      damage: 1,
      keywords: [{ name: 'elusive' }, { name: 'retaliate' }],
    });
    const { context, state } = aliceEngagedWithBat
      .withCard(bat, retaliatingBat, engagedWith(alice))
      .start();
    const missed = stateAfter(context, state, fight, answer('fight:alice:bat', 'fail'));

    const after = stateAfter(context, missed, answer('retaliate:bat', 'attack'));

    expect(missed.cards[bat]?.zone).toEqual(engagedWith(alice));
    expect(after.cards[bat]).toMatchObject(exhaustedAt(atLocation(cellar)));
  });

  it('retreats after it attacks', () => {
    const { context, state } = aliceEngagedWithBat
      .withCard(bat, elusiveBat, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, {
      type: 'DealEnemyAttack',
      enemyId: bat,
      investigatorId: alice,
      damage: 1,
      horror: 0,
    });

    expect(after.cards[bat]).toMatchObject(exhaustedAt(atLocation(cellar)));
  });
});
