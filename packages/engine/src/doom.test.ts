import { describe, expect, it } from 'vitest';
import {
  resolutionId,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  decisionId,
  doomInPlay,
  endScenario,
  engagedWith,
  execute,
  apply,
  fixed,
  instanceId,
  investigatorId,
  leadDecides,
  newGame,
  perInvestigator,
  whenAdvanced,
  type Command,
  type EngineContext,
  type Event,
  type GameState,
  type InstanceId,
} from './index';
import { requireInvestigator } from './investigators';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const deckTreachery = instanceId('deckTreachery');
const agenda1 = instanceId('agenda1');
const agenda2 = instanceId('agenda2');
const act1 = instanceId('act1');
const act2 = instanceId('act2');
const alice = investigatorId('alice');
const bob = investigatorId('bob');

/** The first agenda advances at 3 doom, the second (and last) at 5. */
const firstAgendaCard = blankAgenda('first_agenda', fixed(3));
const secondAgendaCard = blankAgenda('second_agenda', fixed(5), { stage: { number: 2 } });
/** The first act takes 2 clues per investigator, the second (and last) 3 per investigator. */
const firstActCard = blankAct('first_act', { clues: perInvestigator(2) });
const secondActCard = blankAct('second_act', { stage: { number: 2 }, clues: perInvestigator(3) });
const hallCard = blankLocation('hall');
const ghoulCard = blankEnemy('ghoul');
const treacheryCard = blankTreachery('treachery');

/**
 * Agenda 1 then agenda 2, act 1 then act 2, the hall, a ghoul engaged with
 * alice (so a second investigator at the hall causes no engagement decision)
 * and a treachery in the encounter deck; without investigators.
 */
const doomTable = newGame()
  .withAgenda(agenda1, firstAgendaCard)
  .withAgenda(agenda2, secondAgendaCard)
  .withAct(act1, firstActCard)
  .withAct(act2, secondActCard)
  .withLocation(hall, hallCard, { revealed: true })
  .withCard(ghoul, ghoulCard, engagedWith(alice), { faceUp: true })
  .withCard(deckTreachery, treacheryCard, { kind: 'encounterDeck' });

/** The doom table with alice (seat 0) alone in the hall. */
const aliceAlone = doomTable.withInvestigator(alice, { locationId: hall });

/** The doom table with alice (seat 0) and bob (seat 1) in the hall. */
const aliceAndBob = aliceAlone.withInvestigator(bob, { locationId: hall });

function eventsOf(context: EngineContext, state: GameState, command: Command): Event[] {
  return execute(context, state, command).events;
}

describe('starting the scenario', () => {
  it('makes the top card of each deck current', () => {
    const { state } = aliceAlone.start();

    expect(state.agenda.current).toBe(agenda1);
    expect(state.act.current).toBe(act1);
  });
});

