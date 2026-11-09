import { describe, expect, it } from 'vitest';
import {
  afterEntering,
  afterEvaded,
  atLocation,
  blankEnemy,
  blankLocation,
  cardCode,
  dealDamageTo,
  defeatEnemy,
  eachEnemy,
  eachInvestigatorAt,
  encounterDiscard,
  enemyAttacks,
  engagesYou,
  engagedWith,
  exhaustEnemy,
  fixed,
  instanceId,
  investigatorId,
  itsLocation,
  newGame,
  onlyCopy,
  trait,
  victoryDisplay,
  type Command,
} from './index';
import { requireInvestigator } from './investigators';
import { answer, investigatorOf, pendingIds, rejectionFrom, stateAfter } from '../test/utils';

const hall = instanceId('hall');
const attic = instanceId('attic');
const alice = investigatorId('alice');
const bob = investigatorId('bob');

describe('card effects that deal damage to enemies', () => {
  const frail = instanceId('frail_monster');
  const sturdy = instanceId('sturdy_monster');
  const cultist = instanceId('cultist');
  /** "After you enter the attic: deal 1 damage to each [[Monster]] enemy." */
  const atticCard = blankLocation('attic', {
    abilities: [afterEntering(dealDamageTo(eachEnemy({ trait: trait('Monster') }), 1))],
  });
  const monster = { traits: [trait('Monster')] };

  it('damages each Monster enemy and defeats the one the damage brings to its health', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(
        frail,
        blankEnemy('frail_monster', { ...monster, health: fixed(1) }),
        atLocation(hall),
      )
      .withCard(
        sturdy,
        blankEnemy('sturdy_monster', { ...monster, health: fixed(3) }),
        atLocation(hall),
      )
      .withCard(cultist, blankEnemy('cultist', { health: fixed(1) }), atLocation(hall))
      .start();

    const after = stateAfter(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    expect(after.cards[frail]?.zone).toEqual(encounterDiscard);
    expect(after.cards[sturdy]?.tokens).toEqual({ damage: 1 });
    expect(after.cards[cultist]?.tokens).toEqual({});
  });
});

