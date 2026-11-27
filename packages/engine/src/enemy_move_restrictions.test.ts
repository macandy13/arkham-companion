import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  engagedWith,
  enemyAttackList,
  instanceId,
  investigatorId,
  newGame,
  zoneOf,
  type Command,
} from './index';
import { answer, pendingIds, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const hunter = instanceId('hunter');

/** A hunter like Elokoss: "cannot move, and cannot make attacks of opportunity". */
const rootedHunter = blankEnemy('rooted_hunter', {
  keywords: [{ name: 'hunter' }],
  restrictions: [
    { cannot: 'move', of: 'self' },
    { cannot: 'attackOfOpportunity', of: 'self' },
  ],
});
/** The same hunter without restrictions. */
const plainHunter = blankEnemy('plain_hunter', { keywords: [{ name: 'hunter' }] });

/** Hall and cellar, connected. */
const hallAndCellar = newGame()
  .withLocation(hall, blankLocation('hall'), { revealed: true })
  .withLocation(cellar, blankLocation('cellar'), { revealed: true })
  .withConnection(hall, cellar);

describe('an enemy that cannot move', () => {
  /** Alice in the cellar, the rooted hunter unengaged in the hall. */
  const rootedInHall = hallAndCellar
    .withInvestigator(alice, { locationId: cellar })
    .withCard(hunter, rootedHunter, atLocation(hall))
    .start();

  it.each<{ name: string; move: Command }>([
    { name: 'a hunter step', move: { type: 'MoveHunters' } },
    { name: 'a card effect moving it', move: { type: 'MoveEnemy', enemyId: hunter, to: cellar } },
    {
      name: 'a forced card effect moving it',
      move: { type: 'MoveEnemy', enemyId: hunter, to: cellar, forced: true },
    },
    {
      name: 'a card effect moving it towards the cellar',
      move: { type: 'MoveEnemyTowards', enemyId: hunter, towards: cellar },
    },
    { name: 'an elusive retreat', move: { type: 'RetreatEnemy', enemyId: hunter } },
  ])('stays in the hall after $name', ({ move }) => {
    const { context, state } = rootedInHall;

    const after = stateAfter(context, state, move);

    expect(zoneOf(after, hunter)).toEqual(atLocation(hall));
  });

  it('stays behind, disengaged, when the investigator engaged with it moves away', () => {
    const { context, state } = hallAndCellar
      .withInvestigator(alice, { locationId: hall })
      .withCard(hunter, rootedHunter, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
    });

    expect(zoneOf(after, hunter)).toEqual(atLocation(hall));
  });
});

describe('an enemy that cannot make attacks of opportunity', () => {
  it.each([
    { name: 'the rooted hunter makes none', enemy: rootedHunter, attacks: [] },
    {
      name: 'the plain hunter makes one',
      enemy: plainHunter,
      attacks: [`attackOfOpportunity:${hunter}`],
    },
  ])('when alice, engaged with it, takes the resource action, $name', ({ enemy, attacks }) => {
    const { context, state } = hallAndCellar
      .withInvestigator(alice, { locationId: hall })
      .withCard(hunter, enemy, engagedWith(alice))
      .withTurnOf(alice)
      .start();

    const after = stateAfter(context, state, {
      type: 'GainResources',
      investigatorId: alice,
      amount: 1,
      asAction: true,
    });

    expect(pendingIds(after)).toEqual(attacks);
  });
});

describe('an enemy that cannot make attacks of opportunity, attacking otherwise', () => {
  /** Alice in the hall, engaged with the rooted hunter, which also retaliates. */
  const rootedOnAlice = () =>
    hallAndCellar
      .withInvestigator(alice, { locationId: hall })
      .withCard(
        hunter,
        { ...rootedHunter, fight: 4, keywords: [{ name: 'retaliate' }] },
        engagedWith(alice),
      )
      .start();

  it('still attacks alice in the enemy phase', () => {
    const { context, state } = rootedOnAlice();

    expect(enemyAttackList(context, state)).toMatchObject([
      { enemyId: hunter, investigatorId: alice },
    ]);
  });

  it('still retaliates when alice fails to hit it', () => {
    const { context, state } = rootedOnAlice();

    const after = stateAfter(
      context,
      state,
      { type: 'Fight', investigatorId: alice, enemyId: hunter },
      answer(`fight:${alice}:${hunter}`, 'fail'),
    );

    expect(pendingIds(after)).toEqual([`retaliate:${hunter}`]);
  });
});
