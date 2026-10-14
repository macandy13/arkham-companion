import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  cardDbFrom,
  checkInvariants,
  emptyState,
  enemyAttackList,
  execute,
  instanceId,
  investigatorId,
  mapId,
  zoneKey,
  type CardStats,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type Investigator,
  type Rejection,
  type StartingCard,
  type Zone,
} from './index';

const main = mapId('main');
const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');

const defs: CardStats[] = [
  { code: 'HAL', name: 'Fake Hall', typeCode: 'location', traits: [] },
  { code: 'CEL', name: 'Fake Cellar', typeCode: 'location', traits: [] },
  { code: 'ATT', name: 'Fake Attic', typeCode: 'location', traits: [] },
  {
    code: 'FOE',
    name: 'Fake Foe',
    typeCode: 'enemy',
    traits: [],
    health: { fixed: 0, perInvestigator: 2 },
    damage: 1,
    horror: 2,
  },
  { code: 'VIC', name: 'Fake Trophy', typeCode: 'enemy', traits: [], victory: 1 },
  { code: 'ALO', name: 'Fake Aloof', typeCode: 'enemy', traits: [], keywords: [{ name: 'aloof' }] },
  {
    code: 'MAS',
    name: 'Fake Massive',
    typeCode: 'enemy',
    traits: [],
    damage: 2,
    keywords: [{ name: 'massive' }],
  },
  {
    code: 'PRY',
    name: 'Fake Predator',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'prey', detail: 'Most clues.' }],
  },
  {
    code: 'SPW',
    name: 'Fake Spawner',
    typeCode: 'enemy',
    traits: [],
    keywords: [{ name: 'spawn', detail: 'Fake Cellar' }],
  },
  { code: 'REL', name: 'Fake Relic', typeCode: 'asset', traits: [] },
];
const ctx: EngineContext = { cards: cardDbFrom(defs) };

function investigator(id: typeof alice, seat: number, extra: Partial<Investigator>): Investigator {
  return {
    id,
    code: 'inv',
    name: id,
    seat,
    health: { max: 8, damage: 0 },
    sanity: { max: 8, horror: 0 },
    clues: 0,
    resources: 0,
    doomOnPlayerCards: 0,
    status: 'active',
    ...extra,
  };
}

interface World {
  /** Default: alice at the hall. */
  investigators?: Investigator[];
  /** Cards besides the three locations. */
  cards?: StartingCard[];
}

/** Hall - cellar - attic in a line, plus the cards of `world`. */
function started(world: World): GameState {
  return execute(ctx, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'enemies',
    difficulty: 'standard',
    seed: 1,
    shuffleEncounterDeck: false,
    investigators: world.investigators ?? [investigator(alice, 1, { locationId: hall })],
    maps: { [main]: { name: 'Main' } },
    cards: [
      { id: hall, code: 'HAL', zone: { kind: 'location', mapId: main }, faceUp: true },
      { id: cellar, code: 'CEL', zone: { kind: 'location', mapId: main }, faceUp: true },
      { id: attic, code: 'ATT', zone: { kind: 'location', mapId: main }, faceUp: true },
      ...(world.cards ?? []),
    ],
    connections: [
      { from: hall, to: cellar, oneWay: false },
      { from: cellar, to: attic, oneWay: false },
    ],
  }).state;
}

const card = (id: string, code: string, zone: Zone): StartingCard => ({
  id: instanceId(id),
  code,
  zone,
  faceUp: true,
});
const at = (locationId: InstanceId): Zone => ({ kind: 'atLocation', locationId });
const engagedWith = (id: typeof alice): Zone => ({ kind: 'engaged', investigatorId: id });
const setAside: Zone = { kind: 'setAside' };

function zoneOf(state: GameState, id: string): Zone | undefined {
  return state.cards[instanceId(id)]?.zone;
}

function rejectionOf(state: GameState, command: Command): Rejection {
  try {
    execute(ctx, state, command);
  } catch (error) {
    if (error instanceof CommandRejected) return error.rejection;
    throw error;
  }
  throw new Error('command was not rejected');
}

const spawn = (enemyId: string, target: { at?: InstanceId; by?: typeof alice } = {}): Command => ({
  type: 'SpawnEnemy',
  enemyId: instanceId(enemyId),
  ...(target.at ? { at: target.at } : {}),
  ...(target.by ? { investigatorId: target.by } : {}),
});

