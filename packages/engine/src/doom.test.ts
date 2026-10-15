import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkInvariants,
  doomInPlay,
  execute,
  instanceId,
  investigatorId,
  mapId,
  type Command,
  type Event,
  type GameState,
  type Investigator,
} from './index';
import {
  makeInvestigator as buildInvestigator,
  rejectionFrom,
  run,
  stateAfter,
  testContext,
} from '../test/utils';

const main = mapId('main');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const deckTreachery = instanceId('deckTreachery');
const agenda1 = instanceId('agenda1');
const agenda2 = instanceId('agenda2');
const act1 = instanceId('act1');
const act2 = instanceId('act2');
const alice = investigatorId('alice');
const bob = investigatorId('bob');

/** An investigator at the hall; `seat` defaults to 0, so multi-investigator tests set it. */
function makeInvestigator(
  overrides: Partial<Omit<Investigator, 'id'>> & { id: Investigator['id'] },
): Investigator {
  return buildInvestigator({ locationId: hall, ...overrides });
}

/**
 * Agenda 1 (A1, threshold 3 doom) then agenda 2 (A2, threshold 5); act 1 (C1,
 * 2 clues per investigator) then act 2 (C2, 3 per investigator). A ghoul at the
 * hall and a treachery in the encounter deck.
 */
function startedWith(investigators: Investigator[]): GameState {
  return run(testContext, [
    {
      type: 'StartScenario',
      scenarioId: 'test',
      difficulty: 'standard',
      seed: 1,
      investigators,
      maps: { [main]: { name: 'Main' } },
      cards: [
        { id: agenda1, code: 'A1', zone: { kind: 'agendaDeck' }, faceUp: true },
        { id: agenda2, code: 'A2', zone: { kind: 'agendaDeck' }, faceUp: true },
        { id: act1, code: 'C1', zone: { kind: 'actDeck' }, faceUp: true },
        { id: act2, code: 'C2', zone: { kind: 'actDeck' }, faceUp: true },
        { id: hall, code: 'L1', zone: { kind: 'location', mapId: main }, faceUp: true },
        { id: ghoul, code: 'E1', zone: { kind: 'atLocation', locationId: hall }, faceUp: true },
        { id: deckTreachery, code: 'E4', zone: { kind: 'encounterDeck' } },
      ],
    },
  ]).state;
}

function eventsOf(state: GameState, command: Command): Event[] {
  return execute(testContext, state, command).events;
}

describe('starting the scenario', () => {
  it('makes the top card of each deck current', () => {
    const state = startedWith([makeInvestigator({ id: alice })]);

    expect(state.agenda.current).toBe(agenda1);
    expect(state.act.current).toBe(act1);
  });
});

