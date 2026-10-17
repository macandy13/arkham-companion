import { describe, expect, it } from 'vitest';
import {
  apply,
  cardCode,
  checkInvariants,
  decisionId,
  enemyAttackList,
  execute,
  instanceId,
  investigatorId,
  zoneKey,
  type GameState,
  type InstanceId,
  type Investigator,
  type StartingCard,
  type Zone,
} from './index';
import { engageEvents } from './engagement';
import { replay } from './reducer';
import {
  contextWith,
  edge,
  makeCard,
  makeInvestigator,
  perInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

/**
 * The cards of these tests. The three locations lie in a line (hall - cellar -
 * attic, see `startedWith`). Every enemy is a plain ghoul (2 health per
 * investigator, 1 damage, 2 horror) unless its code names a keyword.
 */
const ctx = contextWith(
  makeCard({ code: 'hall', name: 'Hall', typeCode: 'location' }),
  makeCard({ code: 'cellar', name: 'Cellar', typeCode: 'location' }),
  makeCard({ code: 'attic', name: 'Attic', typeCode: 'location' }),
  makeCard({
    code: 'ghoul',
    typeCode: 'enemy',
    health: perInvestigator(2),
    damage: 1,
    horror: 2,
  }),
  makeCard({ code: 'victory_ghoul', typeCode: 'enemy', victory: 1 }),
  makeCard({ code: 'aloof_ghoul', typeCode: 'enemy', keywords: [{ name: 'aloof' }] }),
  makeCard({
    code: 'massive_ghoul',
    typeCode: 'enemy',
    damage: 2,
    keywords: [{ name: 'massive' }],
  }),
  makeCard({
    code: 'most_clues_prey_ghoul',
    typeCode: 'enemy',
    keywords: [{ name: 'prey', detail: 'Most clues' }],
  }),
  makeCard({
    code: 'cellar_spawn_ghoul',
    typeCode: 'enemy',
    keywords: [{ name: 'spawn', detail: 'Cellar' }],
  }),
  makeCard({
    code: 'unreadable_spawn_ghoul',
    typeCode: 'enemy',
    keywords: [{ name: 'spawn', detail: 'the location with the most clues' }],
  }),
  makeCard({ code: 'relic', typeCode: 'asset' }),
);

const at = (locationId: InstanceId): Zone => ({ kind: 'atLocation', locationId });
const engagedWith = (investigatorId: Investigator['id']): Zone => ({
  kind: 'engaged',
  investigatorId,
});
const setAside: Zone = { kind: 'setAside' };
const encounterDiscard: Zone = { kind: 'encounterDiscard' };

/** A card to create: `id` is how the test refers to it, `code` says what it is. */
function placed(id: InstanceId, code: string, zone: Zone): StartingCard {
  return { id, code: cardCode(code), zone };
}

/**
 * A started scenario on the map hall - cellar - attic (plus the `extraLocations`
 * given as instance ID to code), with `cards` besides the locations. The
 * default investigator is alice in the hall.
 */
function startedWith(
  cards: StartingCard[],
  {
    investigators = [makeInvestigator({ id: 'alice', locationId: hall })],
    extraLocations = {},
  }: { investigators?: Investigator[]; extraLocations?: Record<string, string> } = {},
): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { hall: 'hall', cellar: 'cellar', attic: 'attic', ...extraLocations },
        connections: [edge('hall', 'cellar'), edge('cellar', 'attic')],
      },
    },
    investigators,
    cards,
  });
}

/** Alice (seat 0) and bob (seat 1), both at `where`, with the given clues. */
function aliceAndBobAt(where: InstanceId, clues: { alice: number; bob: number }): Investigator[] {
  return [
    makeInvestigator({ id: 'alice', seat: 0, locationId: where, clues: clues.alice }),
    makeInvestigator({ id: 'bob', seat: 1, locationId: where, clues: clues.bob }),
  ];
}

function zoneOf(state: GameState, cardId: InstanceId): Zone | undefined {
  return state.cards[cardId]?.zone;
}