describe('PlaceDoom', () => {
  const { context, state } = aliceAndBob.start();

  it('puts doom on the current agenda by default', () => {
    const next = stateAfter(context, state, { type: 'PlaceDoom', amount: 2 });

    expect(next.cards[agenda1]!.tokens.doom).toBe(2);
    expect(checkInvariants(next)).toEqual([]);
  });

  it('puts doom on another card in play', () => {
    const next = stateAfter(context, state, { type: 'PlaceDoom', cardId: ghoul, amount: 1 });

    expect(next.cards[ghoul]!.tokens.doom).toBe(1);
  });

  it('rejects doom on a card that is not in play', () => {
    expect(
      rejectionFrom(context, state, { type: 'PlaceDoom', cardId: deckTreachery, amount: 1 }),
    ).toEqual({
      code: 'cardNotInPlay',
      cardId: deckTreachery,
    });
  });

  it('rejects doom on the agenda that is still waiting in the deck', () => {
    expect(
      rejectionFrom(context, state, { type: 'PlaceDoom', cardId: agenda2, amount: 1 }),
    ).toEqual({
      code: 'cardNotInPlay',
      cardId: agenda2,
    });
  });

  it('rejects an unknown card', () => {
    const missing = instanceId('missing');

    expect(
      rejectionFrom(context, state, { type: 'PlaceDoom', cardId: missing, amount: 1 }),
    ).toEqual({
      code: 'unknownCard',
      cardId: missing,
    });
  });

  it('rejects a zero or fractional amount', () => {
    expect(rejectionFrom(context, state, { type: 'PlaceDoom', amount: 0 }).code).toBe(
      'invalidTokenDelta',
    );
    expect(rejectionFrom(context, state, { type: 'PlaceDoom', amount: 1.5 }).code).toBe(
      'invalidTokenDelta',
    );
  });

  it('rejects doom once the last agenda has ended the scenario', () => {
    const ended = stateAfter(
      context,
      state,
      { type: 'AdvanceAgenda' },
      { type: 'AdvanceAgenda', resolution: resolutionId('R1') },
    );

    expect(rejectionFrom(context, ended, { type: 'PlaceDoom', amount: 1 })).toEqual({
      code: 'scenarioEnded',
      command: 'PlaceDoom',
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

describe('PlaceTokens', () => {
  const { context, state } = aliceAlone.start();

  it('puts clues from the pool on the current act', () => {
    const next = stateAfter(context, state, {
      type: 'PlaceTokens',
      cardId: act1,
      token: 'clue',
      amount: 1,
    });

    expect(next.cards[act1]!.tokens.clue).toBe(1);
    expect(requireInvestigator(next, alice).clues).toBe(0);
  });

  it.each([
    { name: 'the act still waiting in the deck', cardId: act2, amount: 1, code: 'cardNotInPlay' },
    { name: 'the current act', cardId: act1, amount: 0, code: 'invalidTokenDelta' },
  ])('rejects $amount clues on $name', ({ cardId, amount, code }) => {
    expect(
      rejectionFrom(context, state, { type: 'PlaceTokens', cardId, token: 'clue', amount }).code,
    ).toBe(code);
  });
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
    const { context, state: started } = aliceAndBob.start();
    const state = stateAfter(context, started, ...commands);

    expect(doomInPlay(state)).toBe(total);
    expect(doomInPlay(state)).toBe(expectedDoom(state));
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe('doom total', () => {
  it('adds agenda, other cards in play and investigators player-card doom', () => {
    const { context, state: started } = aliceAndBob.start();

    const state = stateAfter(
      context,
      started,
      { type: 'PlaceDoom', amount: 1 },
      { type: 'PlaceDoom', cardId: ghoul, amount: 1 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 2 },
    );

    expect(doomInPlay(state)).toBe(4);
  });

  it('ignores doom on cards outside play', () => {
    const { context, state: started } = aliceAlone.start();
    const state = stateAfter(
      context,
      started,
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
    const { context, state: started } = doomTable
      .withInvestigator(alice, { locationId: hall, health: { max: 1, damage: 0 } })
      .start();
    const state = stateAfter(
      context,
      started,
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 2 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'damage', delta: 1 },
    );

    expect(doomInPlay(state)).toBe(0);
  });
});

describe('threshold check', () => {
  const { context, state } = aliceAlone.start();

  it('stays silent below the threshold', () => {
    const next = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 2 },
      { type: 'CheckDoomThreshold' },
    );

    expect(next.pending).toEqual([]);
  });

  it('does not ask when doom reaches the threshold outside a check', () => {
    const next = stateAfter(context, state, { type: 'PlaceDoom', amount: 3 });

    expect(next.pending).toEqual([]);
  });

  it('asks to advance the agenda when a check finds the threshold reached', () => {
    const next = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 3 },
      { type: 'CheckDoomThreshold' },
    );

    expect(next.pending).toEqual([
      {
        id: 'advanceAgenda:agenda1',
        kind: 'confirm',
        subject: agenda1,
        prompt: 'decision.advanceAgenda',
        decider: { kind: 'group' },
        options: [
          {
            id: 'yes',
            label: 'decision.yes',
            target: agenda1,
            commands: [{ type: 'AdvanceAgenda' }],
          },
          { id: 'no', label: 'decision.no', commands: [] },
        ],
      },
    ]);
    expect(next.cards[agenda1]!.faceUp).toBe(true);
  });

  it('counts doom on other cards and player cards towards the threshold', () => {
    const next = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', cardId: ghoul, amount: 2 },
      { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 1 },
      { type: 'CheckDoomThreshold' },
    );

    expect(next.pending.map((d) => d.kind)).toEqual(['confirm']);
  });

  it('rejects more doom while the question is open', () => {
    const asked = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 3 },
      { type: 'CheckDoomThreshold' },
    );

    const rejection = rejectionFrom(context, asked, { type: 'PlaceDoom', amount: 1 });

    expect(rejection).toEqual({
      code: 'decisionPending',
      decisionId: decisionId('advanceAgenda:agenda1'),
    });
  });

  it('asks again at the next check after the question was declined', () => {
    const declined = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 3 },
      { type: 'CheckDoomThreshold' },
      answer('advanceAgenda:agenda1', 'no'),
    );

    const next = stateAfter(context, declined, { type: 'CheckDoomThreshold' });

    expect(declined.pending).toEqual([]);
    expect(next.pending.map((d) => d.id)).toEqual(['advanceAgenda:agenda1']);
  });

  it('advances the agenda when the question is answered yes', () => {
    const asked = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 3 },
      { type: 'CheckDoomThreshold' },
    );

    const next = stateAfter(context, asked, answer('advanceAgenda:agenda1', 'yes'));

    expect(next.pending).toEqual([]);
    expect(next.agenda.current).toBe(agenda2);
  });

  it('leaves the agenda alone when the question is answered no', () => {
    const asked = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 3 },
      { type: 'CheckDoomThreshold' },
    );

    const next = stateAfter(context, asked, answer('advanceAgenda:agenda1', 'no'));

    expect(next.pending).toEqual([]);
    expect(next.agenda.current).toBe(agenda1);
  });

  it('removes player-card doom without asking', () => {
    const withDoom = stateAfter(context, state, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'doomOnPlayerCards',
      delta: 2,
    });

    const events = eventsOf(context, withDoom, {
      type: 'AdjustInvestigator',
      investigatorId: alice,
      stat: 'doomOnPlayerCards',
      delta: -1,
    });

    expect(events.map((e) => e.type)).toEqual(['InvestigatorChanged']);
  });

  it('rejects player-card doom below zero', () => {
    expect(
      rejectionFrom(context, state, {
        type: 'AdjustInvestigator',
        investigatorId: alice,
        stat: 'doomOnPlayerCards',
        delta: -1,
      }).code,
    ).toBe('negativeInvestigatorStat');
  });
});

