import { describe, expect, it } from 'vitest';
import {
  cardCode,
  checkInvariants,
  handle,
  instanceId,
  mapId,
  mapLocations,
  emptyState,
  zoneKey,
  type Command,
  type StartScenario,
} from './index';
import {
  makeInvestigator,
  rejectionFrom,
  rejectionOf,
  run as runWith,
  testContext,
} from '../test/utils';

const main = mapId('main');
const loc = instanceId('loc');
const investigator = makeInvestigator({ id: 'inv1' });

const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 1234,
  investigators: [investigator],
  maps: { [main]: { name: 'Main' } },
  cards: [
    { id: loc, code: cardCode('L1'), zone: { kind: 'location', mapId: main }, faceUp: true },
    { code: cardCode('E1'), zone: { kind: 'encounterDeck' } },
    { code: cardCode('E2'), zone: { kind: 'encounterDeck' } },
    { code: cardCode('E3'), zone: { kind: 'encounterDeck' } },
    { code: cardCode('E4'), zone: { kind: 'encounterDeck' } },
    { code: cardCode('A1'), zone: { kind: 'agendaDeck' } },
  ],
};

/** Executes commands against the test cards from an empty state. */
function run(commands: Command[]) {
  return runWith(testContext, commands);
}

describe('StartScenario', () => {
  it('creates card instances and shuffles the encounter deck reproducibly', () => {
    const { state, events } = run([start]);
    expect(events.map((e) => e.type)).toEqual(['ScenarioStarted', 'DeckShuffled']);
    expect(Object.keys(state.cards)).toHaveLength(6);
    expect(state.cards[loc]?.faceUp).toBe(true);
    expect(state.meta.playerCount).toBe(1);
    expect(state.meta.leadInvestigator).toBe(investigator.id);
    const deck = state.order[zoneKey({ kind: 'encounterDeck' })];
    expect(deck?.slice().sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(run([start]).state).toEqual(state);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('can skip the shuffle', () => {
    const { state, events } = run([{ ...start, shuffleEncounterDeck: false }]);
    expect(events).toHaveLength(1);
    expect(state.order[zoneKey({ kind: 'encounterDeck' })]).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('rejects unknown references and duplicate ids', () => {
    expect(
      rejectionOf(() =>
        handle(testContext, emptyState(), {
          ...start,
          cards: [
            { code: cardCode('E3'), zone: { kind: 'atLocation', locationId: instanceId('nope') } },
          ],
        }),
      ),
    ).toMatchObject({ code: 'unknownCard', cardId: 'nope' });
    expect(
      rejectionOf(() =>
        handle(testContext, emptyState(), {
          ...start,
          cards: [{ code: cardCode('E3'), zone: { kind: 'location', mapId: mapId('nope') } }],
        }),
      ),
    ).toMatchObject({ code: 'unknownMap', mapId: 'nope' });
    expect(
      rejectionOf(() =>
        handle(testContext, emptyState(), {
          ...start,
          cards: [
            { id: loc, code: cardCode('E3'), zone: { kind: 'setAside' } },
            { id: loc, code: cardCode('E4'), zone: { kind: 'setAside' } },
          ],
        }),
      ),
    ).toMatchObject({ code: 'duplicateCard', cardId: 'loc' });
  });

  it('rejects card codes the card db does not know', () => {
    const command: StartScenario = {
      ...start,
      cards: [{ code: cardCode('missing'), zone: { kind: 'setAside' } }],
    };

    const rejection = rejectionOf(() => handle(testContext, emptyState(), command));

    expect(rejection).toEqual({ code: 'unknownCardCode', cardCode: 'missing' });
  });

  it('starts cards with their given tokens', () => {
    const command: StartScenario = {
      ...start,
      cards: [
        {
          id: loc,
          code: cardCode('L1'),
          zone: { kind: 'location', mapId: main },
          tokens: { clue: 2 },
        },
      ],
    };

    const { state } = run([command]);

    expect(state.cards[loc]?.tokens).toEqual({ clue: 2 });
  });

  it('rejects negative or fractional starting tokens', () => {
    const command: StartScenario = {
      ...start,
      cards: [{ id: loc, code: cardCode('L1'), zone: { kind: 'setAside' }, tokens: { doom: -1 } }],
    };

    const rejection = rejectionOf(() => handle(testContext, emptyState(), command));

    expect(rejection).toEqual({
      code: 'invalidStartingTokens',
      cardId: 'loc',
      token: 'doom',
      amount: -1,
    });
  });

  it('puts each map with its connections on the board and investigators at their location', () => {
    const other = instanceId('other');
    const command: StartScenario = {
      ...start,
      investigators: [{ ...investigator, locationId: loc }],
      maps: { [main]: { name: 'Main', connections: [{ from: loc, to: other, oneWay: true }] } },
      cards: [
        { id: loc, code: cardCode('L1'), zone: { kind: 'location', mapId: main } },
        { id: other, code: cardCode('L2'), zone: { kind: 'location', mapId: main } },
      ],
    };

    const { state } = run([command]);

    expect(state.board.maps[main]).toEqual({
      name: 'Main',
      visible: true,
      connections: [{ from: loc, to: other, oneWay: true }],
    });
    expect(mapLocations(state, main)).toEqual([loc, other]);
    expect(state.investigators[0]?.locationId).toBe(loc);
  });

  it('lists no locations for an unknown map', () => {
    const { state } = run([start]);

    expect(mapLocations(state, mapId('elsewhere'))).toEqual([]);
  });

  it('rejects a connection to a card that is not a location', () => {
    const aside = instanceId('aside');
    const command: StartScenario = {
      ...start,
      maps: { [main]: { name: 'Main', connections: [{ from: loc, to: aside, oneWay: false }] } },
      cards: [
        { id: loc, code: cardCode('L1'), zone: { kind: 'location', mapId: main } },
        { id: aside, code: cardCode('E1'), zone: { kind: 'setAside' } },
      ],
    };

    const rejection = rejectionOf(() => handle(testContext, emptyState(), command));

    expect(rejection).toEqual({ code: 'notALocation', cardId: 'aside' });
  });

  it('accepts a connection to a location on another map and stores it on the declaring map', () => {
    const dream = mapId('dream');
    const far = instanceId('far');
    const command: StartScenario = {
      ...start,
      maps: {
        [main]: { name: 'Main', connections: [{ from: loc, to: far, oneWay: false }] },
        [dream]: { name: 'Dream' },
      },
      cards: [
        { id: loc, code: cardCode('L1'), zone: { kind: 'location', mapId: main } },
        { id: far, code: cardCode('L2'), zone: { kind: 'location', mapId: dream } },
      ],
    };

    const { state } = run([command]);

    expect(state.board.maps[main]?.connections).toEqual([{ from: loc, to: far, oneWay: false }]);
    expect(state.board.maps[dream]?.connections).toEqual([]);
  });

  it('rejects an investigator placed at an unknown card', () => {
    const command: StartScenario = {
      ...start,
      investigators: [{ ...investigator, locationId: instanceId('nowhere') }],
    };

    const rejection = rejectionOf(() => handle(testContext, emptyState(), command));

    expect(rejection).toEqual({ code: 'unknownCard', cardId: 'nowhere' });
  });
});

describe('ManualAdjust', () => {
  it('moves a card between zones and to a given index', () => {
    const { state } = run([
      { ...start, shuffleEncounterDeck: false },
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: instanceId('c1'),
          to: { kind: 'atLocation', locationId: loc },
        },
      },
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: instanceId('c4'),
          to: { kind: 'encounterDeck' },
          index: 0,
        },
      },
    ]);
    expect(state.cards[instanceId('c1')]?.zone).toEqual({ kind: 'atLocation', locationId: loc });
    expect(state.order[zoneKey({ kind: 'encounterDeck' })]).toEqual(['c4', 'c2', 'c3']);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('removes empty zones from the order map', () => {
    const { state } = run([
      start,
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'moveCard', cardId: loc, to: { kind: 'outOfGame' } },
      },
    ]);
    expect(state.order[zoneKey({ kind: 'location', mapId: main })]).toBeUndefined();
  });

  it('rejects placing a card on itself or creating a hosting cycle', () => {
    const { state } = run([
      start,
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: instanceId('c1'),
          to: { kind: 'attachedTo', hostId: loc },
        },
      },
    ]);
    expect(
      rejectionOf(() =>
        handle(testContext, state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'moveCard', cardId: loc, to: { kind: 'attachedTo', hostId: loc } },
        }),
      ),
    ).toMatchObject({ code: 'hostingCycle', cardId: 'loc', hostId: 'loc' });
    expect(
      rejectionOf(() =>
        handle(testContext, state, {
          type: 'ManualAdjust',
          adjustment: {
            kind: 'moveCard',
            cardId: loc,
            to: { kind: 'attachedTo', hostId: instanceId('c1') },
          },
        }),
      ),
    ).toMatchObject({ code: 'hostingCycle', cardId: 'loc', hostId: 'c1' });
  });

  it('rejects out-of-range indices', () => {
    const { state } = run([start]);
    expect(
      rejectionOf(() =>
        handle(testContext, state, {
          type: 'ManualAdjust',
          adjustment: {
            kind: 'moveCard',
            cardId: instanceId('c1'),
            to: { kind: 'encounterDeck' },
            index: 4,
          },
        }),
      ),
    ).toMatchObject({ code: 'indexOutOfRange', index: 4, max: 3 });
  });

  it('changes tokens and never lets them go negative', () => {
    const add: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: loc, token: 'clue', delta: 2 },
    };
    const { state } = run([start, add]);
    expect(state.cards[loc]?.tokens.clue).toBe(2);
    expect(
      rejectionOf(() =>
        handle(testContext, state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: loc, token: 'clue', delta: -3 },
        }),
      ),
    ).toMatchObject({ code: 'negativeTokens', current: 2, delta: -3 });
    const back = run([
      start,
      add,
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: loc, token: 'clue', delta: -2 },
      },
    ]).state;
    expect(back.cards[loc]?.tokens).toEqual({});
  });

  it('rejects unknown cards', () => {
    expect(
      rejectionOf(() =>
        handle(testContext, run([start]).state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: instanceId('nope'), token: 'doom', delta: 1 },
        }),
      ),
    ).toMatchObject({ code: 'unknownCard', cardId: 'nope' });
  });
});

describe('MoveCard', () => {
  it('moves a card to the end of the destination zone', () => {
    const { state, events } = run([
      { ...start, shuffleEncounterDeck: false },
      { type: 'MoveCard', cardId: instanceId('c2'), to: { kind: 'encounterDiscard' } },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'CardMoved',
      cardId: 'c2',
      from: { kind: 'encounterDeck' },
      to: { kind: 'encounterDiscard' },
    });
    expect(state.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual(['c2']);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('rejects a destination on an unknown map, like a manual move', () => {
    const { state } = run([start]);
    const elsewhere = mapId('elsewhere');

    const rejection = rejectionFrom(testContext, state, {
      type: 'MoveCard',
      cardId: loc,
      to: { kind: 'location', mapId: elsewhere },
    });

    expect(rejection).toEqual({ code: 'unknownMap', mapId: elsewhere });
  });

  it('rejects an unknown card', () => {
    const { state } = run([start]);
    const missing = instanceId('missing');

    const rejection = rejectionFrom(testContext, state, {
      type: 'MoveCard',
      cardId: missing,
      to: { kind: 'outOfGame' },
    });

    expect(rejection).toEqual({ code: 'unknownCard', cardId: missing });
  });
});