describe('SpawnEnemy', () => {
  it.each([
    {
      name: 'engages the drawer at the drawer`s location',
      code: 'ghoul',
      target: { investigatorId: alice },
      zone: engagedWith(alice),
    },
    {
      name: 'stays unengaged when nobody is at the spawn location',
      code: 'ghoul',
      target: { at: attic },
      zone: at(attic),
    },
    {
      name: 'follows the spawn keyword',
      code: 'cellar_spawn_ghoul',
      target: { investigatorId: alice },
      zone: at(cellar),
    },
    {
      name: 'lets an explicit location override the spawn keyword',
      code: 'cellar_spawn_ghoul',
      target: { at: attic },
      zone: at(attic),
    },
    {
      name: 'does not engage an aloof enemy',
      code: 'aloof_ghoul',
      target: { investigatorId: alice },
      zone: at(hall),
    },
    {
      name: 'keeps a massive enemy at the location',
      code: 'massive_ghoul',
      target: { investigatorId: alice },
      zone: at(hall),
    },
  ])('$name', ({ code, target, zone }) => {
    const state = startedWith([placed(ghoul, code, setAside)]);

    const after = stateAfter(ctx, state, { type: 'SpawnEnemy', enemyId: ghoul, ...target });

    expect(zoneOf(after, ghoul)).toEqual(zone);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('produces a move and an engagement', () => {
    const state = startedWith([placed(ghoul, 'ghoul', setAside)]);

    const { events } = execute(ctx, state, {
      type: 'SpawnEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(events.map((e) => e.type)).toEqual(['CardMoved', 'EnemyEngaged']);
  });

  it('asks the players when the spawn keyword matches several locations', () => {
    const second = instanceId('second_cellar');
    const state = startedWith([placed(ghoul, 'cellar_spawn_ghoul', setAside)], {
      extraLocations: { second_cellar: 'cellar' },
    });

    const after = stateAfter(ctx, state, {
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
    const state = startedWith([placed(ghoul, 'unreadable_spawn_ghoul', setAside)]);

    const after = stateAfter(ctx, state, {
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
    const state = startedWith([placed(ghoul, 'cellar_spawn_ghoul', setAside)]);
    const withoutCellar = stateAfter(ctx, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: cellar, to: setAside },
    });

    const after = stateAfter(ctx, withoutCellar, {
      type: 'SpawnEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(zoneOf(after, ghoul)).toEqual(encounterDiscard);
    expect(after.pending).toEqual([]);
  });

  it('never engages an exhausted enemy', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(attic))]);
    const exhausted = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: ghoul });
    const arrivedInHall = replay(
      [{ type: 'CardMoved', cardId: ghoul, from: at(attic), to: at(hall) }],
      exhausted,
    );

    expect(engageEvents(ctx, arrivedInHall, ghoul)).toEqual([]);
    expect(engageEvents(ctx, arrivedInHall, ghoul, alice)).toEqual([]);
  });

  describe('with alice (1 clue) and bob (3 clues) at the hall', () => {
    const investigators = aliceAndBobAt(hall, { alice: 1, bob: 3 });

    it('engages the investigator its prey picks, when spawned by an effect', () => {
      const state = startedWith([placed(ghoul, 'most_clues_prey_ghoul', setAside)], {
        investigators,
      });

      const after = stateAfter(ctx, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(bob));
      expect(after.pending).toEqual([]);
    });

    it('engages the drawer whatever the prey, without a spawn instruction', () => {
      const state = startedWith([placed(ghoul, 'most_clues_prey_ghoul', setAside)], {
        investigators,
      });

      const after = stateAfter(ctx, state, {
        type: 'SpawnEnemy',
        enemyId: ghoul,
        investigatorId: alice,
      });

      expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
      expect(after.pending).toEqual([]);
    });

    it('asks the players when there is no prey and no drawer', () => {
      const state = startedWith([placed(ghoul, 'ghoul', setAside)], { investigators });

      const after = stateAfter(ctx, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

      expect(zoneOf(after, ghoul)).toEqual(at(hall));
      expect(after.pending).toMatchObject([
        {
          kind: 'chooseInvestigator',
          subject: ghoul,
          options: [{ target: alice }, { target: bob }],
        },
      ]);
    });
  });

  it('asks the players when prey is tied, and engaging answers the question', () => {
    const state = startedWith([placed(ghoul, 'most_clues_prey_ghoul', setAside)], {
      investigators: aliceAndBobAt(hall, { alice: 2, bob: 2 }),
    });
    const asked = stateAfter(ctx, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

    const after = stateAfter(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: decisionId('engage:ghoul'),
      optionId: bob,
    });

    expect(asked.pending).toHaveLength(1);
    expect(after.pending).toEqual([]);
    expect(zoneOf(after, ghoul)).toEqual(engagedWith(bob));
  });

  it.each([
    {
      name: 'an enemy that is already in play',
      card: placed(ghoul, 'ghoul', at(hall)),
      command: { type: 'SpawnEnemy', enemyId: ghoul, at: hall },
      rejection: { code: 'enemyAlreadyInPlay', cardId: ghoul },
    },
    {
      name: 'a card that is not an enemy',
      card: placed(ghoul, 'relic', setAside),
      command: { type: 'SpawnEnemy', enemyId: ghoul, at: hall },
      rejection: { code: 'notAnEnemy', cardId: ghoul },
    },
    {
      name: 'a spawn without any location',
      card: placed(ghoul, 'ghoul', setAside),
      command: { type: 'SpawnEnemy', enemyId: ghoul },
      rejection: { code: 'noSpawnLocation', cardId: ghoul },
    },
    {
      name: 'an explicit location that is not on a map',
      card: placed(ghoul, 'ghoul', setAside),
      command: { type: 'SpawnEnemy', enemyId: ghoul, at: instanceId('relic_card') },
      rejection: { code: 'notALocation', cardId: instanceId('relic_card') },
    },
  ] as const)('rejects $name', ({ card, command, rejection }) => {
    const state = startedWith([card, placed(instanceId('relic_card'), 'relic', setAside)]);

    expect(rejectionFrom(ctx, state, command)).toEqual(rejection);
  });
});

describe('setup', () => {
  it('engages an enemy that starts at the investigators` location', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(hall))]);

    expect(zoneOf(state, ghoul)).toEqual(engagedWith(alice));
  });

  it('leaves an enemy that starts elsewhere unengaged', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(attic))]);

    expect(zoneOf(state, ghoul)).toEqual(at(attic));
  });
});

