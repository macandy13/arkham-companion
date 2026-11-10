import { describe, expect, it } from 'vitest';
import {
  apply,
  atLocation,
  blankAsset,
  blankEnemy,
  blankLocation,
  checkInvariants,
  enemyAttackList,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  trait,
  zoneOf,
  perInvestigator,
  zoneKey,
  type GameBuilder,
  type InstanceId,
  type Zone,
} from './index';
import { requireInvestigator } from './investigators';
import { engageEvents } from './engagement';
import { replay } from './reducer';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

const hallCard = blankLocation('hall');
const cellarCard = blankLocation('cellar');
const atticCard = blankLocation('attic');
/** The plain enemy of these tests: 2 health per investigator, 1 damage, 2 horror. */
const ghoulCard = blankEnemy('ghoul', { health: perInvestigator(2), damage: 1, horror: 2 });
const victoryGhoulCard = blankEnemy('victory_ghoul', { victory: 1 });
const aloofGhoulCard = blankEnemy('aloof_ghoul', { keywords: [{ name: 'aloof' }] });
/** A massive enemy dealing 2 damage and no horror. */
const massiveGhoulCard = blankEnemy('massive_ghoul', {
  damage: 2,
  keywords: [{ name: 'massive' }],
});
const mostCluesPreyGhoulCard = blankEnemy('most_clues_prey_ghoul', {
  keywords: [{ name: 'prey', detail: 'Most clues' }],
});
const cellarSpawnGhoulCard = blankEnemy('cellar_spawn_ghoul', {
  keywords: [{ name: 'spawn', detail: 'Cellar' }],
});
const unreadableSpawnGhoulCard = blankEnemy('unreadable_spawn_ghoul', {
  keywords: [{ name: 'spawn', detail: 'wherever the stars are right' }],
});
const relicCard = blankAsset('relic');

const setAside: Zone = { kind: 'setAside' };
const encounterDiscard: Zone = { kind: 'encounterDiscard' };

/** The map of these tests: hall - cellar - attic in a line, without investigators. */
const hallCellarAttic = newGame()
  .withLocation(hall, hallCard)
  .withLocation(cellar, cellarCard)
  .withLocation(attic, atticCard)
  .withConnection(hall, cellar)
  .withConnection(cellar, attic);

/** The map with alice (seat 0) in the hall, the table of most tests. */
const aliceInHall = hallCellarAttic.withInvestigator(alice, { locationId: hall });

/** The map with alice (seat 0) and bob (seat 1), both at `where`, with the given clues. */
function aliceAndBobAt(where: InstanceId, clues: { alice: number; bob: number }): GameBuilder {
  return hallCellarAttic
    .withInvestigator(alice, { locationId: where, clues: clues.alice })
    .withInvestigator(bob, { locationId: where, clues: clues.bob });
}

