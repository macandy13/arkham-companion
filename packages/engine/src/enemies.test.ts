import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  enemyAttackList,
  execute,
  instanceId,
  investigatorId,
  zoneKey,
  type Command,
  type GameState,
  type InstanceId,
  type Investigator,
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
  rejectionOf,
  startBoard,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');

/** Hall - Cellar - Attic in a line; the enemies below differ only in the keyword a test needs. */
const ctx = contextWith(
  makeCard({ code: 'HAL', name: 'Hall', typeCode: 'location' }),
  makeCard({ code: 'CEL', name: 'Cellar', typeCode: 'location' }),
  makeCard({ code: 'ATT', name: 'Attic', typeCode: 'location' }),
  makeCard({
    code: 'FOE',
    typeCode: 'enemy',
    health: perInvestigator(2),
    damage: 1,
    horror: 2,
  }),
  makeCard({ code: 'VIC', typeCode: 'enemy', victory: 1 }),
  makeCard({ code: 'ALO', typeCode: 'enemy', keywords: [{ name: 'aloof' }] }),
  makeCard({ code: 'MAS', typeCode: 'enemy', damage: 2, keywords: [{ name: 'massive' }] }),
  makeCard({
    code: 'PRY',
    typeCode: 'enemy',
    keywords: [{ name: 'prey', detail: 'Most clues' }],
  }),
  makeCard({
    code: 'SPW',
    typeCode: 'enemy',
    keywords: [{ name: 'spawn', detail: 'Cellar' }],
  }),
  makeCard({
    code: 'ODD',
    typeCode: 'enemy',
    keywords: [{ name: 'spawn', detail: 'the location with the most clues' }],
  }),
  makeCard({ code: 'REL', typeCode: 'asset' }),
);

const at = (locationId: InstanceId): Zone => ({ kind: 'atLocation', locationId });
const engagedWith = (id: typeof alice): Zone => ({ kind: 'engaged', investigatorId: id });
const setAside: Zone = { kind: 'setAside' };
const discard: Zone = { kind: 'encounterDiscard' };

interface BoardWorld {
  /** Default: alice in the hall. */
  investigators?: Investigator[];
  /** Cards besides the three locations: instance ID to code and zone. */
  cards?: Record<string, { code: string; zone: Zone }>;
  /** Further locations on the map: instance ID to code. */
  locations?: Record<string, string>;
}

function started({
  investigators = [makeInvestigator({ id: 'alice', locationId: hall })],
  cards = {},
  locations = {},
}: BoardWorld = {}): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { hall: 'HAL', cellar: 'CEL', attic: 'ATT', ...locations },
        connections: [edge('hall', 'cellar'), edge('cellar', 'attic')],
      },
    },
    investigators,
    cards,
  });
}

/** Two investigators with the given clues, alice first, both at `where`. */
function pair(where: InstanceId, aliceClues: number, bobClues: number): Investigator[] {
  return [
    makeInvestigator({ id: 'alice', seat: 0, locationId: where, clues: aliceClues }),
    makeInvestigator({ id: 'bob', seat: 1, locationId: where, clues: bobClues }),
  ];
}

const zoneOf = (state: GameState, id: string): Zone | undefined =>
  state.cards[instanceId(id)]?.zone;
const enemyAt = (code: string, zone: Zone) => ({ e: { code, zone } });
const spawn = (enemyId: string, target: { at?: InstanceId; by?: typeof alice } = {}): Command => ({
  type: 'SpawnEnemy',
  enemyId: instanceId(enemyId),
  ...(target.at ? { at: target.at } : {}),
  ...(target.by ? { investigatorId: target.by } : {}),
});
const enemyCommand = (type: 'ExhaustEnemy' | 'ReadyEnemy' | 'DefeatEnemy' | 'DisengageEnemy') =>
  ({ type, enemyId: instanceId('e') }) as Command;
const attempt = (state: GameState, command: Command) =>
  rejectionOf(() => execute(ctx, state, command));

