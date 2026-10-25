import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  checkInvariants,
  emptyState,
  fixed,
  instanceId,
  investigatorId,
  mapId,
  neighbours,
  newGame,
  perInvestigator,
  replay,
  shortestPaths,
  type Command,
  type InstanceId,
  type Zone,
} from './index';
import { edge, rejectionFrom, rejectionOf, runFrom, stateAfter } from '../test/utils';

const main = mapId('main');
const annex = mapId('annex');
const study = instanceId('study');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

const studyCard = blankLocation('study');
/** Shows 2 clues per investigator when revealed. */
const hallCard = blankLocation('hall', { clues: perInvestigator(2) });
/** Shows 1 clue when revealed, whatever the player count. */
const cellarCard = blankLocation('cellar', { clues: fixed(1) });
const atticCard = blankLocation('attic');
const ghoulCard = blankEnemy('ghoul');

const setAside: Zone = { kind: 'setAside' };

/** Two maps: study and hall on main, cellar on annex; attic and a ghoul set aside; two investigators. */
const table = newGame()
  .withLocation(study, studyCard)
  .withLocation(hall, hallCard)
  .withLocation(cellar, cellarCard, { map: annex })
  .withCard(attic, atticCard, setAside)
  .withCard(ghoul, ghoulCard, setAside)
  .withInvestigator(investigatorId('alice'))
  .withInvestigator(investigatorId('bob'));

describe('AddConnection', () => {
  it('adds an undirected edge that works in both directions', () => {
    const { context, state } = table.start();

    const next = stateAfter(context, state, {
      type: 'AddConnection',
      mapId: main,
      from: study,
      to: hall,
    });

    expect(neighbours(next, study)).toEqual([hall]);
    expect(neighbours(next, hall)).toEqual([study]);
  });

  it('adds a one-way edge that only works from its source', () => {
    const { context, state } = table.start();

    const next = stateAfter(context, state, {
      type: 'AddConnection',
      mapId: main,
      from: study,
      to: hall,
      oneWay: true,
    });

    expect(neighbours(next, study)).toEqual([hall]);
    expect(neighbours(next, hall)).toEqual([]);
  });

  it('stores the edge on the map named by the command, even when it ends on another map', () => {
    const { context, state } = table.start();

    const next = stateAfter(context, state, {
      type: 'AddConnection',
      mapId: annex,
      from: hall,
      to: cellar,
    });

    expect(next.board.maps[annex]?.connections).toEqual([edge('hall', 'cellar')]);
    expect(next.board.maps[main]?.connections).toEqual([]);
  });

  it.each([
    ['an edge that already exists', { from: study, to: hall }],
    ['the same edge reversed', { from: hall, to: study }],
    ['the same edge on another map', { from: study, to: hall, mapId: annex }],
  ] as const)('rejects %s', (_name, command) => {
    const { context, state } = table.withConnection(study, hall).start();

    const rejection = rejectionFrom(context, state, {
      type: 'AddConnection',
      mapId: main,
      ...command,
    });

    expect(rejection).toEqual({
      code: 'duplicateConnection',
      from: command.from,
      to: command.to,
    });
  });

  it.each([
    ['a location to itself', { from: study, to: study }, { code: 'selfConnection', cardId: study }],
    [
      'a card that is not a location',
      { from: study, to: ghoul },
      { code: 'notALocation', cardId: ghoul },
    ],
    [
      'an unknown card',
      { from: study, to: instanceId('nowhere') },
      { code: 'unknownCard', cardId: 'nowhere' },
    ],
  ] as const)('rejects connecting %s', (_name, ends, expected) => {
    const { context, state } = table.start();

    const rejection = rejectionFrom(context, state, {
      type: 'AddConnection',
      mapId: main,
      ...ends,
    });

    expect(rejection).toEqual(expected);
  });

  it('rejects an edge for an unknown map', () => {
    const { context, state } = table.start();

    const rejection = rejectionFrom(context, state, {
      type: 'AddConnection',
      mapId: mapId('nowhere'),
      from: study,
      to: hall,
    });

    expect(rejection).toEqual({ code: 'unknownMap', mapId: 'nowhere' });
  });

  it('keeps an edge to a set-aside location inactive until it enters play', () => {
    const { context, state } = table.start();

    const connected = stateAfter(context, state, {
      type: 'AddConnection',
      mapId: main,
      from: study,
      to: attic,
    });

    const inPlay = stateAfter(context, connected, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: attic, to: { kind: 'location', mapId: annex } },
    });

    expect(neighbours(connected, study)).toEqual([]);
    expect(neighbours(inPlay, study)).toEqual([attic]);
  });
});