describe('SpawnEnemy', () => {
  it.each([
    {
      name: 'engages the drawer at the drawer`s location',
      card: ghoulCard,
      target: { investigatorId: alice },
      zone: engagedWith(alice),
    },
    {
      name: 'stays unengaged when nobody is at the spawn location',
      card: ghoulCard,
      target: { at: attic },
      zone: atLocation(attic),
    },
    {
      name: 'follows the spawn keyword',
      card: cellarSpawnGhoulCard,
      target: { investigatorId: alice },
      zone: atLocation(cellar),
    },
    {
      name: 'lets an explicit location override the spawn keyword',
      card: cellarSpawnGhoulCard,
      target: { at: attic },
      zone: atLocation(attic),
    },
    {
      name: 'does not engage an aloof enemy',
      card: aloofGhoulCard,
      target: { investigatorId: alice },
      zone: atLocation(hall),
    },
    {
      name: 'keeps a massive enemy at the location',
      card: massiveGhoulCard,
      target: { investigatorId: alice },
      zone: atLocation(hall),
    },
  ])('$name', ({ card, target, zone }) => {
    const { context, state } = aliceInHall.withCard(ghoul, card, setAside).start();

    const after = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, ...target });

    expect(zoneOf(after, ghoul)).toEqual(zone);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('produces a move and an engagement', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, setAside).start();

    const { events } = execute(context, state, {
      type: 'SpawnEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(events.map((e) => e.type)).toEqual(['CardMoved', 'EnemyEngaged']);
  });

  it('asks the players when the spawn keyword matches several locations', () => {
    const second = instanceId('second_cellar');
    const { context, state } = aliceInHall
      .withLocation(second, cellarCard)
      .withCard(ghoul, cellarSpawnGhoulCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(zoneOf(after, ghoul)).toEqual(setAside);
    expect(after.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        subject: ghoul,
        options: [{ target: cellar }, { target: second }],
      },
    ]);
  });

  it('asks the players, among all locations in play, when the spawn text is unreadable', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, unreadableSpawnGhoulCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(zoneOf(after, ghoul)).toEqual(setAside);
    expect(after.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        options: [{ target: hall }, { target: cellar }, { target: attic }],
      },
    ]);
  });

  it('discards the enemy when the named location is not in play', () => {
    const { context, state } = aliceInHall.withCard(ghoul, cellarSpawnGhoulCard, setAside).start();
    const withoutCellar = stateAfter(context, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: cellar, to: setAside },
    });

    const after = stateAfter(context, withoutCellar, {
      type: 'SpawnEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(zoneOf(after, ghoul)).toEqual(encounterDiscard);
    expect(after.pending).toEqual([]);
  });

  it('never engages an exhausted enemy', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(attic)).start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });
    const arrivedInHall = replay(
      [{ type: 'CardMoved', cardId: ghoul, from: atLocation(attic), to: atLocation(hall) }],
      exhausted,
    );

    expect(engageEvents(context, arrivedInHall, ghoul)).toEqual([]);
    expect(engageEvents(context, arrivedInHall, ghoul, alice)).toEqual([]);
  });

  describe('with alice (1 clue) and bob (3 clues) at the hall', () => {
    const aliceAndBob = aliceAndBobAt(hall, { alice: 1, bob: 3 });

    it('engages the investigator its prey picks, when spawned by an effect', () => {
      const { context, state } = aliceAndBob
        .withCard(ghoul, mostCluesPreyGhoulCard, setAside)
        .start();

      const after = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(bob));
      expect(after.pending).toEqual([]);
    });

    it('engages the drawer whatever the prey, without a spawn instruction', () => {
      const { context, state } = aliceAndBob
        .withCard(ghoul, mostCluesPreyGhoulCard, setAside)
        .start();

      const after = stateAfter(context, state, {
        type: 'SpawnEnemy',
        enemyId: ghoul,
        investigatorId: alice,
      });

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
      expect(after.pending).toEqual([]);
    });

    it('engages neither the drawer nor anyone else its "only" prey leaves out', () => {
      const onlyBobGhoulCard = blankEnemy('only_bob_ghoul', {
        keywords: [{ name: 'prey', detail: 'Bob only' }],
      });
      const { context, state } = aliceAndBob.withCard(ghoul, onlyBobGhoulCard, setAside).start();

      const after = stateAfter(context, state, {
        type: 'SpawnEnemy',
        enemyId: ghoul,
        investigatorId: alice,
      });

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(bob));
    });

    it('engages whom an effect names, whatever its "only" prey', () => {
      const onlyBobGhoulCard = blankEnemy('only_bob_ghoul', {
        keywords: [{ name: 'prey', detail: 'Bob only' }],
      });
      const { context, state } = aliceAndBob.withCard(ghoul, onlyBobGhoulCard, setAside).start();

      const after = stateAfter(context, state, {
        type: 'SpawnEnemy',
        enemyId: ghoul,
        engagedWith: alice,
      });

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
    });

    it('leaves a ready "only" enemy unengaged next to alice, whom it ignores', () => {
      const onlyBobGhoulCard = blankEnemy('only_bob_ghoul', {
        keywords: [{ name: 'prey', detail: 'Bob only' }],
      });
      const { context, state } = aliceInHall
        .withInvestigator(bob, { locationId: cellar })
        .withCard(ghoul, onlyBobGhoulCard, atLocation(hall))
        .start();

      expect(engageEvents(context, state, ghoul)).toEqual([]);
    });

    it('stays unengaged when its "only" prey is nobody at the location', () => {
      const onlyCarolGhoulCard = blankEnemy('only_carol_ghoul', {
        keywords: [{ name: 'prey', detail: 'Carol only' }],
      });
      const { context, state } = aliceAndBob
        .withInvestigator(investigatorId('carol'), { locationId: cellar })
        .withCard(ghoul, onlyCarolGhoulCard, setAside)
        .start();

      const after = stateAfter(context, state, {
        type: 'SpawnEnemy',
        enemyId: ghoul,
        investigatorId: alice,
      });

      expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
      expect(after.pending).toEqual([]);
    });

    it('asks the players when there is no prey and no drawer', () => {
      const { context, state } = aliceAndBob.withCard(ghoul, ghoulCard, setAside).start();

      const after = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

      expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
      expect(after.pending).toMatchObject([
        {
          kind: 'chooseInvestigator',
          subject: ghoul,
          options: [{ target: alice }, { target: bob }],
        },
      ]);
    });
  });

  it.each([
    { prey: 'Highest [combat]', engaged: bob },
    { prey: 'Lowest [combat]', engaged: alice },
  ])('engages by its prey "$prey" read from the card', ({ prey, engaged }) => {
    const skillPreyGhoulCard = blankEnemy('skill_prey_ghoul', {
      keywords: [{ name: 'prey', detail: prey }],
    });
    const { context, state } = hallCellarAttic
      .withInvestigator(alice, {
        locationId: hall,
        skills: { willpower: 3, intellect: 3, combat: 2, agility: 3 },
      })
      .withInvestigator(bob, {
        locationId: hall,
        skills: { willpower: 3, intellect: 3, combat: 5, agility: 3 },
      })
      .withCard(ghoul, skillPreyGhoulCard, setAside)
      .start();

    const after = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(engaged));
  });

  it('asks the players when its prey is text the engine cannot read', () => {
    const unreadablePreyGhoulCard = blankEnemy('unreadable_prey_ghoul', {
      keywords: [{ name: 'prey', detail: 'Fewest cards in hand' }],
    });
    const { context, state } = aliceAndBobAt(hall, { alice: 1, bob: 3 })
      .withCard(ghoul, unreadablePreyGhoulCard, setAside)
      .start();

    const after = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

    expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
    expect(after.pending).toMatchObject([
      {
        kind: 'chooseInvestigator',
        subject: ghoul,
        prompt: 'decision.choosePrey',
        options: [{ target: alice }, { target: bob }],
      },
    ]);
  });

  it('asks the players when prey is tied, and engaging answers the question', () => {
    const { context, state } = aliceAndBobAt(hall, { alice: 2, bob: 2 })
      .withCard(ghoul, mostCluesPreyGhoulCard, setAside)
      .start();
    const asked = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

    const after = stateAfter(context, asked, answer('engage:ghoul', bob));

    expect(asked.pending).toHaveLength(1);
    expect(after.pending).toEqual([]);
    expect(zoneOf(after, ghoul)).toEqual(engagedWith(bob));
  });

  it.each([
    {
      name: 'an enemy that is already in play',
      card: ghoulCard,
      zone: atLocation(hall),
      command: { type: 'SpawnEnemy', enemyId: ghoul, at: hall },
      rejection: { code: 'enemyAlreadyInPlay', cardId: ghoul },
    },
    {
      name: 'a card that is not an enemy',
      card: relicCard,
      zone: setAside,
      command: { type: 'SpawnEnemy', enemyId: ghoul, at: hall },
      rejection: { code: 'notAnEnemy', cardId: ghoul },
    },
    {
      name: 'a spawn without any location',
      card: ghoulCard,
      zone: setAside,
      command: { type: 'SpawnEnemy', enemyId: ghoul },
      rejection: { code: 'noSpawnLocation', cardId: ghoul },
    },
    {
      name: 'an explicit location that is not on a map',
      card: ghoulCard,
      zone: setAside,
      command: { type: 'SpawnEnemy', enemyId: ghoul, at: instanceId('relic_card') },
      rejection: { code: 'notALocation', cardId: instanceId('relic_card') },
    },
  ] as const)('rejects $name', ({ card, zone, command, rejection }) => {
    const { context, state } = aliceInHall
      .withCard(ghoul, card, zone)
      .withCard(instanceId('relic_card'), relicCard, setAside)
      .start();

    expect(rejectionFrom(context, state, command)).toEqual(rejection);
  });
});