describe('AdvanceAgenda', () => {
  const { context, state: started } = aliceAlone.start();
  const state = stateAfter(
    context,
    started,
    { type: 'PlaceDoom', amount: 2 },
    { type: 'PlaceDoom', cardId: ghoul, amount: 1 },
    { type: 'AdjustInvestigator', investigatorId: alice, stat: 'doomOnPlayerCards', delta: 1 },
  );

  it('flips the agenda, removes it from the game and makes the next one current', () => {
    const next = stateAfter(context, state, { type: 'AdvanceAgenda' });

    expect(next.agenda.current).toBe(agenda2);
    expect(next.cards[agenda1]!.faceUp).toBe(false);
    expect(next.cards[agenda1]!.zone).toEqual({ kind: 'outOfGame' });
    expect(checkInvariants(next)).toEqual([]);
  });

  it('removes all doom in play', () => {
    const next = stateAfter(context, state, { type: 'AdvanceAgenda' });

    expect(doomInPlay(next)).toBe(0);
    expect(next.cards[ghoul]!.tokens.doom).toBeUndefined();
    expect(requireInvestigator(next, alice).doomOnPlayerCards).toBe(0);
  });

  it('drops the pending question about the old agenda', () => {
    const asked = stateAfter(context, state, { type: 'CheckDoomThreshold' });

    const next = apply(asked, { type: 'AgendaAdvanced', cardId: agenda1 });

    expect(asked.pending).toHaveLength(1);
    expect(next.pending).toEqual([]);
  });

  it('does not end the scenario while another agenda follows', () => {
    const events = eventsOf(context, state, { type: 'AdvanceAgenda' });

    expect(events.map((e) => e.type)).not.toContain('ScenarioEnded');
  });

  it('ends the scenario with the resolution when the last agenda advances', () => {
    const lastAgenda = stateAfter(context, state, { type: 'AdvanceAgenda' });

    const ended = execute(context, lastAgenda, {
      type: 'AdvanceAgenda',
      resolution: resolutionId('R1'),
    });

    expect(ended.events.at(-1)).toEqual({ type: 'ScenarioEnded', resolution: resolutionId('R1') });
    expect(ended.state.meta.resolution).toBe('R1');
    expect(ended.state.agenda.current).toBeUndefined();
  });

  it('rejects advancing the last agenda without a resolution', () => {
    const lastAgenda = stateAfter(context, state, { type: 'AdvanceAgenda' });

    expect(rejectionFrom(context, lastAgenda, { type: 'AdvanceAgenda' })).toEqual({
      code: 'resolutionRequired',
      deck: 'agenda',
    });
  });

  it('rejects a resolution while another agenda follows', () => {
    expect(
      rejectionFrom(context, state, { type: 'AdvanceAgenda', resolution: resolutionId('R1') }),
    ).toEqual({
      code: 'unexpectedResolution',
      deck: 'agenda',
    });
  });
});