describe('moving into an enemy`s location', () => {
  const aliceMovesToCellar = {
    type: 'MoveInvestigator',
    investigatorId: alice,
    to: cellar,
  } as const;

  it.each([
    { code: 'ghoul', name: 'engages a ready enemy', zone: engagedWith(alice) },
    { code: 'aloof_ghoul', name: 'leaves an aloof enemy unengaged', zone: at(cellar) },
    {
      code: 'massive_ghoul',
      name: 'leaves a massive enemy at the location, out of any threat area',
      zone: at(cellar),
    },
  ])('$name', ({ code, zone }) => {
    const state = startedWith([placed(ghoul, code, at(cellar))]);

    const after = stateAfter(ctx, state, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(zone);
  });

  it('leaves an exhausted enemy unengaged', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(cellar))]);
    const exhausted = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const after = stateAfter(ctx, exhausted, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(at(cellar));
  });

  it('engages every ready enemy there', () => {
    const secondGhoul = instanceId('second_ghoul');
    const state = startedWith([
      placed(ghoul, 'ghoul', at(cellar)),
      placed(secondGhoul, 'ghoul', at(cellar)),
    ]);

    const after = stateAfter(ctx, state, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
    expect(zoneOf(after, secondGhoul)).toEqual(engagedWith(alice));
  });

  it('engages after a move that ignores connections, which only card effects make', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(attic))]);

    const after = stateAfter(ctx, state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it('leaves the enemy unengaged after a move that avoids engagement, which only card effects make', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(cellar))]);

    const after = stateAfter(ctx, state, { ...aliceMovesToCellar, avoidEngagement: true });

    expect(zoneOf(after, ghoul)).toEqual(at(cellar));
    expect(after.investigators[0]?.locationId).toBe(cellar);
  });

  it('leaves an enemy at another location alone', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(attic))]);

    const after = stateAfter(ctx, state, aliceMovesToCellar);

    expect(zoneOf(after, ghoul)).toEqual(at(attic));
  });
});