describe('setup', () => {
  it('engages an enemy that starts at the investigators` location', () => {
    const { state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(hall)).start();

    expect(zoneOf(state, ghoul)).toEqual(engagedWith(alice));
  });

  it('leaves an enemy that starts elsewhere unengaged', () => {
    const { state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(attic)).start();

    expect(zoneOf(state, ghoul)).toEqual(atLocation(attic));
  });
});

describe('moving into an enemy`s location', () => {
  const aliceMovesToCellar = {
    type: 'MoveInvestigator',
    investigatorId: alice,
    to: cellar,
  } as const;

  it.each([
    { card: ghoulCard, name: 'engages a ready enemy', zone: engagedWith(alice) },
    { card: aloofGhoulCard, name: 'leaves an aloof enemy unengaged', zone: atLocation(cellar) },
    {
      card: massiveGhoulCard,
      name: 'leaves a massive enemy at the location, out of any threat area',
      zone: atLocation(cellar),
    },
  ])('$name', ({ card, zone }) => {
    const { context, state } = aliceInHall.withCard(ghoul, card, atLocation(cellar)).start();

    const after = stateAfter(context, state, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(zone);
  });

  it('leaves an exhausted enemy unengaged', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(cellar)).start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const after = stateAfter(context, exhausted, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
  });

  it('engages every ready enemy there', () => {
    const secondGhoul = instanceId('second_ghoul');
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(secondGhoul, ghoulCard, atLocation(cellar))
      .start();

    const after = stateAfter(context, state, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
    expect(zoneOf(after, secondGhoul)).toEqual(engagedWith(alice));
  });

  it('engages after a move that ignores connections, which only card effects make', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(attic)).start();

    const after = stateAfter(context, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it('leaves the enemy unengaged after a move that avoids engagement, which only card effects make', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(cellar)).start();

    const after = stateAfter(context, state, { ...aliceMovesToCellar, avoidEngagement: true });

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
    expect(requireInvestigator(after, alice).locationId).toBe(cellar);
  });

  it('leaves an enemy at another location alone', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(attic)).start();

    const after = stateAfter(context, state, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(atLocation(attic));
  });
});

