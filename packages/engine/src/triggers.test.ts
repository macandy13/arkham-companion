import { describe, expect, it } from 'vitest';
import {
  MAX_TRIGGERED_COMMANDS,
  atLocation,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  checkInvariants,
  execute,
  fixed,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  perInvestigator,
  type Command,
  type Rejection,
  type EngineContext,
  type GameState,
  type ScenarioHooks,
} from './index';
import { triggeredCommands } from './triggers';
import { rejectionFrom, stateAfter, withScenario } from '../test/utils';

const main = mapId('main');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const crypt = instanceId('crypt');
const ghoul = instanceId('ghoul');
const deckGhoul = instanceId('deckGhoul');
const agenda1 = instanceId('agenda1');
const agenda2 = instanceId('agenda2');
const act1 = instanceId('act1');
const act2 = instanceId('act2');
const alice = investigatorId('alice');

/** The first agenda advances at 3 doom; the follow-up threshold check relies on it. */
const firstAgendaCard = blankAgenda('first_agenda', fixed(3));
const secondAgendaCard = blankAgenda('second_agenda', fixed(5), { stage: { number: 2 } });
/** The first act needs 2 clues per investigator, the 2 alice spends to advance it. */
const firstActCard = blankAct('first_act', { clues: perInvestigator(2) });
const secondActCard = blankAct('second_act', { stage: { number: 2 } });
/** The cellar has clues, so revealing it places them (a `TokensChanged` after its `CardFlipped`). */
const cellarCard = blankLocation('cellar', { clues: perInvestigator(2) });
const ghoulCard = blankEnemy('ghoul');

/**
 * Alice with 2 clues in the revealed hall, an unrevealed cellar next to it
 * and a set-aside crypt; a ghoul at the hall and one in the encounter deck;
 * the first and second agenda and act.
 */
const table = newGame()
  .withAgenda(agenda1, firstAgendaCard)
  .withAgenda(agenda2, secondAgendaCard)
  .withAct(act1, firstActCard)
  .withAct(act2, secondActCard)
  .withLocation(hall, blankLocation('hall'), { revealed: true })
  .withLocation(cellar, cellarCard)
  .withConnection(hall, cellar)
  .withCard(crypt, blankLocation('crypt'), { kind: 'setAside' })
  .withCard(ghoul, ghoulCard, atLocation(hall), { faceUp: true })
  .withCard(deckGhoul, ghoulCard, { kind: 'encounterDeck' })
  .withInvestigator(alice, { locationId: hall, clues: 2 });

function startedState(): GameState {
  return table.start().state;
}