describe('PlaceDoom', () => {
  let state: GameState;
  beforeEach(() => {
    state = startedWith([makeInvestigator({ id: alice }), makeInvestigator({ id: bob, seat: 1 })]);
  });

  it('puts doom on the current agenda by default', () => {
    const next = stateAfter(testContext, state, { type: 'PlaceDoom', amount: 2 });

    expect(next.cards[agenda1]!.tokens.doom).toBe(2);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('puts doom on another card in play', () => {
    const next = stateAfter(testContext, state, { type: 'PlaceDoom', cardId: ghoul, amount: 1 });

    expect(next.cards[ghoul]!.tokens.doom).toBe(1);
  });

  it('rejects doom on a card that is not in play', () => {
    expect(
      rejectionFrom(testContext, state, { type: 'PlaceDoom', cardId: deckTreachery, amount: 1 }),
    ).toEqual({
      code: 'cardNotInPlay',
      cardId: deckTreachery,
    });
  });

  it('rejects doom on the agenda that is still waiting in the deck', () => {
    expect(
      rejectionFrom(testContext, state, { type: 'PlaceDoom', cardId: agenda2, amount: 1 }),
    ).toEqual({
      code: 'cardNotInPlay',
      cardId: agenda2,
    });
  });

  it('rejects an unknown card', () => {
    const missing = instanceId('missing');

    expect(
      rejectionFrom(testContext, state, { type: 'PlaceDoom', cardId: missing, amount: 1 }),
    ).toEqual({
      code: 'unknownCard',
      cardId: missing,
    });
  });

  it('rejects a zero or fractional amount', () => {
    expect(rejectionFrom(testContext, state, { type: 'PlaceDoom', amount: 0 }).code).toBe(
      'invalidTokenDelta',
    );
    expect(rejectionFrom(testContext, state, { type: 'PlaceDoom', amount: 1.5 }).code).toBe(
      'invalidTokenDelta',
    );
  });

  it('rejects doom once the agenda deck is used up', () => {
    const ended = stateAfter(
      testContext,
      state,
      { type: 'AdvanceAgenda' },
      { type: 'AdvanceAgenda', resolution: 'R1' },
    );

    expect(rejectionFrom(testContext, ended, { type: 'PlaceDoom', amount: 1 })).toEqual({
      code: 'noCurrentCard',
      deck: 'agenda',
    });
  });
});

/** Doom summed the long way: the current agenda, the hall and ghoul in play, then the counters. */
function expectedDoom(state: GameState): number {
  const onCard = (id: typeof hall): number => state.cards[id]!.tokens.doom ?? 0;
  const agenda = state.agenda.current === undefined ? 0 : onCard(state.agenda.current);
  const counters = state.investigators.reduce((sum, inv) => sum + inv.doomOnPlayerCards, 0);
  return agenda + onCard(hall) + onCard(ghoul) + counters;
}

const placeDoom = (cardId: typeof hall | undefined, amount: number): Command => ({
  type: 'PlaceDoom',
  ...(cardId === undefined ? {} : { cardId }),
  amount,
});
const playerCardDoom = (investigator: typeof alice, delta: number): Command => ({
  type: 'AdjustInvestigator',
  investigatorId: investigator,
  stat: 'doomOnPlayerCards',
  delta,
});
const manualDoom = (cardId: typeof hall, delta: number): Command => ({
  type: 'ManualAdjust',
  adjustment: { kind: 'tokens', cardId, token: 'doom', delta },
});

describe('doom total invariant', () => {
  it.each<{ name: string; commands: Command[]; total: number }>([
    { name: 'nothing placed', commands: [], total: 0 },
    { name: 'doom on the agenda only', commands: [placeDoom(undefined, 2)], total: 2 },
    {
      name: 'agenda, hall, ghoul and both counters',
      commands: [
        placeDoom(undefined, 1),
        placeDoom(hall, 2),
        placeDoom(ghoul, 3),
        playerCardDoom(alice, 1),
        playerCardDoom(bob, 2),
      ],
      total: 9,
    },
    {
      name: 'doom removed again',
      commands: [
        placeDoom(ghoul, 3),
        manualDoom(ghoul, -2),
        playerCardDoom(alice, 2),
        playerCardDoom(alice, -2),
      ],
      total: 1,
    },
    {
      name: 'manual doom on the waiting agenda and the encounter deck is not counted',
      commands: [manualDoom(agenda2, 2), manualDoom(deckTreachery, 3), placeDoom(ghoul, 1)],
      total: 1,
    },
    {
      name: 'an advancing agenda clears all doom',
      commands: [
        placeDoom(undefined, 1),
        placeDoom(hall, 2),
        playerCardDoom(bob, 2),
        { type: 'AdvanceAgenda' },
        placeDoom(undefined, 1),
      ],
      total: 1,
    },
  ])('equals agenda, cards in play and counters after $name', ({ commands, total }) => {
    const state = stateAfter(
      testContext,
      startedWith([makeInvestigator({ id: alice }), makeInvestigator({ id: bob, seat: 1 })]),
      ...commands,
    );

    expect(doomInPlay(state)).toBe(total);
    expect(doomInPlay(state)).toBe(expectedDoom(state));
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe('doom total', () => {
  it('adds agenda, other cards in play and investigators player-card doom', () => {
    let state = startedWith([
      makeInvestigator({ id: alice }),
      makeInvestigator({ id: bob, seat: 1 }),
    ]);

    state = stateAfter(
      testContext,
      state,
      { type: 'PlaceDoom', amount: 1 },
      { type: 'PlaceDoom', cardId: ghoul, amount: 1 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 2 },
    );

    expect(doomInPlay(state)).toBe(4);
  });

  it('ignores doom on cards outside play', () => {
    const state = stateAfter(
      testContext,
      startedWith([makeInvestigator({ id: alice })]),
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: deckTreachery, token: 'doom', delta: 2 },
      },
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: agenda2, token: 'doom', delta: 2 },
      },
    );

    expect(doomInPlay(state)).toBe(0);
  });

  it('ignores the player-card doom of a defeated investigator', () => {
    const state = stateAfter(
      testContext,
      startedWith([makeInvestigator({ id: alice, health: { max: 1, damage: 0 } })]),
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 2 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 1 },
    );

    expect(doomInPlay(state)).toBe(0);
  });
});

describe('threshold check', () => {
  let state: GameState;
  beforeEach(() => {
    state = startedWith([makeInvestigator({ id: alice })]);
  });

  it('stays silent below the threshold', () => {
    const next = stateAfter(testContext, state, { type: 'PlaceDoom', amount: 2 });

    expect(next.pending).toEqual([]);
  });

  it('asks whether to advance the agenda when doom reaches the threshold', () => {
    const next = stateAfter(testContext, state, { type: 'PlaceDoom', amount: 3 });

    expect(next.pending).toEqual([
      {
        id: 'advanceAgenda:agenda1',
        kind: 'advanceAgenda',
        subject: agenda1,
        prompt: 'decision.advanceAgenda',
        options: [
          { id: 'yes', label: 'decision.yes', target: agenda1 },
          { id: 'no', label: 'decision.no' },
        ],
      },
    ]);
    expect(next.cards[agenda1]!.faceUp).toBe(true);
  });

  it('counts doom on other cards and player cards towards the threshold', () => {
    const next = stateAfter(
      testContext,
      state,
      { type: 'PlaceDoom', cardId: ghoul, amount: 2 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 1 },
    );

    expect(next.pending.map((d) => d.kind)).toEqual(['advanceAgenda']);
  });

  it('does not ask again while the question is open', () => {
    const asked = stateAfter(testContext, state, { type: 'PlaceDoom', amount: 3 });

    const events = eventsOf(asked, { type: 'PlaceDoom', amount: 1 });

    expect(events.map((e) => e.type)).toEqual(['TokensChanged']);
  });

  it('removes player-card doom without asking', () => {
    const withDoom = stateAfter(testContext, state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'doomOnPlayerCards',
      delta: 2,
    });

    const events = eventsOf(withDoom, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'doomOnPlayerCards',
      delta: -1,
    });

    expect(events.map((e) => e.type)).toEqual(['InvestigatorChanged']);
  });

  it('rejects player-card doom below zero', () => {
    expect(
      rejectionFrom(testContext, state, {
        type: 'AdjustInvestigator',
        investigatorId: alice,
        stat: 'doomOnPlayerCards',
        delta: -1,
      }).code,
    ).toBe('negativeInvestigatorStat');
  });
});

