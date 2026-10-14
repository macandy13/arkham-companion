import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  MAX_TRIGGERED_COMMANDS,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  type Command,
  type EngineContext,
  type GameState,
  type Rejection,
} from './index';
import { triggeredCommands } from './triggers';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const main = mapId('main');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const ghoul = instanceId('ghoul');
const deckGhoul = instanceId('deckGhoul');
const agenda1 = instanceId('agenda1');
const agenda2 = instanceId('agenda2');
const act1 = instanceId('act1');
const act2 = instanceId('act2');
const alice = investigatorId('alice');

/**
 * One investigator in the revealed hall, an unrevealed cellar (L2) next to it,
 * a ghoul at the hall and one in the encounter deck; agendas A1 (threshold 3)
 * and A2, acts C1 (2 clues per investigator) and C2.
 */
function startedState(): GameState {
  return execute(sandboxContext, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'triggers',
    difficulty: 'standard',
    seed: 1,
    investigators: [
      {
        id: alice,
        code: '00001',
        name: 'Alice',
        seat: 1,
        locationId: hall,
        health: { max: 8, damage: 0 },
        sanity: { max: 6, horror: 0 },
        clues: 2,
        resources: 5,
        doomOnPlayerCards: 0,
        status: 'active',
      },
    ],
    maps: { [main]: { name: 'Main' } },
    cards: [
      { id: agenda1, code: 'A1', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: agenda2, code: 'A2', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: act1, code: 'C1', zone: { kind: 'actDeck' }, faceUp: true },
      { id: act2, code: 'C2', zone: { kind: 'actDeck' }, faceUp: true },
      { id: hall, code: 'L1', zone: { kind: 'location', mapId: main }, faceUp: true },
      { id: cellar, code: 'L2', zone: { kind: 'location', mapId: main } },
      { id: ghoul, code: 'E1', zone: { kind: 'atLocation', locationId: hall }, faceUp: true },
      { id: deckGhoul, code: 'E1', zone: { kind: 'encounterDeck' } },
    ],
    connections: [{ from: hall, to: cellar, oneWay: false }],
  }).state;
}

function withHooks(hooks: EngineContext['hooks'], effects?: EngineContext['effects']) {
  return { ...sandboxContext, hooks, ...(effects ? { effects } : {}) };
}

function rejectionOf(ctx: EngineContext, state: GameState, command: Command): Rejection {
  try {
    execute(ctx, state, command);
  } catch (error) {
    if (error instanceof CommandRejected) return error.rejection;
    throw error;
  }
  throw new Error('command was not rejected');
}

const placeDoomOnGhoul: Command = { type: 'PlaceDoom', cardId: ghoul, amount: 1 };
const advanceAct: Command = { type: 'AdvanceAct', spend: [{ investigatorId: alice, amount: 2 }] };