describe('AdvanceAct', () => {
  const { context, state } = doomTable
    .withInvestigator(alice, { locationId: hall, clues: 3 })
    .withInvestigator(bob, { locationId: hall, clues: 2 })
    .start();

  it('charges the clues per investigator and makes the next act current', () => {
    const next = stateAfter(context, state, {
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
    const withDoom = stateAfter(context, state, { type: 'PlaceDoom', amount: 1 });

    const next = stateAfter(context, withDoom, {
      type: 'AdvanceAct',
      spend: [
        { investigatorId: alice, amount: 3 },
        { investigatorId: bob, amount: 1 },
      ],
    });

    expect(doomInPlay(next)).toBe(1);
  });

  it('counts clues on the act towards its requirement, so the investigators pay the rest', () => {
    const oneOnTheAct = stateAfter(context, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: act1, token: 'clue', delta: 1 },
    });

    const next = stateAfter(context, oneOnTheAct, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: alice, amount: 3 }],
    });

    expect(next.investigators.map((inv) => inv.clues)).toEqual([0, 2]);
    expect(next.act.current).toBe(act2);
    expect(next.cards[act1]!.tokens.clue).toBeUndefined();
    expect(checkInvariants(next)).toEqual([]);
  });

  it('advances with no payment once the act holds all the clues it needs', () => {
    const allOnTheAct = stateAfter(context, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: act1, token: 'clue', delta: 4 },
    });

    const next = stateAfter(context, allOnTheAct, { type: 'AdvanceAct', spend: [] });

    expect(next.investigators.map((inv) => inv.clues)).toEqual([3, 2]);
    expect(next.act.current).toBe(act2);
    expect(next.cards[act1]!.tokens.clue).toBeUndefined();
  });

  it('rejects a payment once the act holds more clues than it needs', () => {
    const fiveOnTheAct = stateAfter(context, state, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: act1, token: 'clue', delta: 5 },
    });

    expect(
      rejectionFrom(context, fiveOnTheAct, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 1 }],
      }),
    ).toEqual({ code: 'wrongClueTotal', required: 0, spent: 1 });
  });

  it('rejects a total that differs from the requirement', () => {
    expect(
      rejectionFrom(context, state, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 3 }],
      }),
    ).toEqual({ code: 'wrongClueTotal', required: 4, spent: 3 });
  });

  it('rejects paying more clues than the investigator has', () => {
    expect(
      rejectionFrom(context, state, {
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
      rejectionFrom(context, state, {
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
      rejectionFrom(context, state, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 0 }],
      }).code,
    ).toBe('invalidTokenDelta');
  });

  it('rejects payment from a defeated investigator', () => {
    const defeated = stateAfter(context, state, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'damage',
      delta: 8,
    });

    expect(
      rejectionFrom(context, defeated, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: bob, amount: 2 }],
      }).code,
    ).toBe('investigatorNotActive');
  });

  it('uses the starting player count after an investigator is defeated', () => {
    const defeated = stateAfter(context, state, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'damage',
      delta: 8,
    });

    expect(
      rejectionFrom(context, defeated, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 2 }],
      }),
    ).toEqual({ code: 'wrongClueTotal', required: 4, spent: 2 });
  });

  it('ends the scenario with the resolution when the last act advances', () => {
    const lastAct = stateAfter(context, state, {
      type: 'AdvanceAct',
      spend: [
        { investigatorId: alice, amount: 3 },
        { investigatorId: bob, amount: 1 },
      ],
    });
    const rich = stateAfter(context, lastAct, {
      type: 'AdjustInvestigator',
      investigatorId: bob,
      stat: 'clues',
      delta: 5,
    });

    const ended = execute(context, rich, {
      type: 'AdvanceAct',
      spend: [{ investigatorId: bob, amount: 6 }],
      resolution: resolutionId('R2'),
    });

    expect(ended.events.at(-1)).toEqual({ type: 'ScenarioEnded', resolution: resolutionId('R2') });
    expect(ended.state.act.current).toBeUndefined();
  });

  it('rejects advancing the last act without a resolution', () => {
    const lastAct = stateAfter(
      context,
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
      rejectionFrom(context, lastAct, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: bob, amount: 6 }],
      }),
    ).toEqual({ code: 'resolutionRequired', deck: 'act' });
  });

  it('rejects a resolution while another act follows', () => {
    expect(
      rejectionFrom(context, state, {
        type: 'AdvanceAct',
        spend: [
          { investigatorId: alice, amount: 3 },
          { investigatorId: bob, amount: 1 },
        ],
        resolution: resolutionId('R2'),
      }),
    ).toEqual({ code: 'unexpectedResolution', deck: 'act' });
  });

  it('rejects advancing once the last act has ended the scenario', () => {
    const ended = stateAfter(
      context,
      state,
      {
        type: 'AdvanceAct',
        spend: [
          { investigatorId: alice, amount: 3 },
          { investigatorId: bob, amount: 1 },
        ],
      },
      { type: 'AdjustInvestigator', investigatorId: bob, stat: 'clues', delta: 5 },
      {
        type: 'AdvanceAct',
        spend: [{ investigatorId: bob, amount: 6 }],
        resolution: resolutionId('R2'),
      },
    );

    expect(rejectionFrom(context, ended, { type: 'AdvanceAct', spend: [] })).toEqual({
      code: 'scenarioEnded',
      command: 'AdvanceAct',
    });
  });
});