describe('AdvanceAgenda', () => {
  let state: GameState;
  beforeEach(() => {
    state = stateAfter(
      testContext,
      startedWith([makeInvestigator({ id: alice })]),
      { type: 'PlaceDoom', amount: 2 },
      { type: 'PlaceDoom', cardId: ghoul, amount: 1 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 1 },
    );
  });

  it('flips the agenda, removes it from the game and makes the next one current', () => {
    const next = stateAfter(testContext, state, { type: 'AdvanceAgenda' });

    expect(next.agenda.current).toBe(agenda2);
    expect(next.cards[agenda1]!.faceUp).toBe(false);
    expect(next.cards[agenda1]!.zone).toEqual({ kind: 'outOfGame' });
    expect(checkInvariants(next)).toEqual([]);
  });

  it('removes all doom in play', () => {
    const next = stateAfter(testContext, state, { type: 'AdvanceAgenda' });

    expect(doomInPlay(next)).toBe(0);
    expect(next.cards[ghoul]!.tokens.doom).toBeUndefined();
    expect(next.investigators[0]!.doomOnPlayerCards).toBe(0);
  });

  it('drops the pending question about the old agenda', () => {
    const asked = stateAfter(testContext, state, { type: 'PlaceDoom', amount: 1 });

    const next = stateAfter(testContext, asked, { type: 'AdvanceAgenda' });

    expect(asked.pending).toHaveLength(1);
    expect(next.pending).toEqual([]);
  });

  it('does not end the scenario while another agenda follows', () => {
    const events = eventsOf(state, { type: 'AdvanceAgenda' });

    expect(events.map((e) => e.type)).not.toContain('ScenarioEnded');
  });

  it('ends the scenario with the resolution when the last agenda advances', () => {
    const lastAgenda = stateAfter(testContext, state, { type: 'AdvanceAgenda' });

    const ended = execute(testContext, lastAgenda, { type: 'AdvanceAgenda', resolution: 'R1' });

    expect(ended.events.at(-1)).toEqual({ type: 'ScenarioEnded', resolution: 'R1' });
    expect(ended.state.meta.resolution).toBe('R1');
    expect(ended.state.agenda.current).toBeUndefined();
  });

  it('rejects advancing the last agenda without a resolution', () => {
    const lastAgenda = stateAfter(testContext, state, { type: 'AdvanceAgenda' });

    expect(rejectionFrom(testContext, lastAgenda, { type: 'AdvanceAgenda' })).toEqual({
      code: 'resolutionRequired',
      deck: 'agenda',
    });
  });
});