describe('engagement commands', () => {
  it('engages an enemy at the investigator`s location', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, aloofGhoulCard, atLocation(hall))
      .start();

    const after = stateAfter(context, state, {
      type: 'EngageEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it.each([
    {
      name: 'an enemy at another location',
      zone: atLocation(attic),
      rejection: { code: 'investigatorNotAtLocation', investigatorId: alice, locationId: attic },
    },
    {
      name: 'the investigator it is already engaged with',
      zone: engagedWith(alice),
      rejection: { code: 'alreadyEngaged', cardId: ghoul, investigatorId: alice },
    },
  ])('rejects engaging $name', ({ zone, rejection }) => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, zone).start();

    expect(
      rejectionFrom(context, state, { type: 'EngageEnemy', enemyId: ghoul, investigatorId: alice }),
    ).toEqual(rejection);
  });

  it('rejects engaging a massive enemy, which already counts as engaged with everyone at its location', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, massiveGhoulCard, atLocation(hall))
      .start();

    expect(
      rejectionFrom(context, state, { type: 'EngageEnemy', enemyId: ghoul, investigatorId: alice }),
    ).toEqual({ code: 'massiveNotEngageable', cardId: ghoul });
  });

  it('disengages an enemy, leaving it at the investigator`s location', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const after = stateAfter(context, state, { type: 'DisengageEnemy', enemyId: ghoul });

    expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
  });

  it.each([
    {
      name: 'exhausts and disengages an enemy engaged with alice',
      zone: engagedWith(alice),
      after: atLocation(hall),
    },
    {
      name: 'only exhausts an enemy engaged with bob',
      zone: engagedWith(bob),
      after: engagedWith(bob),
    },
  ])('evading by a card effect $name', ({ zone, after: zoneAfter }) => {
    const { context, state } = aliceAndBobAt(hall, { alice: 0, bob: 0 })
      .withCard(ghoul, ghoulCard, zone)
      .start();

    const after = stateAfter(context, state, {
      type: 'EvadeEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(after.cards[ghoul]).toMatchObject({ exhausted: true, zone: zoneAfter });
  });

  it('rejects disengaging an unengaged enemy', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, aloofGhoulCard, atLocation(hall))
      .start();

    expect(rejectionFrom(context, state, { type: 'DisengageEnemy', enemyId: ghoul })).toEqual({
      code: 'notEngaged',
      cardId: ghoul,
    });
  });
});

// Moves by card effects (and by hand on the map): the hall, cellar and attic lie in a line, and
// the hall and attic are not connected.
describe('MoveEnemy', () => {
  const moveGhoulTo = (to: InstanceId) => ({ type: 'MoveEnemy', enemyId: ghoul, to }) as const;

  it('moves an enemy to a location it has no connection to, without revealing it', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, aloofGhoulCard, atLocation(hall))
      .start();

    const after = stateAfter(context, state, moveGhoulTo(attic));

    expect(zoneOf(after, ghoul)).toEqual(atLocation(attic));
    expect(after.cards[attic]?.faceUp).toBe(false);
  });

  it('disengages an engaged enemy and moves it by a forced instruction', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const after = stateAfter(context, state, { ...moveGhoulTo(cellar), forced: true });

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
  });

  it.each([
    { card: ghoulCard, name: 'engages a ready enemy', zone: engagedWith(alice) },
    { card: aloofGhoulCard, name: 'leaves an aloof enemy unengaged', zone: atLocation(hall) },
  ])('$name at the investigator`s location', ({ card, zone }) => {
    const { context, state } = aliceInHall.withCard(ghoul, card, atLocation(cellar)).start();

    const after = stateAfter(context, state, moveGhoulTo(hall));

    expect(zoneOf(after, ghoul)).toEqual(zone);
  });

  it.each([
    { name: 'an unengaged enemy', zone: atLocation(cellar), to: cellar, forced: false },
    { name: 'an enemy engaged there', zone: engagedWith(alice), to: hall, forced: false },
    {
      name: 'an enemy engaged there, by a forced instruction',
      zone: engagedWith(alice),
      to: hall,
      forced: true,
    },
  ])('leaves $name where it is when moved to its own location', ({ zone, to, forced }) => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, zone).start();

    const after = stateAfter(context, state, { ...moveGhoulTo(to), forced });

    expect(zoneOf(after, ghoul)).toEqual(zone);
  });

  it('asks the players whom it engages when two investigators are there', () => {
    const { context, state } = aliceAndBobAt(hall, { alice: 0, bob: 0 })
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .start();

    const after = stateAfter(context, state, moveGhoulTo(hall));

    expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
    expect(after.pending.map((decision) => decision.options.map((option) => option.id))).toEqual([
      [alice, bob],
    ]);
  });

  it('leaves an exhausted enemy unengaged at the investigator`s location', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(cellar)).start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const after = stateAfter(context, exhausted, moveGhoulTo(hall));

    expect(zoneOf(after, ghoul)).toEqual(atLocation(hall));
  });

  it.each([
    {
      name: 'an engaged enemy, which moves only with its investigator',
      zone: engagedWith(alice),
      to: cellar,
      rejection: { code: 'enemyEngaged', cardId: ghoul, investigatorId: alice },
    },
    {
      name: 'an enemy that is not in play',
      zone: setAside,
      to: cellar,
      rejection: { code: 'enemyNotInPlay', cardId: ghoul },
    },
  ])('rejects moving $name', ({ zone, to, rejection }) => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, zone).start();

    expect(rejectionFrom(context, state, moveGhoulTo(to))).toEqual(rejection);
  });

  it('rejects moving an enemy onto a card that is not a location', () => {
    const relic = instanceId('relic');
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(relic, relicCard, atLocation(hall))
      .start();

    expect(rejectionFrom(context, state, moveGhoulTo(relic))).toEqual({
      code: 'notALocation',
      cardId: relic,
    });
  });
});