describe('engagement commands', () => {
  it('engages an enemy at the investigator`s location', () => {
    const state = startedWith([placed(ghoul, 'aloof_ghoul', at(hall))]);

    const after = stateAfter(ctx, state, {
      type: 'EngageEnemy',
      enemyId: ghoul,
      investigatorId: alice,
    });

    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it.each([
    {
      name: 'an enemy at another location',
      zone: at(attic),
      rejection: { code: 'investigatorNotAtLocation', investigatorId: alice, locationId: attic },
    },
    {
      name: 'the investigator it is already engaged with',
      zone: engagedWith(alice),
      rejection: { code: 'alreadyEngaged', cardId: ghoul, investigatorId: alice },
    },
  ])('rejects engaging $name', ({ zone, rejection }) => {
    const state = startedWith([placed(ghoul, 'ghoul', zone)]);

    expect(
      rejectionFrom(ctx, state, { type: 'EngageEnemy', enemyId: ghoul, investigatorId: alice }),
    ).toEqual(rejection);
  });

  it('rejects engaging a massive enemy, which already counts as engaged with everyone at its location', () => {
    const state = startedWith([placed(ghoul, 'massive_ghoul', at(hall))]);

    expect(
      rejectionFrom(ctx, state, { type: 'EngageEnemy', enemyId: ghoul, investigatorId: alice }),
    ).toEqual({ code: 'massiveNotEngageable', cardId: ghoul });
  });

  it('disengages an enemy, leaving it at the investigator`s location', () => {
    const state = startedWith([placed(ghoul, 'ghoul', engagedWith(alice))]);

    const after = stateAfter(ctx, state, { type: 'DisengageEnemy', enemyId: ghoul });

    expect(zoneOf(after, ghoul)).toEqual(at(hall));
  });

  it('rejects disengaging an unengaged enemy', () => {
    const state = startedWith([placed(ghoul, 'aloof_ghoul', at(hall))]);

    expect(rejectionFrom(ctx, state, { type: 'DisengageEnemy', enemyId: ghoul })).toEqual({
      code: 'notEngaged',
      cardId: ghoul,
    });
  });
});

describe('damage and defeat', () => {
  it('puts damage on an enemy without defeating it below its health', () => {
    const state = startedWith([placed(ghoul, 'ghoul', engagedWith(alice))]);

    const after = stateAfter(ctx, state, { type: 'DamageEnemy', enemyId: ghoul, amount: 1 });

    expect(after.cards[ghoul]?.tokens).toEqual({ damage: 1 });
    expect(zoneOf(after, ghoul)).toEqual(engagedWith(alice));
  });

  it('defeats an enemy whose damage reaches its health, scaled by the starting player count', () => {
    const state = startedWith([placed(ghoul, 'ghoul', engagedWith(alice))], {
      investigators: [
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: attic }),
      ],
    });
    const threeOfFourDamage = stateAfter(ctx, state, {
      type: 'DamageEnemy',
      enemyId: ghoul,
      amount: 3,
    });

    const fourthDamage = execute(ctx, threeOfFourDamage, {
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
    const state = startedWith([placed(ghoul, 'victory_ghoul', engagedWith(alice))]);

    const after = stateAfter(ctx, state, { type: 'DefeatEnemy', enemyId: ghoul });

    expect(zoneOf(after, ghoul)).toEqual({ kind: 'victoryDisplay' });
    expect(checkInvariants(after)).toEqual([]);
  });

  it('puts a defeated enemy on top of the encounter discard and readies it', () => {
    const old = instanceId('old_discard');
    const state = startedWith([
      placed(old, 'relic', encounterDiscard),
      placed(ghoul, 'ghoul', engagedWith(alice)),
    ]);
    const exhausted = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: ghoul });

    const after = stateAfter(ctx, exhausted, { type: 'DefeatEnemy', enemyId: ghoul });

    expect(after.order[zoneKey(encounterDiscard)]).toEqual([ghoul, old]);
    expect(after.cards[ghoul]?.exhausted).toBe(false);
  });

  it('drops an open engagement question when the enemy leaves play', () => {
    const state = startedWith([placed(ghoul, 'ghoul', setAside)], {
      investigators: aliceAndBobAt(hall, { alice: 0, bob: 0 }),
    });
    const asked = stateAfter(ctx, state, { type: 'SpawnEnemy', enemyId: ghoul, at: hall });

    const after = apply(asked, {
      type: 'EnemyDefeated',
      enemyId: ghoul,
      to: { kind: 'encounterDiscard' },
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
    const state = startedWith([placed(ghoul, 'ghoul', zone)]);

    expect(rejectionFrom(ctx, state, { type: 'DamageEnemy', enemyId: ghoul, amount })).toEqual(
      rejection,
    );
  });
});

describe('exhaust and ready', () => {
  it('exhausts and readies an enemy', () => {
    const state = startedWith([placed(ghoul, 'ghoul', engagedWith(alice))]);

    const exhausted = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: ghoul });
    const readied = stateAfter(ctx, exhausted, { type: 'ReadyEnemy', enemyId: ghoul });

    expect(exhausted.cards[ghoul]?.exhausted).toBe(true);
    expect(readied.cards[ghoul]?.exhausted).toBe(false);
  });

  it('rejects readying a ready enemy', () => {
    const state = startedWith([placed(ghoul, 'ghoul', engagedWith(alice))]);

    expect(rejectionFrom(ctx, state, { type: 'ReadyEnemy', enemyId: ghoul })).toEqual({
      code: 'exhaustUnchanged',
      cardId: ghoul,
      exhausted: false,
    });
  });

  it('engages when a readied unengaged enemy shares a location with an investigator', () => {
    const state = startedWith([placed(ghoul, 'ghoul', at(attic))]);
    const exhausted = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: ghoul });
    const aliceInAttic = stateAfter(ctx, exhausted, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    });

    const readied = stateAfter(ctx, aliceInAttic, { type: 'ReadyEnemy', enemyId: ghoul });

    expect(zoneOf(aliceInAttic, ghoul)).toEqual(at(attic));
    expect(zoneOf(readied, ghoul)).toEqual(engagedWith(alice));
  });
});