describe('trigger bus', () => {
  it('appends the events of an afterDoomPlaced follow-up to the originating command', () => {
    const ctx = withHooks({
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
    });

    const { events } = execute(ctx, startedState(), placeDoomOnGhoul);

    expect(events.map((event) => event.type)).toEqual([
      'TokensChanged',
      'CardFlipped',
      'TokensChanged',
    ]);
  });

  it('passes the triggering event to the hook', () => {
    const seen: unknown[] = [];
    const ctx = withHooks({
      afterDoomPlaced: (_ctx, _state, event) => {
        seen.push(event);
        return [];
      },
    });

    execute(ctx, startedState(), { type: 'PlaceDoom', cardId: ghoul, amount: 2 });

    expect(seen).toEqual([{ type: 'TokensChanged', cardId: ghoul, token: 'doom', delta: 2 }]);
  });

  it('does not fire forced effects for a manual correction', () => {
    const ctx = withHooks({
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
    });

    const { events } = execute(ctx, startedState(), {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: ghoul, token: 'doom', delta: 1 },
    });

    expect(events.map((event) => event.type)).toEqual(['TokensChanged']);
  });

  it('runs the reverse side of the advancing agenda while it is still current', () => {
    const seen: unknown[] = [];
    const ctx = withHooks({
      onAgendaAdvance: {
        A1: (_ctx, state) => {
          seen.push({ current: state.agenda.current, faceUp: state.cards[agenda1]?.faceUp });
          return [{ type: 'RevealLocation', locationId: cellar }];
        },
        A2: () => [{ type: 'PlaceDoom', cardId: ghoul, amount: 1 }],
      },
    });

    const { events, state } = execute(ctx, startedState(), { type: 'AdvanceAgenda' });

    expect(seen).toEqual([{ current: agenda1, faceUp: false }]);
    expect(events.map((event) => event.type)).toEqual([
      'CardFlipped',
      'AgendaAdvanced',
      'CardFlipped',
      'TokensChanged',
      'CardMoved',
      'CurrentCardChanged',
    ]);
    expect(state.agenda.current).toBe(agenda2);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  it('applies a reverse-side effect on the current agenda to the advancing agenda', () => {
    const ctx = withHooks({ onAgendaAdvance: { A1: () => [{ type: 'PlaceDoom', amount: 1 }] } });

    const { state } = execute(ctx, startedState(), { type: 'AdvanceAgenda' });

    expect(state.cards[agenda1]?.tokens.doom).toBe(1);
    expect(state.cards[agenda2]?.tokens.doom).toBeUndefined();
  });

  it('lets the reverse side of the last agenda end the scenario with its resolution', () => {
    const ctx = withHooks({
      onAgendaAdvance: { A2: () => [{ type: 'EndScenario', resolution: 'R2' }] },
    });
    const lastAgenda = execute(ctx, startedState(), { type: 'AdvanceAgenda' }).state;

    const { events, state } = execute(ctx, lastAgenda, { type: 'AdvanceAgenda' });

    expect(events.map((event) => event.type).slice(-3)).toEqual([
      'ScenarioEnded',
      'CardMoved',
      'CurrentCardChanged',
    ]);
    expect(state.meta.resolution).toBe('R2');
    expect(state.agenda.current).toBeUndefined();
  });

  it('prefers the resolution of the reverse side over the fallback resolution', () => {
    const ctx = withHooks({
      onAgendaAdvance: { A2: () => [{ type: 'EndScenario', resolution: 'R2' }] },
    });
    const lastAgenda = execute(ctx, startedState(), { type: 'AdvanceAgenda' }).state;

    const { events, state } = execute(ctx, lastAgenda, { type: 'AdvanceAgenda', resolution: 'R1' });

    expect(events.filter((event) => event.type === 'ScenarioEnded')).toEqual([
      { type: 'ScenarioEnded', resolution: 'R2' },
    ]);
    expect(state.meta.resolution).toBe('R2');
  });

  it('runs the reverse side of the advancing act while it is still current', () => {
    const currentActs: unknown[] = [];
    const ctx = withHooks({
      onActAdvance: {
        C1: (_ctx, state) => {
          currentActs.push(state.act.current);
          return [{ type: 'RevealLocation', locationId: cellar }];
        },
      },
    });

    const { state } = execute(ctx, startedState(), advanceAct);

    expect(currentActs).toEqual([act1]);
    expect(state.act.current).toBe(act2);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  it('runs the onReveal effect of a card turned face up', () => {
    const ctx = withHooks(
      {},
      {
        L2: {
          onReveal: (_ctx, _state, event) => [
            { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
          ],
        },
      },
    );

    const { state } = execute(ctx, startedState(), { type: 'RevealLocation', locationId: cellar });

    expect(state.cards[cellar]?.tokens.doom).toBe(1);
  });

  it('does not run onReveal when a card is turned face down', () => {
    const ctx = withHooks(
      {},
      { A1: { onReveal: () => [{ type: 'RevealLocation', locationId: cellar }] } },
    );

    const { state } = execute(ctx, startedState(), { type: 'AdvanceAgenda' });

    expect(state.cards[cellar]?.faceUp).toBe(false);
  });

  it('resolves the forced effects a follow-up triggers within the same command', () => {
    const ctx = withHooks({
      onActAdvance: { C1: () => [placeDoomOnGhoul] },
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
    });

    const { state } = execute(ctx, startedState(), advanceAct);

    expect(state.cards[ghoul]?.tokens.doom).toBe(1);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  it('runs follow-ups through the full command handling, including the agenda check', () => {
    const ctx = withHooks({ onActAdvance: { C1: () => [{ type: 'PlaceDoom', amount: 3 }] } });

    const { state } = execute(ctx, startedState(), advanceAct);

    expect(state.pending.map((decision) => decision.kind)).toEqual(['advanceAgenda']);
  });
});

describe('trigger bus failures', () => {
  it('rejects a chain that keeps re-triggering itself', () => {
    const ctx = withHooks({ afterDoomPlaced: () => [placeDoomOnGhoul] });

    const rejection = rejectionOf(ctx, startedState(), placeDoomOnGhoul);

    expect(rejection).toEqual({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
  });

  it('allows a chain of exactly the limit', () => {
    const ctx = withHooks({
      afterDoomPlaced: (_ctx, state) =>
        (state.cards[ghoul]?.tokens.doom ?? 0) <= MAX_TRIGGERED_COMMANDS ? [placeDoomOnGhoul] : [],
    });

    const { state } = execute(ctx, startedState(), placeDoomOnGhoul);

    expect(state.cards[ghoul]?.tokens.doom).toBe(MAX_TRIGGERED_COMMANDS + 1);
  });

  it('rejects the originating command when a follow-up is invalid, naming its reason', () => {
    const ctx = withHooks({
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: hall }],
    });

    const rejection = rejectionOf(ctx, startedState(), placeDoomOnGhoul);

    expect(rejection).toEqual({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
      reason: { code: 'alreadyRevealed', cardId: hall },
    });
  });

  it('reports the innermost rejected follow-up of a nested chain', () => {
    const ctx = withHooks({
      onActAdvance: { C1: () => [placeDoomOnGhoul] },
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: hall }],
    });

    const rejection = rejectionOf(ctx, startedState(), advanceAct);

    expect(rejection).toMatchObject({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
    });
  });
});

describe('onCardEnters', () => {
  it('fires when a card moves from outside play onto the board', () => {
    const ctx = withHooks({ onCardEnters: () => [{ type: 'RevealLocation', locationId: cellar }] });

    const commands = triggeredCommands(ctx, startedState(), [
      {
        type: 'CardMoved',
        cardId: deckGhoul,
        from: { kind: 'encounterDeck' },
        to: { kind: 'atLocation', locationId: hall },
      },
    ]);

    expect(commands).toEqual([{ type: 'RevealLocation', locationId: cellar }]);
  });

  it('does not fire when a card moves within play', () => {
    const ctx = withHooks({ onCardEnters: () => [{ type: 'RevealLocation', locationId: cellar }] });

    const commands = triggeredCommands(ctx, startedState(), [
      {
        type: 'CardMoved',
        cardId: ghoul,
        from: { kind: 'atLocation', locationId: hall },
        to: { kind: 'atLocation', locationId: cellar },
      },
    ]);

    expect(commands).toEqual([]);
  });
});
