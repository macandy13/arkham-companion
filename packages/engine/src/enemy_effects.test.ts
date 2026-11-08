import { describe, expect, it } from 'vitest';
import {
  afterEntering,
  afterEvaded,
  atLocation,
  blankEnemy,
  blankLocation,
  dealDamageTo,
  defeatEnemy,
  eachEnemy,
  encounterDiscard,
  engagedWith,
  engagesYou,
  exhaustEnemy,
  fixed,
  instanceId,
  investigatorId,
  itsLocation,
  newGame,
  trait,
  victoryDisplay,
} from './index';
import { stateAfter } from '../test/utils';

const hall = instanceId('hall');
const attic = instanceId('attic');
const alice = investigatorId('alice');

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

describe('card effects that exhaust, engage or defeat an enemy', () => {
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

  it('lets an exhausted enemy at the entered location engage the investigator', () => {
    /** "After you enter the attic: each enemy here engages you." */
    const atticCard = blankLocation('attic', {
      abilities: [afterEntering(engagesYou({ ref: 'eachEnemyAt', location: itsLocation() }))],
    });
    const { context, state } = newGame()
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(attic, atticCard, { revealed: true })
      .withInvestigator(alice, { locationId: hall })
      .withCard(tired, ghoulCard, atLocation(attic))
      .start();
    const tiredExhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: tired });

    const after = stateAfter(context, tiredExhausted, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    expect(after.cards[tired]?.zone).toEqual(engagedWith(alice));
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