describe('RemoveConnection', () => {
  it('removes an undirected edge given in the opposite direction', () => {
    const { context, state } = table.withConnection(study, hall).start();

    const next = stateAfter(context, state, {
      type: 'RemoveConnection',
      from: hall,
      to: study,
    });

    expect(next.board.maps[main]?.connections).toEqual([]);
  });

  it('removes a cross-map edge from the map that owns it', () => {
    const { context, state } = table.withConnection(hall, cellar).start();

    const next = stateAfter(context, state, {
      type: 'RemoveConnection',
      from: cellar,
      to: hall,
    });

    expect(next.board.maps[main]?.connections).toEqual([]);
  });

  it('does not remove a one-way edge with an undirected command', () => {
    const { context, state } = table.withConnection(study, hall, { oneWay: true }).start();

    const rejection = rejectionFrom(context, state, {
      type: 'RemoveConnection',
      from: study,
      to: hall,
    });

    expect(rejection).toEqual({ code: 'connectionNotFound', from: study, to: hall });
  });
});

describe('connections at start', () => {
  it('rejects starting connections that repeat an edge, even across maps', () => {
    const rejection = rejectionOf(() =>
      table.withConnection(study, hall).withConnection(hall, study, { map: annex }).start(),
    );

    expect(rejection).toEqual({ code: 'duplicateConnection', from: hall, to: study });
  });

  it('keeps the book layout cells of the starting locations, per map', () => {
    const { state } = newGame()
      .withLocation(study, studyCard, { at: { column: 0, row: 0 } })
      .withLocation(cellar, cellarCard, { map: annex, at: { column: 1, row: 2 } })
      .start();

    expect(state.board.maps[main]?.layout).toEqual({ [study]: { column: 0, row: 0 } });
    expect(state.board.maps[annex]?.layout).toEqual({ [cellar]: { column: 1, row: 2 } });
  });

  it('rejects a starting layout cell for a location of another map', () => {
    const command = table.startCommand();
    const maps = {
      ...command.maps,
      [main]: { name: 'Main', layout: { [cellar]: { column: 0, row: 0 } } },
    };

    const rejection = rejectionFrom(table.context(), emptyState(), { ...command, maps });

    expect(rejection).toEqual({ code: 'layoutNotOnMap', cardId: cellar, mapId: main });
  });

  it('allows a starting connection to a location on another map', () => {
    const { state } = table.withConnection(hall, cellar).start();

    expect(neighbours(state, hall)).toEqual([cellar]);
  });
});

describe('PutLocationIntoPlay', () => {
  it('puts a set-aside location onto a map on the board, unrevealed, in its layout cell', () => {
    const { context, state: initial } = table.start();

    const { state, events } = runFrom(context, initial, [
      { type: 'PutLocationIntoPlay', locationId: attic, mapId: main, at: { column: 3, row: 0 } },
    ]);

    expect(state.cards[attic]).toMatchObject({
      zone: { kind: 'location', mapId: main },
      faceUp: false,
    });
    expect(state.board.maps[main]?.layout[attic]).toEqual({ column: 3, row: 0 });
    expect(events.map((event) => event.type)).toEqual(['CardMoved', 'LayoutCellSet']);
    expect(checkInvariants(state)).toEqual([]);
    expect(replay(events, initial)).toEqual(state);
  });

  it.each<{ name: string; command: Command; rejection: object }>([
    {
      name: 'a map that is not on the board',
      command: { type: 'PutLocationIntoPlay', locationId: attic, mapId: mapId('wing') },
      rejection: { code: 'unknownMap', mapId: mapId('wing') },
    },
    {
      name: 'a location that is already in play',
      command: { type: 'PutLocationIntoPlay', locationId: study, mapId: main },
      rejection: { code: 'cardAlreadyInPlay', cardId: study },
    },
    {
      name: 'a card that is not a location',
      command: { type: 'PutLocationIntoPlay', locationId: ghoul, mapId: main },
      rejection: { code: 'notALocation', cardId: ghoul },
    },
    {
      name: 'a cell off the grid',
      command: {
        type: 'PutLocationIntoPlay',
        locationId: attic,
        mapId: main,
        at: { column: -1, row: 0 },
      },
      rejection: { code: 'invalidGridCell', cardId: attic, column: -1, row: 0 },
    },
  ])('rejects $name', ({ command, rejection }) => {
    const { context, state } = table.start();

    expect(rejectionFrom(context, state, command)).toEqual(rejection);
  });
});

