import { describe, expect, it } from 'vitest';
import {
  atEndOfRound,
  atEndOfTurn,
  atLocation,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  discardSelf,
  execute,
  fixed,
  instanceId,
  investigatorId,
  mapId,
  MAX_TRIGGERED_COMMANDS,
  moveSelf,
  newGame,
  perInvestigator,
  placeDoomOnAgenda,
  placeDoomOnSelf,
  skillTest,
  takeHorror,
  threatAreaOf,
  whenRevealed,
  type Command,
  type EngineContext,
  type Rejection,
} from './index';
import { triggeredCommands } from './triggers';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

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

const placeDoomOnGhoul: Command = { type: 'PlaceDoom', cardId: ghoul, amount: 1 };
const advanceAct: Command = { type: 'AdvanceAct', spend: [{ investigatorId: alice, amount: 2 }] };

describe('trigger bus', () => {
  it('appends the events of an afterDoomPlaced follow-up to the originating command', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
      })
      .start();

    const { events } = execute(ctx, started, placeDoomOnGhoul);

    expect(events.map((event) => event.type)).toEqual([
      'TokensChanged',
      'CardFlipped',
      'TokensChanged',
    ]);
  });

  it('passes the triggering event to the hook', () => {
    const seen: unknown[] = [];
    const { context: ctx, state: started } = table
      .withHooks({
        afterDoomPlaced: (_ctx, _state, event) => {
          seen.push(event);
          return [];
        },
      })
      .start();

    execute(ctx, started, { type: 'PlaceDoom', cardId: ghoul, amount: 2 });

    expect(seen).toEqual([{ type: 'TokensChanged', cardId: ghoul, token: 'doom', delta: 2 }]);
  });

  it('does not fire forced effects for a manual correction', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
      })
      .start();

    const { events } = execute(ctx, started, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: ghoul, token: 'doom', delta: 1 },
    });

    expect(events.map((event) => event.type)).toEqual(['TokensChanged']);
  });

  it('runs the reverse side of the advancing agenda while it is still current', () => {
    const seen: unknown[] = [];
    const { context: ctx, state: started } = table
      .withHooks({
        onAgendaAdvance: {
          first_agenda: (_ctx, state) => {
            seen.push({ current: state.agenda.current, faceUp: state.cards[agenda1]?.faceUp });
            return [{ type: 'RevealLocation', locationId: cellar }];
          },
          second_agenda: () => [{ type: 'PlaceDoom', cardId: ghoul, amount: 1 }],
        },
      })
      .start();

    const { events, state } = execute(ctx, started, { type: 'AdvanceAgenda' });

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
    const { context: ctx, state: started } = table
      .withHooks({
        onAgendaAdvance: { first_agenda: () => [{ type: 'PlaceDoom', amount: 1 }] },
      })
      .start();

    const { state } = execute(ctx, started, { type: 'AdvanceAgenda' });

    expect(state.cards[agenda1]?.tokens.doom).toBe(1);
    expect(state.cards[agenda2]?.tokens.doom).toBeUndefined();
  });

  it('lets the reverse side of the last agenda end the scenario with its resolution', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        onAgendaAdvance: { second_agenda: () => [{ type: 'EndScenario', resolution: 'R2' }] },
      })
      .start();
    const lastAgenda = stateAfter(ctx, started, { type: 'AdvanceAgenda' });

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
    const { context: ctx, state: started } = table
      .withHooks({
        onAgendaAdvance: { second_agenda: () => [{ type: 'EndScenario', resolution: 'R2' }] },
      })
      .start();
    const lastAgenda = stateAfter(ctx, started, { type: 'AdvanceAgenda' });

    const { events, state } = execute(ctx, lastAgenda, { type: 'AdvanceAgenda', resolution: 'R1' });

    expect(events.filter((event) => event.type === 'ScenarioEnded')).toEqual([
      { type: 'ScenarioEnded', resolution: 'R2' },
    ]);
    expect(state.meta.resolution).toBe('R2');
  });

  it('runs the reverse side of the advancing act while it is still current', () => {
    const currentActs: unknown[] = [];
    const { context: ctx, state: started } = table
      .withHooks({
        onActAdvance: {
          first_act: (_ctx, state) => {
            currentActs.push(state.act.current);
            return [{ type: 'RevealLocation', locationId: cellar }];
          },
        },
      })
      .start();

    const { state } = execute(ctx, started, advanceAct);

    expect(currentActs).toEqual([act1]);
    expect(state.act.current).toBe(act2);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  describe('revealed abilities', () => {
    /**
     * The cellar's revealed ability places 1 doom on the agenda and deals 1
     * horror to whoever the window names; dooming_agenda has the same doom
     * ability. Alice stands next to the unrevealed cellar.
     */
    const doomingCellar = blankLocation('dooming_cellar', {
      abilities: [whenRevealed(placeDoomOnAgenda(1), takeHorror(1))],
    });
    const doomingAgenda = blankAgenda('dooming_agenda', fixed(3), {
      abilities: [whenRevealed(placeDoomOnAgenda(1))],
    });
    const revealTable = newGame()
      .withAgenda(instanceId('dooming_agenda'), doomingAgenda)
      .withAgenda(instanceId('second_agenda'), secondAgendaCard)
      .withLocation(hall, blankLocation('hall'), { revealed: true })
      .withLocation(cellar, doomingCellar)
      .withConnection(hall, cellar)
      .withInvestigator(alice, { locationId: hall });

    it('runs the abilities of a card turned face up', () => {
      const { context, state: started } = revealTable.start();

      const { state } = execute(context, started, { type: 'RevealLocation', locationId: cellar });

      expect(state.cards[instanceId('dooming_agenda')]?.tokens.doom).toBe(1);
    });

    it('places doom on the card itself when the ability names it', () => {
      const cursedCellar = blankLocation('cursed_cellar', {
        abilities: [whenRevealed(placeDoomOnSelf(1))],
      });
      const { context, state: started } = newGame()
        .withAgenda(instanceId('second_agenda'), secondAgendaCard)
        .withLocation(cellar, cursedCellar)
        .start();

      const { state } = execute(context, started, { type: 'RevealLocation', locationId: cellar });

      expect(state.cards[cellar]?.tokens.doom).toBe(1);
      expect(state.cards[instanceId('second_agenda')]?.tokens.doom).toBeUndefined();
    });

    it('resolves them within the move that revealed the location, naming no investigator', () => {
      const { context, state: started } = revealTable.start();

      const { state } = execute(context, started, {
        type: 'MoveInvestigator',
        investigatorId: alice,
        to: cellar,
      });

      expect(state.cards[instanceId('dooming_agenda')]?.tokens.doom).toBe(1);
      expect(state.investigators.find((inv) => inv.id === alice)?.sanity.horror).toBe(0);
      expect(checkInvariants(state)).toEqual([]);
    });

    it('drops an effect whose nested reference names nobody', () => {
      const clingingCellar = blankLocation('clinging_cellar', {
        abilities: [
          whenRevealed(
            moveSelf({ kind: 'threatArea', investigatorId: { ref: 'windowInvestigator' } }),
          ),
        ],
      });
      const { context, state: started } = newGame()
        .withLocation(cellar, clingingCellar)
        .withInvestigator(alice)
        .start();

      const { state } = execute(context, started, { type: 'RevealLocation', locationId: cellar });

      expect(state.cards[cellar]?.zone.kind).toBe('location');
    });

    it('does not run them when a card is turned face down', () => {
      const { context, state: started } = revealTable.start();

      const { events } = execute(context, started, { type: 'AdvanceAgenda' });

      // The flipped agenda leaves the game afterwards, so only the events show whether it placed doom.
      expect(events.filter((e) => e.type === 'TokensChanged' && e.delta > 0)).toEqual([]);
    });
  });

  describe('turn-end and round-end abilities', () => {
    const hauntingDread = instanceId('haunting_dread');
    /** A threat-area treachery: at the end of its holder's turn, willpower (3); a fail deals 1 horror. */
    const hauntingDreadCard = blankTreachery('haunting_dread', {
      abilities: [atEndOfTurn(skillTest('willpower', 3, { onFail: [takeHorror(1)] }))],
    });

    it.each([
      { result: 'pass', horror: 0 },
      { result: 'fail', horror: 1 },
    ])(
      '$result: the test outcome acts on the investigator whose turn ended',
      ({ result, horror }) => {
        const { context, state } = newGame()
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withInvestigator(alice, { locationId: hall })
          .withCard(hauntingDread, hauntingDreadCard, threatAreaOf(alice))
          .withTurnOf(alice)
          .start();

        const after = stateAfter(
          context,
          state,
          { type: 'EndTurn', investigatorId: alice },
          answer('test:haunting_dread', result),
        );

        expect(after.investigators.find((inv) => inv.id === alice)?.sanity.horror).toBe(horror);
      },
    );

    it('opens no turn-end window for a card outside the threat area', () => {
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(hauntingDread, hauntingDreadCard, atLocation(hall))
        .withTurnOf(alice)
        .start();

      const after = stateAfter(context, state, { type: 'EndTurn', investigatorId: alice });

      expect(after.pending).toEqual([]);
    });

    it('discards a card in play at the end of the round, with its tokens', () => {
      const fadingOmen = blankTreachery('fading_omen', {
        abilities: [atEndOfRound(discardSelf())],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withCard(instanceId('fading_omen'), fadingOmen, atLocation(hall), { tokens: { doom: 1 } })
        .start();

      const after = stateAfter(
        context,
        state,
        ...triggeredCommands(context, state, [{ type: 'RoundEnded', round: 1 }]),
      );

      expect(after.cards[instanceId('fading_omen')]).toMatchObject({
        zone: { kind: 'encounterDiscard' },
        tokens: {},
      });
    });

    it('drops a test at the end of the round, which names no investigator', () => {
      const testingOmen = blankTreachery('testing_omen', {
        abilities: [atEndOfRound(skillTest('willpower', 3, { onFail: [takeHorror(1)] }))],
      });
      const { context, state } = newGame()
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alice, { locationId: hall })
        .withCard(instanceId('testing_omen'), testingOmen, atLocation(hall))
        .start();

      expect(triggeredCommands(context, state, [{ type: 'RoundEnded', round: 1 }])).toEqual([]);
    });
  });

  it('resolves the forced effects a follow-up triggers within the same command', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        onActAdvance: { first_act: () => [placeDoomOnGhoul] },
        afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: cellar }],
      })
      .start();

    const { state } = execute(ctx, started, advanceAct);

    expect(state.cards[ghoul]?.tokens.doom).toBe(1);
    expect(state.cards[cellar]?.faceUp).toBe(true);
  });

  it('runs follow-ups through the full command handling, including a doom threshold check', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        onActAdvance: {
          first_act: () => [{ type: 'PlaceDoom', amount: 3 }, { type: 'CheckDoomThreshold' }],
        },
      })
      .start();

    const { state } = execute(ctx, started, advanceAct);

    expect(state.pending.map((decision) => decision.kind)).toEqual(['confirm']);
  });
});