describe('enemyAttackList', () => {
  const forAlice = instanceId('ghoul_for_alice');
  const forBob = instanceId('ghoul_for_bob');
  const tired = instanceId('tired_ghoul');

  it('lists ready engaged enemies per investigator in seat order, with their damage and horror', () => {
    const state = startedWith(
      [
        placed(forBob, 'ghoul', engagedWith(bob)),
        placed(forAlice, 'ghoul', engagedWith(alice)),
        placed(tired, 'ghoul', engagedWith(alice)),
      ],
      {
        investigators: [
          makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
          makeInvestigator({ id: 'bob', seat: 1, locationId: cellar }),
        ],
      },
    );
    const withTired = stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId: tired });

    expect(enemyAttackList(ctx, withTired)).toEqual([
      { enemyId: forAlice, investigatorId: alice, damage: 1, horror: 2 },
      { enemyId: forBob, investigatorId: bob, damage: 1, horror: 2 },
    ]);
  });

  it('starts with the lead investigator, then follows the seats clockwise', () => {
    const carol = investigatorId('carol');
    const forCarol = instanceId('ghoul_for_carol');
    const state = startedWith(
      [
        placed(forAlice, 'ghoul', engagedWith(alice)),
        placed(forBob, 'ghoul', engagedWith(bob)),
        placed(forCarol, 'ghoul', engagedWith(carol)),
      ],
      {
        investigators: [
          makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
          makeInvestigator({ id: 'alice', seat: 0, locationId: cellar }),
          makeInvestigator({ id: 'carol', seat: 2, locationId: attic }),
        ],
      },
    );

    expect(state.meta.leadInvestigator).toBe(bob);
    expect(enemyAttackList(ctx, state).map((attack) => attack.investigatorId)).toEqual([
      bob,
      carol,
      alice,
    ]);
  });

  it('includes a ready massive enemy for every investigator at its location', () => {
    const massive = instanceId('massive_ghoul');
    const state = startedWith(
      [
        placed(massive, 'massive_ghoul', at(hall)),
        placed(instanceId('aloof_ghoul'), 'aloof_ghoul', at(hall)),
      ],
      { investigators: aliceAndBobAt(hall, { alice: 0, bob: 0 }) },
    );

    expect(enemyAttackList(ctx, state)).toEqual([
      { enemyId: massive, investigatorId: alice, damage: 2, horror: 0 },
      { enemyId: massive, investigatorId: bob, damage: 2, horror: 0 },
    ]);
  });

  it('ignores defeated investigators and unengaged enemies', () => {
    const state = startedWith(
      [placed(ghoul, 'ghoul', engagedWith(alice)), placed(instanceId('far'), 'ghoul', at(attic))],
      {
        investigators: [makeInvestigator({ id: 'alice', locationId: hall, status: 'defeated' })],
      },
    );

    expect(enemyAttackList(ctx, state)).toEqual([]);
  });
});