describe('MoveEnemyTowards', () => {
  const moveGhoulTowards = (towards: InstanceId) =>
    ({ type: 'MoveEnemyTowards', enemyId: ghoul, towards }) as const;

  it('moves an enemy in the attic one location towards the hall, into the cellar', () => {
    const { context, state } = hallCellarAttic
      .withCard(ghoul, ghoulCard, atLocation(attic))
      .start();

    const after = stateAfter(context, state, moveGhoulTowards(hall));

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
  });

  it('engages alice when the enemy arrives at her location', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(cellar)).start();

    const after = stateAfter(context, state, moveGhoulTowards(hall));

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it('moves an exhausted enemy too', () => {
    const { context, state } = hallCellarAttic
      .withCard(ghoul, ghoulCard, atLocation(attic))
      .start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const after = stateAfter(context, exhausted, moveGhoulTowards(hall));

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
  });

  it.each([
    { name: 'it is already there', towards: cellar },
    { name: 'there is no path there', towards: instanceId('shed') },
    { name: 'the target is set aside, not in play', towards: instanceId('set_aside_parlor') },
  ])('leaves the enemy in the cellar when $name', ({ towards }) => {
    const { context, state } = hallCellarAttic
      .withLocation(instanceId('shed'), blankLocation('shed'))
      .withCard(instanceId('set_aside_parlor'), blankLocation('parlor'), setAside)
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .start();

    const after = stateAfter(context, state, moveGhoulTowards(towards));

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
  });

  it('lets the lead investigator pick between two equally short ways', () => {
    const garden = instanceId('garden');
    const { context, state } = aliceInHall
      .withLocation(garden, blankLocation('garden'))
      .withConnection(hall, garden)
      .withConnection(garden, attic)
      .withCard(ghoul, aloofGhoulCard, atLocation(hall))
      .start();
    const asked = stateAfter(context, state, moveGhoulTowards(attic));

    const after = stateAfter(context, asked, answer(`towards:${ghoul}`, garden));

    expect(asked.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        subject: ghoul,
        prompt: 'decision.chooseEnemyDestination',
        options: [{ id: cellar }, { id: garden }],
      },
    ]);
    expect(zoneOf(after, ghoul)).toEqual(atLocation(garden));
  });

  it('rejects moving an engaged enemy, which moves only with its investigator', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    expect(rejectionFrom(context, state, moveGhoulTowards(attic))).toEqual({
      code: 'enemyEngaged',
      cardId: ghoul,
      investigatorId: alice,
    });
  });

  it('disengages an enemy engaged with alice in the hall and moves it into the cellar when the move is forced', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const after = stateAfter(context, state, { ...moveGhoulTowards(attic), forced: true });

    expect(zoneOf(after, ghoul)).toEqual(atLocation(cellar));
  });
});

describe('damage and defeat', () => {
  it('puts damage on an enemy without defeating it below its health', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const after = stateAfter(context, state, { type: 'DamageEnemy', enemyId: ghoul, amount: 1 });

    expect(after.cards[ghoul]?.tokens).toEqual({ damage: 1 });
    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it('defeats an enemy whose damage reaches its health, scaled by the starting player count', () => {
    const { context, state } = hallCellarAttic
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: attic })
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .start();
    const threeOfFourDamage = stateAfter(context, state, {
      type: 'DamageEnemy',
      enemyId: ghoul,
      amount: 3,
    });

    const fourthDamage = execute(context, threeOfFourDamage, {
      type: 'DamageEnemy',
      enemyId: ghoul,
      amount: 1,
    });

    expect(zoneOf(threeOfFourDamage, ghoul)).toEqual(engagedWith(alice));
    expect(fourthDamage.events.map((e) => e.type)).toEqual(['TokensChanged', 'EnemyDefeated']);
    expect(zoneOf(fourthDamage.state, ghoul)).toEqual(encounterDiscard);
    expect(fourthDamage.state.cards[ghoul]?.tokens).toEqual({});
  });

  it('sends a defeated enemy with victory to the victory display', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, victoryGhoulCard, engagedWith(alice))
      .start();

    const after = stateAfter(context, state, { type: 'DefeatEnemy', enemyId: ghoul });

    expect(zoneOf(after, ghoul)).toEqual({ kind: 'victoryDisplay' });
    expect(checkInvariants(after)).toEqual([]);
  });

  it('puts a defeated enemy on top of the encounter discard and readies it', () => {
    const old = instanceId('old_discard');
    const { context, state } = aliceInHall
      .withCard(old, relicCard, encounterDiscard)
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const after = stateAfter(context, exhausted, { type: 'DefeatEnemy', enemyId: ghoul });

    expect(after.order[zoneKey(encounterDiscard)]).toEqual([ghoul, old]);
    expect(after.cards[ghoul]?.exhausted).toBe(false);
  });

  it('drops an open engagement question when the enemy leaves play', () => {
    const { context, state } = aliceAndBobAt(hall, { alice: 0, bob: 0 })
      .withCard(ghoul, ghoulCard, setAside)
      .start();
    const asked = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

    const after = apply(asked, {
      type: 'EnemyDefeated',
      enemyId: ghoul,
      to: { kind: 'encounterDiscard' },
      locationId: hall,
    });

    expect(asked.pending).toHaveLength(1);
    expect(after.pending).toEqual([]);
  });

  it.each([
    {
      name: 'damage that is not a positive integer',
      zone: engagedWith(alice),
      amount: 0,
      rejection: { code: 'invalidTokenDelta', delta: 0 },
    },
    {
      name: 'damage on an enemy that is not in play',
      zone: setAside,
      amount: 1,
      rejection: { code: 'enemyNotInPlay', cardId: ghoul },
    },
  ])('rejects $name', ({ zone, amount, rejection }) => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, zone).start();

    expect(rejectionFrom(context, state, { type: 'DamageEnemy', enemyId: ghoul, amount })).toEqual(
      rejection,
    );
  });
});