describe('afterEnemyDefeated', () => {
  /** Advances the act (first to second) when the hall's ghoul is defeated, as "if this enemy is defeated, advance". */
  const advanceOnGhoulDefeat = table
    .withHooks({
      afterEnemyDefeated: (_ctx, _state, event) =>
        event.enemyId === ghoul ? [{ type: 'AdvanceAct' }] : [],
    })
    .context();

  it('runs the follow-up when the enemy the hook names is defeated', () => {
    const { state: started } = table.start();

    const { state } = execute(advanceOnGhoulDefeat, started, {
      type: 'DefeatEnemy',
      enemyId: ghoul,
    });

    expect(state.act.current).toBe(act2);
  });

  it('does nothing when another enemy is defeated', () => {
    const { state: started } = table.start();
    const withDeckGhoulInHall = stateAfter(advanceOnGhoulDefeat, started, {
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
    const { context: ctx, state: started } = table
      .withHooks({
        afterEnemyDefeated: (_ctx, state, event) => {
          seen.push(state.cards[event.enemyId]?.zone);
          return [];
        },
      })
      .start();

    execute(ctx, started, { type: 'DefeatEnemy', enemyId: ghoul });

    expect(seen).toEqual([{ kind: 'encounterDiscard' }]);
  });
});

describe('trigger bus failures', () => {
  it('rejects a chain that keeps re-triggering itself', () => {
    const { context: ctx, state: started } = table
      .withHooks({ afterDoomPlaced: () => [placeDoomOnGhoul] })
      .start();

    const rejection = rejectionFrom(ctx, started, placeDoomOnGhoul);

    expect(rejection).toEqual({ code: 'triggerLoop', limit: MAX_TRIGGERED_COMMANDS });
  });

  it('allows a chain of exactly the limit', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        afterDoomPlaced: (_ctx, state) =>
          (state.cards[ghoul]?.tokens.doom ?? 0) <= MAX_TRIGGERED_COMMANDS
            ? [placeDoomOnGhoul]
            : [],
      })
      .start();

    const { state } = execute(ctx, started, placeDoomOnGhoul);

    expect(state.cards[ghoul]?.tokens.doom).toBe(MAX_TRIGGERED_COMMANDS + 1);
  });

  it('rejects the originating command when a follow-up is invalid, naming its reason', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: hall }],
      })
      .start();

    const rejection = rejectionFrom(ctx, started, placeDoomOnGhoul);

    expect(rejection).toEqual({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
      reason: { code: 'alreadyRevealed', cardId: hall },
    });
  });

  it('reports the innermost rejected follow-up of a nested chain', () => {
    const { context: ctx, state: started } = table
      .withHooks({
        onActAdvance: { first_act: () => [placeDoomOnGhoul] },
        afterDoomPlaced: () => [{ type: 'RevealLocation', locationId: hall }],
      })
      .start();

    const rejection = rejectionFrom(ctx, started, advanceAct);

    expect(rejection).toMatchObject({
      code: 'triggeredCommandRejected',
      command: 'RevealLocation',
    });
  });
});