describe('SpawnEnemy', () => {
  it.each([
    {
      name: 'engages the drawer at the drawer`s location',
      code: 'FOE',
      target: { by: alice },
      zone: engagedWith(alice),
    },
    {
      name: 'stays unengaged when nobody is at the spawn location',
      code: 'FOE',
      target: { at: attic },
      zone: at(attic),
    },
    { name: 'follows the spawn keyword', code: 'SPW', target: { by: alice }, zone: at(cellar) },
    {
      name: 'lets an explicit location override the spawn keyword',
      code: 'SPW',
      target: { at: attic },
      zone: at(attic),
    },
    { name: 'does not engage an aloof enemy', code: 'ALO', target: { by: alice }, zone: at(hall) },
    {
      name: 'keeps a massive enemy at the location',
      code: 'MAS',
      target: { by: alice },
      zone: at(hall),
    },
  ])('$name', ({ code, target, zone }) => {
    const state = started({ cards: enemyAt(code, setAside) });

    const { state: after } = execute(ctx, state, spawn('e', target));

    expect(zoneOf(after, 'e')).toEqual(zone);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('produces a move and an engagement', () => {
    const state = started({ cards: enemyAt('FOE', setAside) });

    const { events } = execute(ctx, state, spawn('e', { by: alice }));

    expect(events.map((e) => e.type)).toEqual(['CardMoved', 'EnemyEngaged']);
  });

  it('asks the players when the spawn keyword matches several locations', () => {
    const state = started({ cards: enemyAt('SPW', setAside), locations: { cellar2: 'CEL' } });

    const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(setAside);
    expect(after.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        subject: 'e',
        options: [{ target: cellar }, { target: 'cellar2' }],
      },
    ]);
  });

  it('asks the players, among all locations in play, when the spawn text is unreadable', () => {
    const state = started({ cards: enemyAt('ODD', setAside) });

    const { state: after } = execute(ctx, state, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(setAside);
    expect(after.pending).toMatchObject([
      {
        kind: 'chooseLocation',
        options: [{ target: hall }, { target: cellar }, { target: attic }],
      },
    ]);
  });

  it('discards the enemy when the named location is not in play', () => {
    const state = started({ cards: enemyAt('SPW', setAside) });
    const withoutCellar = execute(ctx, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: cellar, to: setAside },
    }).state;

    const { state: after } = execute(ctx, withoutCellar, spawn('e', { by: alice }));

    expect(zoneOf(after, 'e')).toEqual(discard);
    expect(after.pending).toEqual([]);
  });

  it('never engages an exhausted enemy', () => {
    const state = started({ cards: enemyAt('FOE', at(attic)) });
    const exhausted = execute(ctx, state, enemyCommand('ExhaustEnemy')).state;
    const arrived = replay(
      [{ type: 'CardMoved', cardId: instanceId('e'), from: at(attic), to: at(hall) }],
      exhausted,
    );

    expect(engageEvents(ctx, arrived, instanceId('e'))).toEqual([]);
    expect(engageEvents(ctx, arrived, instanceId('e'), alice)).toEqual([]);
  });

  describe('with two investigators at the location', () => {
    it.each([
      {
        name: 'the investigator its prey picks, when spawned by an effect',
        clues: [1, 3],
        target: { at: hall },
        zone: engagedWith(bob),
      },
      {
        name: 'the drawer whatever the prey, without a spawn instruction',
        clues: [1, 3],
        target: { by: alice },
        zone: engagedWith(alice),
      },
    ])('engages $name', ({ clues, target, zone }) => {
      const [aliceClues = 0, bobClues = 0] = clues;
      const state = started({
        investigators: pair(hall, aliceClues, bobClues),
        cards: enemyAt('PRY', setAside),
      });

      const { state: after } = execute(ctx, state, spawn('e', target));

      expect(zoneOf(after, 'e')).toEqual(zone);
      expect(after.pending).toEqual([]);
    });

    it('asks the players when there is no prey and no drawer', () => {
      const state = started({ investigators: pair(hall, 1, 3), cards: enemyAt('FOE', setAside) });

      const { state: after } = execute(ctx, state, spawn('e', { at: hall }));

      expect(zoneOf(after, 'e')).toEqual(at(hall));
      expect(after.pending).toMatchObject([
        { kind: 'chooseInvestigator', subject: 'e', options: [{ target: alice }, { target: bob }] },
      ]);
    });

    it('asks the players when prey is tied, and engaging answers the question', () => {
      const state = started({ investigators: pair(hall, 2, 2), cards: enemyAt('PRY', setAside) });
      const asked = execute(ctx, state, spawn('e', { at: hall })).state;

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

  it.each([
    {
      name: 'an enemy that is already in play',
      code: 'FOE',
      zone: at(hall),
      rejection: { code: 'enemyAlreadyInPlay', cardId: 'e' },
      target: { at: hall },
    },
    {
      name: 'a card that is not an enemy',
      code: 'REL',
      zone: setAside,
      rejection: { code: 'notAnEnemy', cardId: 'e' },
      target: { at: hall },
    },
    {
      name: 'a spawn without any location',
      code: 'FOE',
      zone: setAside,
      rejection: { code: 'noSpawnLocation', cardId: 'e' },
      target: {},
    },
  ])('rejects $name', ({ code, zone, rejection, target }) => {
    const state = started({ cards: enemyAt(code, zone) });

    expect(attempt(state, spawn('e', target))).toEqual(rejection);
  });

  it('rejects an explicit location that is not on a map', () => {
    const state = started({
      cards: { ...enemyAt('FOE', setAside), x: { code: 'REL', zone: setAside } },
    });

    expect(attempt(state, spawn('e', { at: instanceId('x') }))).toEqual({
      code: 'notALocation',
      cardId: 'x',
    });
  });
});

describe('setup', () => {
  it.each([
    {
      name: 'engages an enemy that starts at the investigators` location',
      where: hall,
      zone: engagedWith(alice),
    },
    { name: 'leaves an enemy elsewhere unengaged', where: attic, zone: at(attic) },
  ])('$name', ({ where, zone }) => {
    const state = started({ cards: enemyAt('FOE', at(where)) });

    expect(zoneOf(state, 'e')).toEqual(zone);
  });
});

describe('engagement commands', () => {
  const engage = (investigatorId: typeof alice): Command => ({
    type: 'EngageEnemy',
    enemyId: instanceId('e'),
    investigatorId,
  });

  it('engages an enemy at the investigator`s location', () => {
    const state = started({ cards: enemyAt('ALO', at(hall)) });

    const { state: after } = execute(ctx, state, engage(alice));

    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
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
      rejection: { code: 'alreadyEngaged', cardId: 'e', investigatorId: alice },
    },
  ])('rejects engaging $name', ({ zone, rejection }) => {
    const state = started({ cards: enemyAt('FOE', zone) });

    expect(attempt(state, engage(alice))).toEqual(rejection);
  });

  it('disengages an enemy, leaving it at the investigator`s location', () => {
    const state = started({ cards: enemyAt('FOE', engagedWith(alice)) });

    const { state: after } = execute(ctx, state, enemyCommand('DisengageEnemy'));

    expect(zoneOf(after, 'e')).toEqual(at(hall));
  });

  it('rejects disengaging an unengaged enemy', () => {
    const state = started({ cards: enemyAt('ALO', at(hall)) });

    expect(attempt(state, enemyCommand('DisengageEnemy'))).toEqual({
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
    const state = started({ cards: enemyAt('FOE', engagedWith(alice)) });

    const { state: after } = execute(ctx, state, damage(1));

    expect(after.cards[instanceId('e')]?.tokens).toEqual({ damage: 1 });
    expect(zoneOf(after, 'e')).toEqual(engagedWith(alice));
  });

  it('defeats an enemy whose damage reaches its health, scaled by the starting player count', () => {
    const state = started({
      investigators: [
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: attic }),
      ],
      cards: enemyAt('FOE', engagedWith(alice)),
    });

    const afterThree = execute(ctx, state, damage(3)).state;
    const afterFour = execute(ctx, afterThree, damage(1));

    expect(zoneOf(afterThree, 'e')).toEqual(engagedWith(alice));
    expect(afterFour.events.map((e) => e.type)).toEqual(['TokensChanged', 'EnemyDefeated']);
    expect(zoneOf(afterFour.state, 'e')).toEqual(discard);
    expect(afterFour.state.cards[instanceId('e')]?.tokens).toEqual({});
  });

  it('sends a defeated enemy with victory to the victory display', () => {
    const state = started({ cards: enemyAt('VIC', engagedWith(alice)) });

    const { state: after } = execute(ctx, state, enemyCommand('DefeatEnemy'));

    expect(zoneOf(after, 'e')).toEqual({ kind: 'victoryDisplay' });
    expect(checkInvariants(after)).toEqual([]);
  });

  it('puts a defeated enemy on top of the encounter discard and readies it', () => {
    const state = started({
      cards: { old: { code: 'REL', zone: discard }, ...enemyAt('FOE', engagedWith(alice)) },
    });
    const exhausted = execute(ctx, state, enemyCommand('ExhaustEnemy')).state;

    const { state: after } = execute(ctx, exhausted, enemyCommand('DefeatEnemy'));

    expect(after.order[zoneKey(discard)]).toEqual(['e', 'old']);
    expect(after.cards[instanceId('e')]?.exhausted).toBe(false);
  });

  it('drops an open engagement question when the enemy is defeated', () => {
    const state = started({ investigators: pair(hall, 0, 0), cards: enemyAt('FOE', setAside) });
    const asked = execute(ctx, state, spawn('e', { at: hall })).state;

    const { state: after } = execute(ctx, asked, enemyCommand('DefeatEnemy'));

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
      rejection: { code: 'enemyNotInPlay', cardId: 'e' },
    },
  ])('rejects $name', ({ zone, amount, rejection }) => {
    const state = started({ cards: enemyAt('FOE', zone) });

    expect(attempt(state, damage(amount))).toEqual(rejection);
  });
});

describe('exhaust and ready', () => {
  it('exhausts and readies an enemy', () => {
    const state = started({ cards: enemyAt('FOE', engagedWith(alice)) });

    const exhausted = execute(ctx, state, enemyCommand('ExhaustEnemy')).state;
    const readied = execute(ctx, exhausted, enemyCommand('ReadyEnemy')).state;

    expect(exhausted.cards[instanceId('e')]?.exhausted).toBe(true);
    expect(readied.cards[instanceId('e')]?.exhausted).toBe(false);
  });

  it('rejects readying a ready enemy', () => {
    const state = started({ cards: enemyAt('FOE', engagedWith(alice)) });

    expect(attempt(state, enemyCommand('ReadyEnemy'))).toEqual({
      code: 'exhaustUnchanged',
      cardId: 'e',
      exhausted: false,
    });
  });

  it('engages when a readied unengaged enemy shares a location with an investigator', () => {
    const state = started({ cards: enemyAt('FOE', at(attic)) });
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
        makeInvestigator({ id: 'alice', seat: 0, locationId: hall }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: cellar }),
      ],
      cards: {
        forBob: { code: 'FOE', zone: engagedWith(bob) },
        forAlice: { code: 'FOE', zone: engagedWith(alice) },
        tired: { code: 'FOE', zone: engagedWith(alice) },
      },
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
      investigators: pair(hall, 0, 0),
      cards: { big: { code: 'MAS', zone: at(hall) }, loner: { code: 'ALO', zone: at(hall) } },
    });

    expect(enemyAttackList(ctx, state)).toEqual([
      { enemyId: 'big', investigatorId: alice, damage: 2, horror: 0 },
      { enemyId: 'big', investigatorId: bob, damage: 2, horror: 0 },
    ]);
  });

  it('ignores defeated investigators and unengaged enemies', () => {
    const state = started({
      investigators: [makeInvestigator({ id: 'alice', locationId: hall, status: 'defeated' })],
      cards: {
        e: { code: 'FOE', zone: engagedWith(alice) },
        far: { code: 'FOE', zone: at(attic) },
      },
    });

    expect(enemyAttackList(ctx, state)).toEqual([]);
  });
});