describe('healing', () => {
  it.each([
    { damage: 2, heal: 1, left: { damage: 1 } },
    { damage: 1, heal: 2, left: {} },
  ])('heals $heal of $damage damage from an enemy', ({ damage, heal, left }) => {
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, engagedWith(alice), { tokens: { damage } })
      .start();

    const after = stateAfter(context, state, { type: 'HealEnemy', enemyId: ghoul, amount: heal });

    expect(after.cards[ghoul]?.tokens).toEqual(left);
  });

  it('heals nothing from an undamaged enemy', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const { events } = execute(context, state, { type: 'HealEnemy', enemyId: ghoul, amount: 1 });

    expect(events).toEqual([]);
  });

  it.each([
    {
      name: 'healing that is not a positive integer',
      zone: engagedWith(alice),
      amount: 0,
      rejection: { code: 'invalidTokenDelta', delta: 0 },
    },
    {
      name: 'healing an enemy that is not in play',
      zone: setAside,
      amount: 1,
      rejection: { code: 'enemyNotInPlay', cardId: ghoul },
    },
  ])('rejects $name', ({ zone, amount, rejection }) => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, zone).start();

    expect(rejectionFrom(context, state, { type: 'HealEnemy', enemyId: ghoul, amount })).toEqual(
      rejection,
    );
  });
});

describe('exhaust and ready', () => {
  it('exhausts and readies an enemy', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });
    const readied = stateAfter(context, exhausted, { type: 'ReadyEnemy', enemyId: ghoul });

    expect(exhausted.cards[ghoul]?.exhausted).toBe(true);
    expect(readied.cards[ghoul]?.exhausted).toBe(false);
  });

  it('readies nothing on a ready enemy', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();

    const { events } = execute(context, state, { type: 'ReadyEnemy', enemyId: ghoul });

    expect(events).toEqual([]);
  });

  it('exhausts nothing on an exhausted enemy', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, engagedWith(alice)).start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const { events } = execute(context, exhausted, { type: 'ExhaustEnemy', enemyId: ghoul });

    expect(events).toEqual([]);
  });

  it('engages when a readied unengaged enemy shares a location with an investigator', () => {
    const { context, state } = aliceInHall.withCard(ghoul, ghoulCard, atLocation(attic)).start();
    const exhausted = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: ghoul });
    const aliceInAttic = stateAfter(context, exhausted, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    const readied = stateAfter(context, aliceInAttic, { type: 'ReadyEnemy', enemyId: ghoul });

    expect(zoneOf(aliceInAttic, ghoul)).toEqual(atLocation(attic));
    expect(zoneOf(readied, ghoul)).toEqual(engagedWith(alice));
  });
});

describe('enemyAttackList', () => {
  const forAlice = instanceId('ghoul_for_alice');
  const forBob = instanceId('ghoul_for_bob');
  const tired = instanceId('tired_ghoul');

  it('lists ready engaged enemies per investigator in seat order, with their damage and horror', () => {
    const { context, state } = hallCellarAttic
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: cellar })
      .withCard(forBob, ghoulCard, engagedWith(bob))
      .withCard(forAlice, ghoulCard, engagedWith(alice))
      .withCard(tired, ghoulCard, engagedWith(alice))
      .start();
    const withTired = stateAfter(context, state, { type: 'ExhaustEnemy', enemyId: tired });

    expect(enemyAttackList(context, withTired)).toEqual([
      { enemyId: forAlice, investigatorId: alice, damage: 1, horror: 2 },
      { enemyId: forBob, investigatorId: bob, damage: 1, horror: 2 },
    ]);
  });

  it('starts with the lead investigator, then follows the seats clockwise', () => {
    const carol = investigatorId('carol');
    const forCarol = instanceId('ghoul_for_carol');
    const { context, state } = hallCellarAttic
      .withInvestigator(bob, { seat: 1, locationId: hall })
      .withInvestigator(alice, { seat: 0, locationId: cellar })
      .withInvestigator(carol, { seat: 2, locationId: attic })
      .withCard(forAlice, ghoulCard, engagedWith(alice))
      .withCard(forBob, ghoulCard, engagedWith(bob))
      .withCard(forCarol, ghoulCard, engagedWith(carol))
      .start();

    expect(state.meta.leadInvestigator).toBe(bob);
    expect(enemyAttackList(context, state).map((attack) => attack.investigatorId)).toEqual([
      bob,
      carol,
      alice,
    ]);
  });

  it('includes a ready massive enemy for every investigator at its location', () => {
    const massive = instanceId('massive_ghoul');
    const { context, state } = aliceAndBobAt(hall, { alice: 0, bob: 0 })
      .withCard(massive, massiveGhoulCard, atLocation(hall))
      .withCard(instanceId('aloof_ghoul'), aloofGhoulCard, atLocation(hall))
      .start();

    expect(enemyAttackList(context, state)).toEqual([
      { enemyId: massive, investigatorId: alice, damage: 2, horror: 0 },
      { enemyId: massive, investigatorId: bob, damage: 2, horror: 0 },
    ]);
  });

  it('ignores defeated investigators and unengaged enemies', () => {
    const { context, state } = hallCellarAttic
      .withInvestigator(alice, { locationId: hall, status: 'defeated' })
      .withCard(ghoul, ghoulCard, engagedWith(alice))
      .withCard(instanceId('far'), ghoulCard, atLocation(attic))
      .start();

    expect(enemyAttackList(context, state)).toEqual([]);
  });
});