describe('onCardEnters', () => {
  it('fires for a card a MoveCard puts into play, but not for the same ManualAdjust move', () => {
    const entered: unknown[] = [];
    const { context: ctx, state: started } = table
      .withHooks({
        onCardEnters: (_ctx, _state, event) => {
          entered.push(event.cardId);
          return [];
        },
      })
      .start();
    const to = atLocation(hall);

    execute(ctx, started, { type: 'MoveCard', cardId: deckGhoul, to });
    execute(ctx, started, {
      type: 'ManualAdjust',
      adjustment: { kind: 'moveCard', cardId: deckGhoul, to },
    });

    expect(entered).toEqual([deckGhoul]);
  });

  it('fires for each location an AddMap puts into play', () => {
    const entered: unknown[] = [];
    const { context: ctx, state: started } = table
      .withHooks({
        onCardEnters: (_ctx, _state, event) => {
          entered.push(event.cardId);
          return [];
        },
      })
      .start();

    execute(ctx, started, {
      type: 'AddMap',
      mapId: mapId('vault'),
      map: { name: 'Vault' },
      locations: [crypt],
    });

    expect(entered).toEqual([crypt]);
  });

  it('fires when a card moves from outside play onto the board', () => {
    const { context: ctx, state: started } = table
      .withHooks({ onCardEnters: () => [{ type: 'RevealLocation', locationId: cellar }] })
      .start();

    const commands = triggeredCommands(ctx, started, [
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
    const { context: ctx, state: started } = table
      .withHooks({ onCardEnters: () => [{ type: 'RevealLocation', locationId: cellar }] })
      .start();

    const commands = triggeredCommands(ctx, started, [
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
  return table
    .withHooks({
      afterDoomPlaced: (_ctx, state) => {
        const doom = state.cards[ghoul]?.tokens.doom ?? 0;
        if (doom === invalidAt) return [{ type: 'RevealLocation', locationId: hall }];
        return doom < chainLength ? Array.from({ length: fanOut }, () => placeDoomOnGhoul) : [];
      },
    })
    .context();
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
    const { state: started } = table.start();

    const { state } = execute(programContext(program), started, placeDoomOnGhoul);

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
    const { state } = table.start();
    const snapshot = structuredClone(state);

    const rejection = rejectionFrom(programContext(program), state, placeDoomOnGhoul);

    expect(rejection.code).toBe(code);
    expect(state).toEqual(snapshot);
  });
});