/** The context of the table playing a scenario with `hooks`, and with the card `effects` if given. */
function withHooks(
  hooks: Partial<ScenarioHooks>,
  effects?: EngineContext['effects'],
): EngineContext {
  return { ...withScenario(table.context(), { hooks }), ...(effects ? { effects } : {}) };
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
        first_agenda: (_ctx, state) => {
          seen.push({ current: state.agenda.current, faceUp: state.cards[agenda1]?.faceUp });
          return [{ type: 'RevealLocation', locationId: cellar }];
        },
        second_agenda: () => [{ type: 'PlaceDoom', cardId: ghoul, amount: 1 }],
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
    const ctx = withHooks({
      onAgendaAdvance: { first_agenda: () => [{ type: 'PlaceDoom', amount: 1 }] },
    });

    const { state } = execute(ctx, startedState(), { type: 'AdvanceAgenda' });

    expect(state.cards[agenda1]?.tokens.doom).toBe(1);
    expect(state.cards[agenda2]?.tokens.doom).toBeUndefined();
  });

  it('lets the reverse side of the last agenda end the scenario with its resolution', () => {
    const ctx = withHooks({
      onAgendaAdvance: { second_agenda: () => [{ type: 'EndScenario', resolution: 'R2' }] },
    });
    const lastAgenda = stateAfter(ctx, startedState(), { type: 'AdvanceAgenda' });

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
      onAgendaAdvance: { second_agenda: () => [{ type: 'EndScenario', resolution: 'R2' }] },
    });
    const lastAgenda = stateAfter(ctx, startedState(), { type: 'AdvanceAgenda' });

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
        first_act: (_ctx, state) => {
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
        cellar: {
          onReveal: (_ctx, _state, event) => [
            { type: 'PlaceDoom', cardId: event.cardId, amount: 1 },
          ],
        },
      },
    );

    const { state } = execute(ctx, startedState(), { type: 'RevealLocation', locationId: cellar });

    expect(state.cards[cellar]?.tokens.doom).toBe(1);
  });

  it('lets a card effect connect a revealed location to a set-aside one', () => {
    const ctx = withHooks(
      {},
      {
        cellar: {
          onReveal: (_ctx, _state, event) => [
            { type: 'AddConnection', mapId: main, from: event.cardId, to: crypt },
          ],
        },
      },
    );

    const { events, state } = execute(ctx, startedState(), {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
    });

    expect(events.at(-1)).toEqual({
      type: 'ConnectionChanged',
      change: 'added',
      mapId: main,
      edge: { from: cellar, to: crypt, oneWay: false },
    });
    expect(checkInvariants(state)).toEqual([]);
  });

  it('does not run onReveal when a card is turned face down', () => {
    const ctx = withHooks(
      {},
      { first_agenda: { onReveal: () => [{ type: 'RevealLocation', locationId: cellar }] } },
    );

    const { state } = execute(ctx, startedState(), { type: 'AdvanceAgenda' });

    expect(state.cards[cellar]?.faceUp).toBe(false);
  });

  it('resolves the forced effects a follow-up triggers within the same command', () => {
    const ctx = withHooks({
      onActAdvance: { first_act: () => [placeDoomOnGhoul] },
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
    });

    const { state } = execute(ctx, startedState(), advanceAct);

    expect(state.cards[ghoul]?.tokens.doom).toBe(1);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  it('runs follow-ups through the full command handling, including a doom threshold check', () => {
    const ctx = withHooks({
      onActAdvance: {
        first_act: () => [{ type: 'PlaceDoom', amount: 3 }, { type: 'CheckDoomThreshold' }],
      },
    });

    const { state } = execute(ctx, startedState(), advanceAct);

    expect(state.pending.map((decision) => decision.kind)).toEqual(['confirm']);
  });
});

describe('afterEnemyDefeated', () => {
  /** Advances the act (first to second) when the hall's ghoul is defeated, as "if this enemy is defeated, advance". */
  const advanceOnGhoulDefeat = withHooks({
    afterEnemyDefeated: (_ctx, _state, event) =>
      event.enemyId === ghoul ? [{ type: 'AdvanceAct' }] : [],
  });

  it('runs the follow-up when the enemy the hook names is defeated', () => {
    const { state } = execute(advanceOnGhoulDefeat, startedState(), {
      type: 'DefeatEnemy',
      enemyId: ghoul,
    });

    expect(state.act.current).toBe(act2);
  });

  it('does nothing when another enemy is defeated', () => {
    const withDeckGhoulInHall = stateAfter(advanceOnGhoulDefeat, startedState(), {
      type: 'SpawnEnemy',
      enemyId: deckGhoul,
      at: hall,
    });

    const { state } = execute(advanceOnGhoulDefeat, withDeckGhoulInHall, {
      type: 'DefeatEnemy',
      enemyId: deckGhoul,
    });

    expect(state.act.current).toBe(act1);
  });

  it('sees the enemy where the defeat put it', () => {
    const seen: unknown[] = [];
    const ctx = withHooks({
      afterEnemyDefeated: (_ctx, state, event) => {
        seen.push(state.cards[event.enemyId]?.zone);
        return [];
      },
    });

    execute(ctx, startedState(), { type: 'DefeatEnemy', enemyId: ghoul });

    expect(seen).toEqual([{ kind: 'encounterDiscard' }]);
  });
});

describe('trigger bus failures', () => {
  it('rejects a chain that keeps re-triggering itself', () => {
    const ctx = withHooks({ afterDoomPlaced: () => [placeDoomOnGhoul] });

    const rejection = rejectionFrom(ctx, startedState(), placeDoomOnGhoul);

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

    const rejection = rejectionFrom(ctx, startedState(), placeDoomOnGhoul);

    expect(rejection).toEqual({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
      reason: { code: 'alreadyRevealed', cardId: hall },
    });
  });

  it('reports the innermost rejected follow-up of a nested chain', () => {
    const ctx = withHooks({
      onActAdvance: { first_act: () => [placeDoomOnGhoul] },
      afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: hall }],
    });

    const rejection = rejectionFrom(ctx, startedState(), advanceAct);

    expect(rejection).toMatchObject({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
    });
  });
});