describe('card effects that exhaust or defeat an enemy', () => {
  const ready = instanceId('ready_ghoul');
  const tired = instanceId('tired_ghoul');
  const ghoulCard = blankEnemy('ghoul');

  it('exhausts each enemy at the entered location, leaving an exhausted one as it is', () => {
    /** "After you enter the attic: exhaust each enemy here." */
    const atticCard = blankLocation('attic', {
      abilities: [afterEntering(exhaustEnemy({ ref: 'eachEnemyAt', location: itsLocation() }))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ready, ghoulCard, atLocation(attic))
      .withCard(tired, ghoulCard, atLocation(attic))
      .start();
    const tiredExhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: tired });

    const after = stateAfter(context, tiredExhausted, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
      avoidEngagement: true,
    });

    expect(after.cards[ready]?.exhausted).toBe(true);
    expect(after.cards[tired]?.exhausted).toBe(true);
  });

  it.each([
    { victory: 1, zone: victoryDisplay },
    { victory: undefined, zone: encounterDiscard },
  ])(
    'defeats an evaded enemy without damage, to the zone a victory of $victory sends it',
    ({ victory, zone }) => {
      const shade = instanceId('shade');
      /** "After this enemy is evaded: it is automatically defeated." */
      const shadeCard = blankEnemy('shade', {
        health: fixed(3),
        ...(victory === undefined ? {} : { victory }),
        abilities: [afterEvaded(defeatEnemy({ ref: 'self' }))],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(shade, shadeCard, engagedWith(alice))
        .start();

      const after = stateAfter(context, state, {
        type: 'EvadeEnemy',
        enemyId: shade,
        investigatorId: alice,
      });

      expect(after.cards[shade]?.zone).toEqual(zone);
    },
  );
});

describe('card effects that make an enemy attack', () => {
  const ghoul = instanceId('ghoul');
  const cellar = instanceId('cellar');
  /** A ghoul that deals 1 damage and 2 horror, kept in the cellar, away from the investigators. */
  const ghoulCard = blankEnemy('ghoul', { damage: 1, horror: 2 });
  const aliceEntersAttic: Command = {
    type: 'MoveInvestigator',
    investigatorId: alice,
    to: attic,
    ignoreConnections: true,
  };

  it('asks alice to take the printed attack, lowered by what her assets soak', () => {
    /** "After you enter the attic: the ghoul attacks you." */
    const atticCard = blankLocation('attic', {
      abilities: [afterEntering(enemyAttacks(onlyCopy(cardCode('ghoul'))))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .start();

    const asked = stateAfter(context, state, aliceEntersAttic);
    const attacked = stateAfter(context, asked, {
      ...answer(`cardAttack:${ghoul}:${alice}`, 'attack'),
      amounts: { damage: 1, horror: 1 },
    });

    expect(asked.pending[0]).toMatchObject({
      prompt: 'decision.cardAttack',
      options: [
        { id: 'attack', amounts: { damage: { default: 1 }, horror: { default: 2 } } },
        { id: 'skip', label: 'decision.attackCancelled' },
      ],
    });
    expect(investigatorOf(attacked, alice)).toMatchObject({
      health: { damage: 1 },
      sanity: { horror: 1 },
    });
    expect(attacked.cards[ghoul]).toMatchObject({ exhausted: false, zone: atLocation(cellar) });
  });

  it('lets alice cancel the attack', () => {
    /** "After you enter the attic: the ghoul attacks you." */
    const atticCard = blankLocation('attic', {
      abilities: [afterEntering(enemyAttacks(onlyCopy(cardCode('ghoul'))))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .start();
    const asked = stateAfter(context, state, aliceEntersAttic);

    const cancelled = stateAfter(context, asked, answer(`cardAttack:${ghoul}:${alice}`, 'skip'));

    expect(investigatorOf(cancelled, alice)).toMatchObject({
      health: { damage: 0 },
      sanity: { horror: 0 },
    });
    expect(cancelled.pending).toEqual([]);
  });

  it('asks each investigator in the attic in turn, when the ghoul attacks each of them', () => {
    /** "After you enter the attic: the ghoul attacks each investigator in the attic." */
    const atticCard = blankLocation('attic', {
      abilities: [
        afterEntering(
          enemyAttacks(
            onlyCopy(cardCode('ghoul')),
            eachInvestigatorAt(onlyCopy(cardCode('attic'))),
          ),
        ),
      ],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: attic })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .start();

    const asked = stateAfter(context, state, aliceEntersAttic);
    const aliceTookIt = stateAfter(
      context,
      asked,
      answer(`cardAttack:${ghoul}:${alice}`, 'attack'),
    );

    expect(pendingIds(asked)).toEqual([`cardAttack:${ghoul}:${alice}`]);
    expect(pendingIds(aliceTookIt)).toEqual([`cardAttack:${ghoul}:${bob}`]);
  });

  it('asks nothing when the ghoul has left play', () => {
    /** "After you enter the attic: the ghoul attacks you." */
    const atticCard = blankLocation('attic', {
      abilities: [afterEntering(enemyAttacks(onlyCopy(cardCode('ghoul'))))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, ghoulCard, encounterDiscard)
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(requireInvestigator(after, alice)).toMatchObject({ locationId: attic });
    expect(after.pending).toEqual([]);
  });
});

describe('a card effect that makes an enemy engage you', () => {
  const ghoul = instanceId('ghoul');
  const cellar = instanceId('cellar');
  /** "After you enter the attic: the ghoul engages you." */
  const atticCard = blankLocation('attic', {
    abilities: [afterEntering(engagesYou(onlyCopy(cardCode('ghoul'))))],
  });
  const aliceEntersAttic: Command = {
    type: 'MoveInvestigator',
    investigatorId: alice,
    to: attic,
    ignoreConnections: true,
  };

  it.each([
    { ghoulStarts: 'in the cellar', zone: atLocation(cellar), exhausted: false },
    { ghoulStarts: 'exhausted in the cellar', zone: atLocation(cellar), exhausted: true },
    { ghoulStarts: 'engaged with bob', zone: engagedWith(bob), exhausted: false },
    { ghoulStarts: 'engaged with alice', zone: engagedWith(alice), exhausted: false },
  ])('engages alice with the ghoul that starts $ghoulStarts', ({ zone, exhausted }) => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: cellar })
      .withCard(ghoul, blankEnemy('ghoul'), zone)
      .start();
    const ghoulBefore = exhausted
      ? stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul })
      : state;

    const after = stateAfter(context, ghoulBefore, aliceEntersAttic);

    expect(requireInvestigator(after, alice)).toMatchObject({ locationId: attic });
    expect(after.cards[ghoul]?.zone).toEqual(engagedWith(alice));
  });

  it('leaves a massive ghoul where it is', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul', { keywords: [{ name: 'massive' }] }), atLocation(cellar))
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(requireInvestigator(after, alice)).toMatchObject({ locationId: attic });
    expect(after.cards[ghoul]?.zone).toEqual(atLocation(cellar));
  });

  it('changes nothing when the ghoul has left play', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul'), encounterDiscard)
      .start();

    const after = stateAfter(context, state, aliceEntersAttic);

    expect(requireInvestigator(after, alice)).toMatchObject({ locationId: attic });
    expect(after.cards[ghoul]?.zone).toEqual(encounterDiscard);
  });

  it('keeps refusing the engage action on an enemy at another location', () => {
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, blankLocation('cellar'), { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(ghoul, blankEnemy('ghoul'), atLocation(cellar))
      .start();

    expect(
      rejectionFrom(context, state, { type: 'EngageEnemy', investigatorId: alice, enemyId: ghoul }),
    ).toMatchObject({ code: 'investigatorNotAtLocation' });
  });
});