describe('SpawnEnemy with "Spawn - Any empty location"', () => {
  const emptySpawnAcolyteCard = blankEnemy('empty_spawn_acolyte', {
    keywords: [{ name: 'spawn', detail: 'Any empty location' }],
  });
  const acolyte = instanceId('acolyte');

  it('spawns at the only location without investigators and enemies', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(acolyte, emptySpawnAcolyteCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: acolyte,
      investigatorId: alice,
    });

    expect(zoneOf(after, acolyte)).toEqual(atLocation(attic));
  });

  it('counts a location with only a story asset as empty', () => {
    const relic = instanceId('relic');
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(relic, relicCard, atLocation(attic))
      .withCard(acolyte, emptySpawnAcolyteCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: acolyte,
      investigatorId: alice,
    });

    expect(zoneOf(after, acolyte)).toEqual(atLocation(attic));
  });

  it('asks the players when several locations are empty', () => {
    const { context, state } = aliceInHall
      .withCard(acolyte, emptySpawnAcolyteCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: acolyte,
      investigatorId: alice,
    });

    expect(zoneOf(after, acolyte)).toEqual(setAside);
    expect(after.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        subject: acolyte,
        options: [{ target: cellar }, { target: attic }],
      },
    ]);
  });

  it.each([
    {
      spawnedBy: 'bob drawing it',
      investigatorId: bob,
      decider: { kind: 'investigator', investigatorId: bob },
    },
    { spawnedBy: 'a card effect', investigatorId: undefined, decider: { kind: 'lead' } },
  ])('leaves the pick to $decider.kind after $spawnedBy', ({ investigatorId, decider }) => {
    const { context, state } = hallCellarAttic
      .withInvestigator(alice, { locationId: hall })
      .withInvestigator(bob, { locationId: hall })
      .withCard(acolyte, emptySpawnAcolyteCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: acolyte,
      ...(investigatorId === undefined ? {} : { investigatorId }),
    });

    expect(state.meta.leadInvestigator).toBe(alice);
    expect(after.pending).toMatchObject([{ kind: 'chooseLocation', decider }]);
  });

  it('discards the enemy when no location is empty', () => {
    const { context, state } = aliceInHall
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(instanceId('second_ghoul'), ghoulCard, atLocation(attic))
      .withCard(acolyte, emptySpawnAcolyteCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: acolyte,
      investigatorId: alice,
    });

    expect(zoneOf(after, acolyte)).toEqual(encounterDiscard);
    expect(after.pending).toEqual([]);
  });
});

describe('SpawnEnemy with "Spawn - Engaged with prey" and prey "Most clues"', () => {
  const preySpawnHunterCard = blankEnemy('prey_spawn_hunter', {
    keywords: [
      { name: 'spawn', detail: 'Engaged with prey' },
      { name: 'prey', detail: 'Most clues' },
    ],
  });
  const hunter = instanceId('hunter');

  /** Alice in the hall and bob in the attic, with the given clues. */
  function aliceInHallBobInAttic(clues: { alice: number; bob: number }): GameBuilder {
    return hallCellarAttic
      .withInvestigator(alice, { locationId: hall, clues: clues.alice })
      .withInvestigator(bob, { locationId: attic, clues: clues.bob });
  }

  it('spawns engaged with the investigator its prey picks, wherever they are, not the drawer', () => {
    const { context, state } = aliceInHallBobInAttic({ alice: 1, bob: 3 })
      .withCard(hunter, preySpawnHunterCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: hunter,
      investigatorId: alice,
    });

    expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
    expect(checkInvariants(after)).toEqual([]);
  });

  it('asks the lead investigator on a tie, and the answer spawns it engaged with the chosen one', () => {
    const { context, state } = aliceInHallBobInAttic({ alice: 2, bob: 2 })
      .withCard(hunter, preySpawnHunterCard, setAside)
      .start();
    const asked = stateAfter(context, state, {
      type: 'SpawnEnemy',
      enemyId: hunter,
      investigatorId: alice,
    });

    const after = stateAfter(context, asked, answer('spawn:hunter', bob));

    expect(asked.pending).toMatchObject([
      {
        kind: 'chooseInvestigator',
        subject: hunter,
        decider: { kind: 'lead' },
        options: [{ target: alice }, { target: bob }],
      },
    ]);
    expect(zoneOf(asked, hunter)).toEqual(setAside);
    expect(zoneOf(after, hunter)).toEqual(engagedWith(bob));
  });
});