describe('AdvanceAct', () => {
  let state: GameState;
  beforeEach(() => {
    state = stateAfter(
      testContext,
      startedWith([
        makeInvestigator({ id: alice, clues: 3 }),
        makeInvestigator({ id: bob, seat: 1, clues: 2 }),
      ]),
    );
  });

  it('charges the clues per investigator and makes the next act current', () => {
    const next = stateAfter(testContext, state, {
      type: 'AdvanceAct',
      spend: [
        { investigatorId: alice, amount: 3 },
        { investigatorId: bob, amount: 1 },
      ],
    });

    expect(next.investigators.map((inv) => inv.clues)).toEqual([0, 1]);
    expect(next.act.current).toBe(act2);
    expect(next.cards[act1]!.zone).toEqual({ kind: 'outOfGame' });
    expect(next.cards[act1]!.faceUp).toBe(false);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('keeps doom in play when an act advances', () => {
    const withDoom = stateAfter(testContext, state, { type: 'PlaceDoom', amount: 1 });

    const next = stateAfter(testContext, withDoom, {
      type: 'AdvanceAct',
      spend: [
        { investigatorId: alice, amount: 3 },
        { investigatorId: bob, amount: 1 },
      ],
    });

    expect(doomInPlay(next)).toBe(1);
  });

  it('rejects a total that differs from the requirement', () => {
    expect(
      rejectionFrom(testContext, state, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 3 }],
      }),
    ).toEqual({ code: 'wrongClueTotal', required: 4, spent: 3 });
  });

  it('rejects paying more clues than the investigator has', () => {
    expect(
      rejectionFrom(testContext, state, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: bob, amount: 4 }],
      }),
    ).toEqual({
      code: 'negativeInvestigatorStat',
      investigatorId: bob,
      stat: 'clues',
      current: 2,
      delta: -4,
    });
  });

  it('rejects the same investigator paying twice', () => {
    expect(
      rejectionFrom(testContext, state, {
        type: 'AdvanceAct',
        spend: [
          { investigatorId: alice, amount: 2 },
          { investigatorId: alice, amount: 1 },
        ],
      }).code,
    ).toBe('duplicateInvestigator');
  });

  it('rejects a payment of zero clues', () => {
    expect(
      rejectionFrom(testContext, state, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 0 }],
      }).code,
    ).toBe('invalidTokenDelta');
  });

  it('rejects payment from a defeated investigator', () => {
    const defeated = stateAfter(testContext, state, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'damage',
      delta: 8,
    });

    expect(
      rejectionFrom(testContext, defeated, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: bob, amount: 2 }],
      }).code,
    ).toBe('investigatorNotActive');
  });

  it('uses the starting player count after an investigator is defeated', () => {
    const defeated = stateAfter(testContext, state, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'damage',
      delta: 8,
    });

    expect(
      rejectionFrom(testContext, defeated, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 2 }],
      }),
    ).toEqual({ code: 'wrongClueTotal', required: 4, spent: 2 });
  });

  it('ends the scenario with the resolution when the last act advances', () => {
    const lastAct = stateAfter(testContext, state, {
      type: 'AdvanceAct',
      spend: [
        { investigatorId: alice, amount: 3 },
        { investigatorId: bob, amount: 1 },
      ],
    });
    const rich = stateAfter(testContext, lastAct, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'clues',
      delta: 5,
    });

    const ended = execute(testContext, rich, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: bob, amount: 6 }],
      resolution: 'R2',
    });

    expect(ended.events.at(-1)).toEqual({ type: 'ScenarioEnded', resolution: 'R2' });
    expect(ended.state.act.current).toBeUndefined();
  });

  it('rejects advancing the last act without a resolution', () => {
    const lastAct = stateAfter(
      testContext,
      state,
      {
        type: 'AdvanceAct',
        spend: [
          { investigatorId: alice, amount: 3 },
          { investigatorId: bob, amount: 1 },
        ],
      },
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'clues', delta: 5 },
    );

    expect(
      rejectionFrom(testContext, lastAct, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: bob, amount: 6 }],
      }),
    ).toEqual({ code: 'resolutionRequired', deck: 'act' });
  });

  it('rejects advancing once the act deck is used up', () => {
    const ended = stateAfter(
      testContext,
      state,
      {
        type: 'AdvanceAct',
        spend: [
          { investigatorId: alice, amount: 3 },
          { investigatorId: bob, amount: 1 },
        ],
      },
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'clues', delta: 5 },
      { type: 'AdvanceAct', spend: [{ investigatorId: bob, amount: 6 }], resolution: 'R2' },
    );

    expect(rejectionFrom(testContext, ended, { type: 'AdvanceAct', spend: [] })).toEqual({
      code: 'noCurrentCard',
      deck: 'act',
    });
  });
});