describe('onCardEnters', () => {
  it('fires for a card a MoveCard puts into play, but not for the same ManualAdjust move', () => {
    const entered: unknown[] = [];
    const ctx = withHooks({
      onCardEnters: (_ctx, _state, event) => {
        entered.push(event.cardId);
        return [];
      },
    });
    const to = atLocation(hall);

    execute(ctx, startedState(), { type: 'MoveCard', cardId: deckGhoul, to });
    execute(ctx, startedState(), {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: deckGhoul, to },
    });

    expect(entered).toEqual([deckGhoul]);
  });

  it('fires for each location an AddMap puts into play', () => {
    const entered: unknown[] = [];
    const ctx = withHooks({
      onCardEnters: (_ctx, _state, event) => {
        entered.push(event.cardId);
        return [];
      },
    });

    execute(ctx, startedState(), {
      type: 'AddMap',
      mapId: mapId('vault'),
      map: { name: 'Vault' },
      locations: [crypt],
    });

    expect(entered).toEqual([crypt]);
  });

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

/**
 * A hook program for the loop-guard tables: until the ghoul carries
 * `chainLength` doom, every doom placement triggers `fanOut` more; when the
 * ghoul carries `invalidAt` doom, the hook asks for an impossible command
 * (revealing the already revealed hall) instead.
 */
interface Program {
  chainLength: number;
  fanOut: number;
  invalidAt?: number;
}

function programContext({ chainLength, fanOut, invalidAt }: Program): EngineContext {
  return withHooks({
    afterDoomPlaced: (_ctx, state) => {
      const doom = state.cards[ghoul]?.tokens.doom ?? 0;
      if (doom === invalidAt) return [{ type: 'RevealLocation', locationId: hall }];
      return doom < chainLength ? Array.from({ length: fanOut }, () => placeDoomOnGhoul) : [];
    },
  });
}

describe('trigger bus loop guard', () => {
  it.each<{ name: string; program: Program; doom: number }>([
    { name: 'no follow-ups', program: { chainLength: 0, fanOut: 1 }, doom: 1 },
    { name: 'a short single-file chain', program: { chainLength: 5, fanOut: 1 }, doom: 5 },
    {
      name: 'a single-file chain of exactly the limit',
      program: { chainLength: MAX_TRIGGERED_COMMANDS + 1, fanOut: 1 },
      doom: MAX_TRIGGERED_COMMANDS + 1,
    },
    { name: 'a short chain fanning out', program: { chainLength: 4, fanOut: 2 }, doom: 7 },
    {
      name: 'an invalid step the chain never reaches',
      program: { chainLength: 3, fanOut: 1, invalidAt: 10 },
      doom: 3,
    },
  ])('finishes $name within the guard', ({ program, doom }) => {
    const { state } = execute(programContext(program), startedState(), placeDoomOnGhoul);

    expect(state.cards[ghoul]?.tokens.doom).toBe(doom);
    expect(checkInvariants(state)).toEqual([]);
  });

  it.each<{ name: string; program: Program; code: Rejection['code'] }>([
    {
      name: 'a single-file chain one past the limit',
      program: { chainLength: MAX_TRIGGERED_COMMANDS + 2, fanOut: 1 },
      code: 'triggerLoop',
    },
    {
      name: 'a chain fanning out beyond the limit',
      program: { chainLength: 2 * MAX_TRIGGERED_COMMANDS, fanOut: 3 },
      code: 'triggerLoop',
    },
    {
      name: 'a chain with an invalid step halfway',
      program: { chainLength: 10, fanOut: 1, invalidAt: 5 },
      code: 'triggeredCommandRejected',
    },
  ])('rejects $name and leaves the state unchanged', ({ program, code }) => {
    const state = startedState();
    const snapshot = structuredClone(state);

    const rejection = rejectionFrom(programContext(program), state, placeDoomOnGhoul);

    expect(rejection.code).toBe(code);
    expect(state).toEqual(snapshot);
  });
});
