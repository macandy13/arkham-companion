import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  checkInvariants,
  emptyState,
  execute,
  handle,
  instanceId,
  investigatorId,
  mapId,
  zoneKey,
  type Command,
  type Event,
  type GameState,
  type Investigator,
  type Rejection,
  type StartScenario,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const inv1 = investigatorId('inv1');
const main = mapId('main');
const loc = instanceId('loc');

const investigator: Investigator = {
  id: inv1,
  code: '00001',
  name: 'Test Investigator',
  seat: 0,
  health: { max: 8, damage: 0 },
  sanity: { max: 6, horror: 0 },
  clues: 0,
  resources: 5,
  status: 'active',
};

const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 1234,
  investigators: [investigator],
  maps: { [main]: { name: 'Main' } },
  cards: [
    { id: loc, code: 'L1', zone: { kind: 'location', mapId: main }, faceUp: true },
    { code: 'E1', zone: { kind: 'encounterDeck' } },
    { code: 'E2', zone: { kind: 'encounterDeck' } },
    { code: 'E3', zone: { kind: 'encounterDeck' } },
    { code: 'E4', zone: { kind: 'encounterDeck' } },
    { code: 'A1', zone: { kind: 'agendaDeck' } },
  ],
};

/** Executes commands from an empty state, returning the final state and all events. */
function run(commands: Command[]): { state: GameState; events: Event[] } {
  let state = emptyState();
  const events: Event[] = [];
  for (const cmd of commands) {
    const result = execute(sandboxContext, state, cmd);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** The structured rejection `fn` throws (fails the test if it does not throw one). */
function rejectionOf(fn: () => unknown): Rejection {
  try {
    fn();
  } catch (e) {
    if (e instanceof CommandRejected) return e.rejection;
    throw e;
  }
  throw new Error('expected CommandRejected');
}

describe('StartScenario', () => {
  it('creates card instances and shuffles the encounter deck reproducibly', () => {
    const { state, events } = run([start]);
    expect(events.map((e) => e.type)).toEqual(['ScenarioStarted', 'DeckShuffled']);
    expect(Object.keys(state.cards)).toHaveLength(6);
    expect(state.cards[loc]?.faceUp).toBe(true);
    expect(state.meta.playerCount).toBe(1);
    expect(state.meta.leadInvestigator).toBe(inv1);
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
        handle(sandboxContext, emptyState(), {
          ...start,
          cards: [{ code: 'E3', zone: { kind: 'atLocation', locationId: instanceId('nope') } }],
        }),
      ),
    ).toMatchObject({ code: 'unknownCard', cardId: 'nope' });
    expect(
      rejectionOf(() =>
        handle(sandboxContext, emptyState(), {
          ...start,
          cards: [{ code: 'E3', zone: { kind: 'location', mapId: mapId('nope') } }],
        }),
      ),
    ).toMatchObject({ code: 'unknownMap', mapId: 'nope' });
    expect(
      rejectionOf(() =>
        handle(sandboxContext, emptyState(), {
          ...start,
          cards: [
            { id: loc, code: 'E3', zone: { kind: 'setAside' } },
            { id: loc, code: 'E4', zone: { kind: 'setAside' } },
          ],
        }),
      ),
    ).toMatchObject({ code: 'duplicateCard', cardId: 'loc' });
  });

  it('rejects card codes the card db does not know', () => {
    const command: StartScenario = {
      ...start,
      cards: [{ code: 'missing', zone: { kind: 'setAside' } }],
    };

    const rejection = rejectionOf(() => handle(sandboxContext, emptyState(), command));

    expect(rejection).toEqual({ code: 'unknownCardCode', cardCode: 'missing' });
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
        adjustment: { kind: 'moveCard', cardId: instanceId('c5'), to: { kind: 'outOfGame' } },
      },
    ]);
    expect(state.order[zoneKey({ kind: 'agendaDeck' })]).toBeUndefined();
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
        handle(sandboxContext, state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'moveCard', cardId: loc, to: { kind: 'attachedTo', hostId: loc } },
        }),
      ),
    ).toMatchObject({ code: 'hostingCycle', cardId: 'loc', hostId: 'loc' });
    expect(
      rejectionOf(() =>
        handle(sandboxContext, state, {
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
        handle(sandboxContext, state, {
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
        handle(sandboxContext, state, {
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
        handle(sandboxContext, run([start]).state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: instanceId('nope'), token: 'doom', delta: 1 },
        }),
      ),
    ).toMatchObject({ code: 'unknownCard', cardId: 'nope' });
  });
});