describe('SpawnEnemy with a filtered spawn instruction', () => {
  const library = instanceId('library');
  const den = instanceId('den');
  const spawner = instanceId('spawner');
  /** An enemy whose spawn instruction is `detail`. */
  const spawnerCard = (detail: string) =>
    blankEnemy('spawner', { keywords: [{ name: 'spawn', detail }] });
  /**
   * Alice draws in the hall; hall - cellar - attic in a line. The cellar has 1 clue, the attic
   * is a Woods location with 2; the library is set aside.
   */
  const hallToWoodsAttic = newGame()
    .withLocation(hall, hallCard)
    .withLocation(cellar, cellarCard, { clues: 1 })
    .withLocation(attic, blankLocation('attic', { traits: [trait('Woods')] }), { clues: 2 })
    .withConnection(hall, cellar)
    .withConnection(cellar, attic)
    .withCard(library, blankLocation('library'), setAside)
    .withInvestigator(alice, { locationId: hall });
  const aliceSpawns = { type: 'SpawnEnemy', enemyId: spawner, investigatorId: alice } as const;

  it.each([
    { spawn: 'Farthest empty location', spawnsIn: attic },
    { spawn: 'Nearest empty location', spawnsIn: cellar },
    { spawn: 'Location farthest from you', spawnsIn: attic },
    { spawn: 'Any location connected to yours', spawnsIn: cellar },
    { spawn: 'Location with the most clues', spawnsIn: attic },
    { spawn: 'Any Woods location', spawnsIn: attic },
    { spawn: 'Attic or Cellar (whichever is nearest to you)', spawnsIn: cellar },
    { spawn: 'Attic or Library (whichever is nearest to you)', spawnsIn: attic },
    { spawn: 'Cellar. Otherwise, Attic', spawnsIn: cellar },
    { spawn: 'Library. Otherwise, Attic', spawnsIn: attic },
  ])('spawns "$spawn" in the $spawnsIn', ({ spawn, spawnsIn }) => {
    const { context, state } = hallToWoodsAttic
      .withCard(spawner, spawnerCard(spawn), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(zoneOf(after, spawner)).toEqual(atLocation(spawnsIn));
  });

  it('spawns "Location nearest to you" in your location, engaged with you', () => {
    const { context, state } = hallToWoodsAttic
      .withCard(spawner, spawnerCard('Location nearest to you'), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(zoneOf(after, spawner)).toEqual(engagedWith(alice));
  });

  it('counts a location with no path there as the farthest', () => {
    const { context, state } = hallToWoodsAttic
      .withLocation(den, blankLocation('den'))
      .withCard(spawner, spawnerCard('Location farthest from you'), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(zoneOf(after, spawner)).toEqual(atLocation(den));
  });

  it('asks between the locations tied for the most clues', () => {
    const { context, state } = hallToWoodsAttic
      .withLocation(den, blankLocation('den'), { clues: 2 })
      .withCard(spawner, spawnerCard('Location with the most clues'), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(after.pending).toMatchObject([
      { kind: 'chooseLocation', options: [{ target: attic }, { target: den }] },
    ]);
  });

  it('spawns "Any location (empty, if able)" in the only empty location', () => {
    const { context, state } = hallToWoodsAttic
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(spawner, spawnerCard('Any location (empty, if able)'), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(zoneOf(after, spawner)).toEqual(atLocation(attic));
  });

  it('asks among every location for "Any location (empty, if able)" when none is empty', () => {
    const { context, state } = hallToWoodsAttic
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(instanceId('second_ghoul'), ghoulCard, atLocation(attic))
      .withCard(spawner, spawnerCard('Any location (empty, if able)'), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(after.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        options: [{ target: hall }, { target: cellar }, { target: attic }],
      },
    ]);
  });

  it('discards a "Farthest empty location" enemy when no location is empty', () => {
    const { context, state } = hallToWoodsAttic
      .withCard(ghoul, ghoulCard, atLocation(cellar))
      .withCard(instanceId('second_ghoul'), ghoulCard, atLocation(attic))
      .withCard(spawner, spawnerCard('Farthest empty location'), setAside)
      .start();

    const after = stateAfter(context, state, aliceSpawns);

    expect(zoneOf(after, spawner)).toEqual(encounterDiscard);
  });

  it('lets the players choose among the empty locations when nobody spawns a "Farthest" enemy', () => {
    const { context, state } = hallToWoodsAttic
      .withCard(spawner, spawnerCard('Farthest empty location'), setAside)
      .start();

    const after = stateAfter(context, state, { type: 'SpawnEnemy', enemyId: spawner });

    expect(after.pending).toMatchObject([
      { kind: 'chooseLocation', options: [{ target: cellar }, { target: attic }] },
    ]);
  });
});