describe('a last act whose reverse side lets the lead investigator choose the resolution', () => {
  const chooseResolution = decisionId('chooseResolution');
  /** The last act's reverse side asks "R1 or R2?"; each answer ends the scenario. */
  const choosingAct = blankAct('choosing_act', {
    stage: { number: 2 },
    abilities: [
      whenAdvanced(
        leadDecides(chooseResolution, 'burn the house?', [
          { id: 'burn', label: 'burn it', effects: [endScenario(resolutionId('R1'))] },
          { id: 'spare', label: 'spare it', effects: [endScenario(resolutionId('R2'))] },
        ]),
      ),
    ],
  });
  /** Act 1, then the choosing act, with alice in the hall. */
  const { context: choosingContext, state } = newGame()
    .withAct(act1, firstActCard)
    .withAct(act2, choosingAct)
    .withLocation(hall, hallCard, { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .start();
  const lastAct = () =>
    stateAfter(choosingContext, state, {
      type: 'AdvanceAct',
    });

  it('keeps the last act in play while the question is open instead of asking for a resolution', () => {
    const asked = stateAfter(choosingContext, lastAct(), { type: 'AdvanceAct' });

    expect(asked.act.current).toBe(act2);
    expect(asked.meta.ended).toBeUndefined();
    expect(asked.pending.map((decision) => decision.id)).toEqual([chooseResolution]);
  });

  it('ends the scenario with the resolution the lead investigator picks', () => {
    const asked = stateAfter(choosingContext, lastAct(), { type: 'AdvanceAct' });

    const ended = stateAfter(choosingContext, asked, answer(chooseResolution, 'spare'));

    expect(ended.meta).toMatchObject({ ended: true, resolution: resolutionId('R2') });
    expect(ended.act.current).toBeUndefined();
  });

  it('ignores a fallback resolution while the question is open', () => {
    const { events } = execute(choosingContext, lastAct(), {
      type: 'AdvanceAct',
      resolution: resolutionId('R3'),
    });

    expect(events.map((event) => event.type)).not.toContain('ScenarioEnded');
  });
});

describe('a last act whose reverse side asks something that names no resolution', () => {
  const whoPays = decisionId('who_pays');
  /** The last act's reverse side only asks a question; the resolution comes from the command. */
  const askingAct = blankAct('asking_act', {
    stage: { number: 2 },
    abilities: [
      whenAdvanced(
        leadDecides(whoPays, 'take a horror?', [{ id: 'yes', label: 'yes', effects: [] }]),
      ),
    ],
  });
  /** Act 1, then the asking act, with alice in the hall. */
  const { context: askingContext, state } = newGame()
    .withAct(act1, firstActCard)
    .withAct(act2, askingAct)
    .withLocation(hall, hallCard, { revealed: true })
    .withInvestigator(alice, { locationId: hall })
    .start();

  it('ends the scenario with the fallback resolution once the question is answered', () => {
    const lastAct = stateAfter(askingContext, state, { type: 'AdvanceAct' });
    const asked = stateAfter(askingContext, lastAct, {
      type: 'AdvanceAct',
      resolution: resolutionId('R3'),
    });

    const answered = stateAfter(askingContext, asked, answer(whoPays, 'yes'));

    expect(asked.meta.ended).toBeUndefined();
    expect(answered.meta).toMatchObject({ ended: true, resolution: resolutionId('R3') });
  });
});

describe('advancing an act without paying clues', () => {
  it('advances an act that has a clue threshold when no clues are paid', () => {
    const { context, state } = doomTable
      .withInvestigator(alice, { locationId: hall, clues: 3 })
      .start();

    const next = stateAfter(context, state, { type: 'AdvanceAct' });

    expect(next.act.current).toBe(act2);
    expect(requireInvestigator(next, alice).clues).toBe(3);
  });

  it('emits no payment events when no clues are paid', () => {
    const { context, state } = doomTable
      .withInvestigator(alice, { locationId: hall, clues: 3 })
      .start();

    expect(eventsOf(context, state, { type: 'AdvanceAct' }).map((event) => event.type)).toEqual([
      'CardFlipped',
      'ActAdvanced',
      'CardMoved',
      'CurrentCardChanged',
    ]);
  });
});

describe('cards without a threshold', () => {
  const plainAgenda = instanceId('plainAgenda');
  const plainAct = instanceId('plainAct');
  const nextAct = instanceId('nextAct');
  /** An agenda without a printed doom threshold. */
  const plainAgendaCard = blankAgenda('plain_agenda', null);
  /** Two acts without a printed clue threshold. */
  const plainActCard = blankAct('plain_act', { clues: undefined });
  const nextActCard = blankAct('next_act', { stage: { number: 2 }, clues: undefined });
  const { context, state } = newGame()
    .withAgenda(plainAgenda, plainAgendaCard)
    .withAct(plainAct, plainActCard)
    .withAct(nextAct, nextActCard)
    .withLocation(hall, hallCard, { revealed: true })
    .withInvestigator(alice, { locationId: hall, clues: 3 })
    .start();

  it('never asks to advance an agenda that has no doom threshold', () => {
    const next = stateAfter(
      context,
      state,
      { type: 'PlaceDoom', amount: 50 },
      { type: 'CheckDoomThreshold' },
    );

    expect(next.pending).toEqual([]);
  });

  it('advances an act without a clue threshold when no clues are paid', () => {
    const next = stateAfter(context, state, { type: 'AdvanceAct' });

    expect(next.act.current).toBe(nextAct);
  });

  it('rejects paying clues for an act without a clue threshold', () => {
    expect(
      rejectionFrom(context, state, {
        type: 'AdvanceAct',
        spend: [{ investigatorId: alice, amount: 1 }],
      }),
    ).toEqual({ code: 'noClueThreshold', cardId: plainAct });
  });

  it('rejects an empty payment for an act without a clue threshold', () => {
    expect(rejectionFrom(context, state, { type: 'AdvanceAct', spend: [] })).toEqual({
      code: 'noClueThreshold',
      cardId: plainAct,
    });
  });
});

describe('manual doom corrections', () => {
  const { context, state: aliceAloneState } = aliceAlone.start();

  it.each([
    { name: 'reaches the threshold of 3', doom: 3, pending: ['advanceAgenda:agenda1'] },
    { name: 'stays below the threshold', doom: 2, pending: [] },
  ])('ask to advance the agenda only when the doom $name', ({ doom, pending }) => {
    const corrected = stateAfter(context, aliceAloneState, manualDoom(ghoul, doom));

    expect(corrected.pending.map((decision) => decision.id)).toEqual(pending);
    expect(corrected.agenda.current).toBe(agenda1);
  });

  it('do not ask once the scenario has ended', () => {
    const ended = stateAfter(context, aliceAloneState, {
      type: 'EndScenario',
      resolution: resolutionId('R1'),
    });

    expect(stateAfter(context, ended, manualDoom(ghoul, 3)).pending).toEqual([]);
  });

  it('do not ask again when doom is taken off above the threshold', () => {
    const answered = stateAfter(
      context,
      aliceAloneState,
      manualDoom(ghoul, 4),
      answer('advanceAgenda:agenda1', 'no'),
    );

    expect(stateAfter(context, answered, manualDoom(ghoul, -1)).pending).toEqual([]);
  });
});

describe('manual moves of agenda and act cards', () => {
  const { context, state } = aliceAlone.start();
  const removeFromGame = (cardId: InstanceId): Command => ({
    type: 'ManualAdjust',
    adjustment: { kind: 'moveCard', cardId, to: { kind: 'outOfGame' } },
  });

  it.each([
    { name: 'agenda', cardId: agenda1 },
    { name: 'act', cardId: act1 },
  ] as const)('reject moving the current $name', ({ name, cardId }) => {
    expect(rejectionFrom(context, state, removeFromGame(cardId))).toEqual({
      code: 'currentStageCard',
      cardId,
      deck: name,
    });
  });

  it('allow moving a later agenda', () => {
    const moved = stateAfter(context, state, removeFromGame(agenda2));

    expect(moved.cards[agenda2]!.zone).toEqual({ kind: 'outOfGame' });
    expect(checkInvariants(moved)).toEqual([]);
  });
});