describe('AddMap', () => {
  const wing = mapId('wing');

  it('puts set-aside locations onto a new map with its connections', () => {
    const { context, state } = table.start();

    const next = stateAfter(context, state, {
      type: 'AddMap',
      mapId: wing,
      map: { name: 'Wing', connections: [edge('attic', 'hall')] },
      locations: [{ id: attic }],
    });

    expect(next.board.maps[wing]).toEqual({
      name: 'Wing',
      visible: true,
      connections: [edge('attic', 'hall')],
      layout: {},
    });
    expect(next.cards[attic]).toMatchObject({ zone: { kind: 'location', mapId: wing } });
    expect(neighbours(next, hall)).toEqual([attic]);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('keeps the book layout cells of its locations', () => {
    const { context, state } = table.start();

    const next = stateAfter(context, state, {
      type: 'AddMap',
      mapId: wing,
      map: { name: 'Wing' },
      locations: [{ id: attic, at: { column: 1, row: 0 } }],
    });

    expect(next.board.maps[wing]?.layout).toEqual({ [attic]: { column: 1, row: 0 } });
  });

  it('keeps the invariants and replays to the same state', () => {
    const { context, state: initial } = table.start();

    const { state, events } = runFrom(context, initial, [
      { type: 'AddMap', mapId: wing, map: { name: 'Wing' }, locations: [{ id: attic }] },
    ]);

    expect(events.map((event) => event.type)).toEqual(['MapAdded', 'CardMoved']);
    expect(replay(events, initial)).toEqual(state);
  });

  it.each<{ name: string; command: Command; rejection: object }>([
    {
      name: 'a map that is already on the board',
      command: { type: 'AddMap', mapId: main, map: { name: 'Main' }, locations: [] },
      rejection: { code: 'duplicateMap', mapId: main },
    },
    {
      name: 'a location that is already in play',
      command: { type: 'AddMap', mapId: wing, map: { name: 'Wing' }, locations: [{ id: study }] },
      rejection: { code: 'cardAlreadyInPlay', cardId: study },
    },
    {
      name: 'a card that is not a location',
      command: { type: 'AddMap', mapId: wing, map: { name: 'Wing' }, locations: [{ id: ghoul }] },
      rejection: { code: 'notALocation', cardId: ghoul },
    },
    {
      name: 'a location named twice',
      command: {
        type: 'AddMap',
        mapId: wing,
        map: { name: 'Wing' },
        locations: [{ id: attic }, { id: attic }],
      },
      rejection: { code: 'duplicateCard', cardId: attic },
    },
    {
      name: 'a connection that another map already has',
      command: {
        type: 'AddMap',
        mapId: wing,
        map: { name: 'Wing', connections: [edge('hall', 'study')] },
        locations: [],
      },
      rejection: { code: 'duplicateConnection', from: hall, to: study },
    },
    {
      name: 'a layout cell that is not a whole non-negative number',
      command: {
        type: 'AddMap',
        mapId: wing,
        map: { name: 'Wing' },
        locations: [{ id: attic, at: { column: -1, row: 0.5 } }],
      },
      rejection: { code: 'invalidGridCell', cardId: attic, column: -1, row: 0.5 },
    },
  ])('rejects $name', ({ command, rejection }) => {
    const { context, state } = table.withConnection(study, hall).start();

    expect(rejectionFrom(context, state, command)).toEqual(rejection);
  });
});

describe('connection events', () => {
  it('keep the invariants and replay to the same state', () => {
    const commands: Command[] = [
      { type: 'AddConnection', mapId: main, from: study, to: hall },
      { type: 'RemoveConnection', from: study, to: hall },
      { type: 'AddConnection', mapId: annex, from: hall, to: cellar, oneWay: true },
    ];
    const { context, state: initial } = table.start();

    const { state, events } = runFrom(context, initial, commands);

    expect(checkInvariants(state)).toEqual([]);
    expect(replay(events, initial)).toEqual(state);
  });
});

describe('neighbours', () => {
  const connected = table
    .withConnection(study, hall)
    .withConnection(hall, cellar, { oneWay: true });

  it.each([
    ['study', ['hall']],
    ['hall', ['study', 'cellar']],
    ['cellar', []],
  ])('lists the locations reachable from %s', (from, expected) => {
    const { state } = connected.start();

    expect(neighbours(state, instanceId(from))).toEqual(expected);
  });

  it.each([
    ['a set-aside location', 'attic'],
    ['a card that is not a location', 'ghoul'],
    ['an unknown card', 'nowhere'],
  ])('is empty for %s', (_name, from) => {
    const { state } = connected.withConnection(study, attic).start();

    expect(neighbours(state, instanceId(from))).toEqual([]);
  });
});

describe('neighbours along a connection printed on revealed sides only', () => {
  const revealed = (cardId: InstanceId): Command => ({
    type: 'RevealLocation',
    locationId: cardId,
  });

  it.each([
    { revealing: [], fromStudy: [] },
    { revealing: [study], fromStudy: [] },
    { revealing: [study, hall], fromStudy: [hall] },
  ])('leads from the study to $fromStudy with $revealing revealed', ({ revealing, fromStudy }) => {
    const { context, state: started } = table
      .withConnection(study, hall, { revealedOnly: true })
      .start();

    const state = stateAfter(context, started, ...revealing.map(revealed));

    expect(neighbours(state, study)).toEqual(fromStudy);
  });
});

describe('shortestPaths', () => {
  const den = instanceId('den');
  const { state: ringBoard } = newGame()
    .withLocation(study, studyCard)
    .withLocation(hall, hallCard)
    .withLocation(den, blankLocation('den'))
    .withLocation(cellar, cellarCard, { map: annex })
    .withCard(attic, atticCard, setAside)
    .withConnection(study, hall)
    .withConnection(hall, cellar)
    .withConnection(study, den)
    .withConnection(den, cellar)
    .withConnection(study, cellar, { oneWay: true })
    .start();
  const path = (...keys: string[]): InstanceId[] => keys.map(instanceId);

  it.each([
    ['the location itself when from equals to', 'study', 'study', [path('study')]],
    ['a direct one-way edge, ignoring longer routes', 'study', 'cellar', [path('study', 'cellar')]],
    [
      'every equally short path against the one-way edge',
      'cellar',
      'study',
      [path('cellar', 'hall', 'study'), path('cellar', 'den', 'study')],
    ],
    ['nothing for a location that is not on a map', 'study', 'attic', []],
    ['nothing for an unknown location', 'nowhere', 'study', []],
  ])('returns %s', (_name, from, to, expected) => {
    expect(shortestPaths(ringBoard, instanceId(from), instanceId(to))).toEqual(expected);
  });

  it('returns no path when the target cannot be reached', () => {
    const { state } = table.withConnection(study, hall).start();

    expect(shortestPaths(state, study, cellar)).toEqual([]);
  });

  it('crosses from one map to another', () => {
    const { state } = table.withConnection(hall, cellar).start();

    expect(shortestPaths(state, hall, cellar)).toEqual([[hall, cellar]]);
  });
});

describe('RevealLocation', () => {
  it.each([
    // The hall's 2 clues per investigator, for alice and bob of `table`.
    ['per investigator', hall, 4],
    ['as a fixed amount regardless of investigators', cellar, 1],
  ])('flips the location and places clues %s', (_name, locationId, clues) => {
    const { context, state } = table.start();

    const next = stateAfter(context, state, { type: 'RevealLocation', locationId });

    expect(next.cards[locationId]?.faceUp).toBe(true);
    expect(next.cards[locationId]?.tokens.clue).toBe(clues);
  });

  it('rejects revealing a location twice', () => {
    const { context, state } = table.start();
    const revealed = stateAfter(context, state, {
      type: 'RevealLocation',
      locationId: study,
    });

    const rejection = rejectionFrom(context, revealed, {
      type: 'RevealLocation',
      locationId: study,
    });

    expect(rejection).toEqual({ code: 'alreadyRevealed', cardId: study });
  });

  it.each([
    ['a card that is not on a map', attic, { code: 'notALocation', cardId: attic }],
    ['an unknown card', instanceId('nowhere'), { code: 'unknownCard', cardId: 'nowhere' }],
  ])('rejects revealing %s', (_name, locationId, expected) => {
    const { context, state } = table.start();

    const rejection = rejectionFrom(context, state, { type: 'RevealLocation', locationId });

    expect(rejection).toEqual(expected);
  });
});