const enemyCommand = (type: 'ExhaustEnemy' | 'ReadyEnemy' | 'DefeatEnemy' | 'DisengageEnemy') =>
  ({ type, enemyId: instanceId('e') }) as Command;

describe('SpawnEnemy', () => {
  it('spawns at the drawing investigator`s location and engages them', () => {
    const state = started({ cards: [card('e', 'FOE', setAside)] });

    const { state: after, events } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
    expect(events.map((e) => e.type)).toEqual(['CardMoved', 'EnemyEngaged']);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('spawns unengaged when nobody is at the spawn location', () => {
    const state = started({ cards: [card('e', 'FOE', setAside)] });

    const { state: after } = execute(ctx, state, spawn('e', { at: attic }));

    expect(zoneOf(after, 'e')).toEqual(at(attic));
  });

  it('spawns at the location named by the spawn keyword', () => {
    const state = started({ cards: [card('e', 'SPW', setAside)] });

    const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(at(cellar));
  });

  it('falls back to the drawer when the spawn keyword matches several locations', () => {
    const state = started({
      cards: [
        card('e', 'SPW', setAside),
        card('cellar2', 'CEL', { kind: 'location', mapId: main }),
      ],
    });

    const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
  });

  it('lets an explicit location override the spawn keyword', () => {
    const state = started({ cards: [card('e', 'SPW', setAside)] });

    const { state: after } = execute(ctx, state, spawn('e', { at: attic }));

    expect(zoneOf(after, 'e')).toEqual(at(attic));
  });

  it('does not engage an aloof enemy', () => {
    const state = started({ cards: [card('e', 'ALO', setAside)] });

    const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(at(hall));
  });

  it('keeps a massive enemy at the location, where it counts as engaged with everyone', () => {
    const state = started({ cards: [card('e', 'MAS', setAside)] });

    const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(at(hall));
  });

  describe('with two investigators at the location', () => {
    const clues = (aliceClues: number, bobClues: number) => [
      investigator(alice, 1, { locationId: hall, clues: aliceClues }),
      investigator(bob, 2, { locationId: hall, clues: bobClues }),
    ];

    it('engages the investigator its prey picks', () => {
      const state = started({ investigators: clues(1, 3), cards: [card('e', 'PRY', setAside)] });

      const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

      expect(zoneOf(after, 'e')).toEqual(engagedWith(bob));
    });

    it('asks the players when there is no prey', () => {
      const state = started({ investigators: clues(1, 3), cards: [card('e', 'FOE', setAside)] });

      const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

      expect(zoneOf(after, 'e')).toEqual(at(hall));
      expect(after.pending).toMatchObject([
        {
          kind: 'chooseInvestigator',
          subject: 'e',
          options: [{ target: alice }, { target: bob }],
        },
      ]);
    });

    it('asks the players when prey is tied, and engaging answers the question', () => {
      const state = started({ investigators: clues(2, 2), cards: [card('e', 'PRY', setAside)] });
      const asked = execute(ctx, state, spawn('e', { by: alice })).state;

      const { state: after } = execute(ctx, asked, {
        type: 'EngageEnemy',
        enemyId: instanceId('e'),
        investigatorId: bob,
      });

      expect(asked.pending).toHaveLength(1);
      expect(after.pending).toEqual([]);
      expect(zoneOf(after, 'e')).toEqual(engagedWith(bob));
    });
  });

  it('rejects an enemy that is already in play', () => {
    const state = started({ cards: [card('e', 'FOE', at(hall))] });

    expect(rejectionOf(state, spawn('e', { at: hall }))).toEqual({
      code: 'enemyAlreadyInPlay',
      cardId: 'e',
    });
  });

  it('rejects a card that is not an enemy', () => {
    const state = started({ cards: [card('r', 'REL', setAside)] });

    expect(rejectionOf(state, spawn('r', { at: hall }))).toEqual({
      code: 'notAnEnemy',
      cardId: 'r',
    });
  });

  it('rejects a spawn without any location', () => {
    const state = started({ cards: [card('e', 'FOE', setAside)] });

    expect(rejectionOf(state, spawn('e'))).toEqual({ code: 'noSpawnLocation', cardId: 'e' });
  });

  it('rejects an explicit location that is not on a map', () => {
    const state = started({ cards: [card('e', 'FOE', setAside), card('x', 'REL', setAside)] });

    expect(rejectionOf(state, spawn('e', { at: instanceId('x') }))).toEqual({
      code: 'notALocation',
      cardId: 'x',
    });
  });
});

describe('setup', () => {
  it('engages an enemy that starts at the investigators` location', () => {
    const state = started({ cards: [card('e', 'FOE', at(hall))] });

    expect(zoneOf(state, 'e')).toEqual(engagedWith(alice));
  });

  it('leaves an enemy elsewhere unengaged', () => {
    const state = started({ cards: [card('e', 'FOE', at(attic))] });

    expect(zoneOf(state, 'e')).toEqual(at(attic));
  });
});

describe('engagement commands', () => {
  it('engages an enemy at the investigator`s location', () => {
    const state = started({ cards: [card('e', 'ALO', at(hall))] });

    const { state: after } = execute(ctx, state, {
      type: 'EngageEnemy',
      enemyId: instanceId('e'),
      investigatorId: alice,
    });

    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
  });

  it('rejects engaging an enemy at another location', () => {
    const state = started({ cards: [card('e', 'FOE', at(attic))] });

    expect(
      rejectionOf(state, { type: 'EngageEnemy', enemyId: instanceId('e'), investigatorId: alice }),
    ).toEqual({ code: 'investigatorNotAtLocation', investigatorId: alice, locationId: attic });
  });

  it('rejects engaging the investigator it is already engaged with', () => {
    const state = started({ cards: [card('e', 'FOE', engagedWith(alice))] });

    expect(
      rejectionOf(state, { type: 'EngageEnemy', enemyId: instanceId('e'), investigatorId: alice }),
    ).toEqual({ code: 'alreadyEngaged', cardId: 'e', investigatorId: alice });
  });

  it('disengages an enemy, leaving it at the investigator`s location', () => {
    const state = started({ cards: [card('e', 'FOE', engagedWith(alice))] });

    const { state: after } = execute(ctx, state, enemyCommand('DisengageEnemy'));

    expect(zoneOf(after, 'e')).toEqual(at(hall));
  });

  it('rejects disengaging an unengaged enemy', () => {
    const state = started({ cards: [card('e', 'ALO', at(hall))] });

    expect(rejectionOf(state, enemyCommand('DisengageEnemy'))).toEqual({
      code: 'notEngaged',
      cardId: 'e',
    });
  });
});

describe('damage and defeat', () => {
  const damage = (amount: number): Command => ({
    type: 'DamageEnemy',
    enemyId: instanceId('e'),
    amount,
  });

  it('puts damage on an enemy without defeating it below its health', () => {
    const state = started({ cards: [card('e', 'FOE', engagedWith(alice))] });

    const { state: after } = execute(ctx, state, damage(1));

    expect(after.cards[instanceId('e')]?.tokens).toEqual({ damage: 1 });
    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
  });

  it('defeats an enemy whose damage reaches its health, scaled by the starting player count', () => {
    const state = started({
      investigators: [
        investigator(alice, 1, { locationId: hall }),
        investigator(bob, 2, { locationId: attic }),
      ],
      cards: [card('e', 'FOE', engagedWith(alice))],
    });

    const afterThree = execute(ctx, state, damage(3)).state;
    const afterFour = execute(ctx, afterThree, damage(1));

    expect(zoneOf(afterThree, 'e')).toEqual(engagedWith(alice));
    expect(afterFour.events.map((e) => e.type)).toEqual(['TokensChanged', 'EnemyDefeated']);
    expect(zoneOf(afterFour.state, 'e')).toEqual({ kind: 'encounterDiscard' });
    expect(afterFour.state.cards[instanceId('e')]?.tokens).toEqual({});
  });

  it('sends a defeated enemy with victory to the victory display', () => {
    const state = started({ cards: [card('e', 'VIC', engagedWith(alice))] });

    const { state: after } = execute(ctx, state, enemyCommand('DefeatEnemy'));

    expect(zoneOf(after, 'e')).toEqual({ kind: 'victoryDisplay' });
    expect(checkInvariants(after)).toEqual([]);
  });

  it('puts a defeated enemy on top of the encounter discard and readies it', () => {
    const state = started({
      cards: [
        card('old', 'REL', { kind: 'encounterDiscard' }),
        card('e', 'FOE', engagedWith(alice)),
      ],
    });
    const exhausted = execute(ctx, state, enemyCommand('ExhaustEnemy')).state;

    const { state: after } = execute(ctx, exhausted, enemyCommand('DefeatEnemy'));

    expect(after.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual(['e', 'old']);
    expect(after.cards[instanceId('e')]?.exhausted).toBe(false);
  });

  it('drops an open engagement question when the enemy is defeated', () => {
    const state = started({
      investigators: [
        investigator(alice, 1, { locationId: hall }),
        investigator(bob, 2, { locationId: hall }),
      ],
      cards: [card('e', 'FOE', setAside)],
    });
    const asked = execute(ctx, state, spawn('e', { by: alice })).state;

    const { state: after } = execute(ctx, asked, enemyCommand('DefeatEnemy'));

    expect(asked.pending).toHaveLength(1);
    expect(after.pending).toEqual([]);
  });

  it('rejects damage that is not a positive integer', () => {
    const state = started({ cards: [card('e', 'FOE', engagedWith(alice))] });

    expect(rejectionOf(state, damage(0))).toEqual({ code: 'invalidTokenDelta', delta: 0 });
  });

  it('rejects damage on an enemy that is not in play', () => {
    const state = started({ cards: [card('e', 'FOE', setAside)] });

    expect(rejectionOf(state, damage(1))).toEqual({ code: 'enemyNotInPlay', cardId: 'e' });
  });
});

describe('exhaust and ready', () => {
  it('exhausts and readies an enemy', () => {
    const state = started({ cards: [card('e', 'FOE', engagedWith(alice))] });

    const exhausted = execute(ctx, state, enemyCommand('ExhaustEnemy')).state;
    const readied = execute(ctx, exhausted, enemyCommand('ReadyEnemy')).state;

    expect(exhausted.cards[instanceId('e')]?.exhausted).toBe(true);
    expect(readied.cards[instanceId('e')]?.exhausted).toBe(false);
  });

  it('rejects readying a ready enemy', () => {
    const state = started({ cards: [card('e', 'FOE', engagedWith(alice))] });

    expect(rejectionOf(state, enemyCommand('ReadyEnemy'))).toEqual({
      code: 'exhaustUnchanged',
      cardId: 'e',
      exhausted: false,
    });
  });

  it('engages when a readied unengaged enemy shares a location with an investigator', () => {
    const state = started({ cards: [card('e', 'FOE', at(attic))] });
    const exhausted = execute(ctx, state, enemyCommand('ExhaustEnemy')).state;
    const arrived = execute(ctx, exhausted, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: attic,
      ignoreConnections: true,
    }).state;

    const { state: after } = execute(ctx, arrived, enemyCommand('ReadyEnemy'));

    expect(zoneOf(arrived, 'e')).toEqual(at(attic));
    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
  });
});

describe('enemyAttackList', () => {
  it('lists ready engaged enemies per investigator in seat order, with their damage and horror', () => {
    const state = started({
      investigators: [
        investigator(alice, 1, { locationId: hall }),
        investigator(bob, 2, { locationId: cellar }),
      ],
      cards: [
        card('forBob', 'FOE', engagedWith(bob)),
        card('forAlice', 'FOE', engagedWith(alice)),
        card('tired', 'FOE', engagedWith(alice)),
      ],
    });
    const tired = execute(ctx, state, {
      type: 'ExhaustEnemy',
      enemyId: instanceId('tired'),
    }).state;

    expect(enemyAttackList(ctx, tired)).toEqual([
      { enemyId: 'forAlice', investigatorId: alice, damage: 1, horror: 2 },
      { enemyId: 'forBob', investigatorId: bob, damage: 1, horror: 2 },
    ]);
  });

  it('includes a ready massive enemy for every investigator at its location', () => {
    const state = started({
      investigators: [
        investigator(alice, 1, { locationId: hall }),
        investigator(bob, 2, { locationId: hall }),
      ],
      cards: [card('big', 'MAS', at(hall)), card('loner', 'ALO', at(hall))],
    });

    expect(enemyAttackList(ctx, state)).toEqual([
      { enemyId: 'big', investigatorId: alice, damage: 2, horror: 0 },
      { enemyId: 'big', investigatorId: bob, damage: 2, horror: 0 },
    ]);
  });

  it('ignores defeated investigators and unengaged enemies', () => {
    const state = started({
      investigators: [investigator(alice, 1, { locationId: hall, status: 'defeated' })],
      cards: [card('e', 'FOE', engagedWith(alice)), card('far', 'FOE', at(attic))],
    });

    expect(enemyAttackList(ctx, state)).toEqual([]);
  });
});
