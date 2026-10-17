import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  decisionId,
  describeDecision,
  execute,
  instanceId,
  investigatorId,
  playerOrder,
  zoneKey,
  type Command,
  type GameState,
  type InvestigatorId,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  investigatorOf,
  makeCard,
  makeInvestigator,
  perInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const carol = investigatorId('carol');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const aliceGhoul = instanceId('alice_ghoul');
const bobGhoul = instanceId('bob_ghoul');
const frozenInFear = instanceId('frozen_in_fear');

const ctx = contextWith(
  makeCard({ code: 'hall', typeCode: 'location' }),
  makeCard({ code: 'cellar', typeCode: 'location' }),
  makeCard({
    code: 'ghoul',
    typeCode: 'enemy',
    health: perInvestigator(2),
    damage: 1,
    horror: 1,
  }),
  makeCard({ code: 'frozen_in_fear', typeCode: 'treachery' }),
);

const nextPhase: Command = { type: 'NextPhase' };
const startTurn = (investigator: InvestigatorId): Command => ({
  type: 'StartTurn',
  investigatorId: investigator,
});
const endTurn = (investigator: InvestigatorId): Command => ({
  type: 'EndTurn',
  investigatorId: investigator,
});
const resign = (investigator: InvestigatorId): Command => ({
  type: 'Resign',
  investigatorId: investigator,
});
const takeDamage = (investigator: InvestigatorId, delta: number): Command => ({
  type: 'AdjustInvestigator',
  investigatorId: investigator,
  stat: 'damage',
  delta,
});
const defeat = (investigator: InvestigatorId): Command => ({
  type: 'DefeatInvestigator',
  investigatorId: investigator,
});
const takeHorror = (investigator: InvestigatorId, delta: number): Command => ({
  type: 'AdjustInvestigator',
  investigatorId: investigator,
  stat: 'horror',
  delta,
});

/** The group's answer to "who is the new lead investigator?". */
const chooseLead = (investigator: InvestigatorId): Command => ({
  type: 'ResolveDecision',
  decisionId: decisionId('newLeadInvestigator'),
  optionId: investigator,
});

const at = (locationId: typeof hall): Zone => ({ kind: 'atLocation', locationId });
const engagedWith = (investigator: InvestigatorId): Zone => ({
  kind: 'engaged',
  investigatorId: investigator,
});
const threatAreaOf = (investigator: InvestigatorId): Zone => ({
  kind: 'threatArea',
  investigatorId: investigator,
});

function placed(id: typeof hall, code: string, zone: Zone, tokens = {}): StartingCard {
  return { id, code, zone, tokens };
}

/** Ids of the cards in `zone`, top first. */
function idsIn(state: GameState, zone: Zone): string[] {
  return state.order[zoneKey(zone)] ?? [];
}

/**
 * Hall - cellar. Alice (seat 0, the lead) and bob (seat 1) are in the hall,
 * carol (seat 2) in the cellar. Alice holds 2 clues, has a ghoul with 1 damage
 * engaged and Frozen in Fear with 1 doom in her threat area; bob has a ghoul
 * engaged. `extraCards` come on top of that.
 */
function threeInvestigators(extraCards: StartingCard[] = []): GameState {
  return startBoard(ctx, {
    maps: {
      main: {
        locations: { hall: 'hall', cellar: 'cellar' },
        connections: [edge('hall', 'cellar')],
      },
    },
    investigators: [
      makeInvestigator({ id: 'alice', seat: 0, locationId: hall, clues: 2 }),
      makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
      makeInvestigator({ id: 'carol', seat: 2, locationId: cellar }),
    ],
    cards: [
      placed(aliceGhoul, 'ghoul', engagedWith(alice), { damage: 1 }),
      placed(bobGhoul, 'ghoul', engagedWith(bob)),
      placed(frozenInFear, 'frozen_in_fear', threatAreaOf(alice), { doom: 1 }),
      ...extraCards,
    ],
  });
}

/** Round 1's investigation phase with alice's turn in progress and her ghoul exhausted. */
function aliceTurn(): GameState {
  return stateAfter(ctx, threeInvestigators(), nextPhase, startTurn(alice), {
    type: 'ExhaustEnemy',
    enemyId: aliceGhoul,
  });
}

describe.each([
  ['is defeated by damage', takeDamage(alice, 8)],
  ['is defeated by horror', takeHorror(alice, 6)],
  ['is defeated by a card effect', defeat(alice)],
  ['resigns', resign(alice)],
])('an investigator who %s', (_, leave) => {
  const after = () => stateAfter(ctx, aliceTurn(), leave);

  it('puts their clues on their location', () => {
    expect(investigatorOf(after(), alice).clues).toBe(0);
    expect(after().cards[hall]?.tokens.clue).toBe(2);
  });

  it('leaves their enemy at the location, unengaged, with its damage and exhaustion', () => {
    const ghoul = after().cards[aliceGhoul];

    expect(ghoul?.zone).toEqual(at(hall));
    expect(ghoul?.tokens).toEqual({ damage: 1 });
    expect(ghoul?.exhausted).toBe(true);
  });

  it('leaves the enemies of the others engaged', () => {
    expect(after().cards[bobGhoul]?.zone).toEqual(engagedWith(bob));
  });

  it('discards the cards in their threat area without their doom', () => {
    expect(idsIn(after(), { kind: 'encounterDiscard' })).toEqual([frozenInFear]);
    expect(after().cards[frozenInFear]?.tokens).toEqual({});
  });

  it('ends their turn', () => {
    expect(after().meta.turn).toBeUndefined();
    expect(after().meta.turnsTaken).toEqual([alice]);
  });

  it('leaves a consistent state', () => {
    expect(checkInvariants(after())).toEqual([]);
  });
});

describe('an investigator who leaves', () => {
  it('is not waited for at the end of the investigation phase', () => {
    const bobDone = stateAfter(
      ctx,
      aliceTurn(),
      resign(alice),
      chooseLead(bob),
      startTurn(bob),
      endTurn(bob),
      startTurn(carol),
      endTurn(carol),
    );

    expect(stateAfter(ctx, bobDone, nextPhase).meta.phase).toBe('enemy');
  });

  it('cannot start a turn', () => {
    const resigned = stateAfter(ctx, aliceTurn(), resign(alice), chooseLead(bob));

    expect(rejectionFrom(ctx, resigned, startTurn(alice))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });

  it('keeps the clues of an investigator without a location with them', () => {
    const unplaced = startBoard(ctx, {
      maps: { main: { locations: { hall: 'hall' } } },
      investigators: [
        makeInvestigator({ id: 'alice', seat: 0, clues: 2 }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
      ],
    });

    const defeated = stateAfter(ctx, unplaced, takeDamage(alice, 8));

    expect(investigatorOf(defeated, alice).clues).toBe(2);
    expect(defeated.cards[hall]?.tokens.clue).toBeUndefined();
  });

  it('discards the enemies of an investigator without a location, without their damage', () => {
    const unplacedGhoul = instanceId('unplaced_ghoul');
    const unplaced = startBoard(ctx, {
      maps: { main: { locations: { hall: 'hall' } } },
      investigators: [
        makeInvestigator({ id: 'alice', seat: 0 }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: hall }),
      ],
      cards: [placed(unplacedGhoul, 'ghoul', engagedWith(alice), { damage: 1 })],
    });

    const defeated = stateAfter(ctx, unplaced, takeDamage(alice, 8));

    expect(idsIn(defeated, { kind: 'encounterDiscard' })).toEqual([unplacedGhoul]);
    expect(defeated.cards[unplacedGhoul]?.tokens).toEqual({});
    expect(checkInvariants(defeated)).toEqual([]);
  });

  it('discards the cards attached to a threat-area card along with it', () => {
    const attachedFear = instanceId('attached_fear');
    const withAttachment = threeInvestigators([
      placed(
        attachedFear,
        'frozen_in_fear',
        { kind: 'attachedTo', hostId: frozenInFear },
        {
          doom: 1,
        },
      ),
    ]);

    const resigned = stateAfter(ctx, withAttachment, nextPhase, startTurn(alice), resign(alice));

    expect(idsIn(resigned, { kind: 'encounterDiscard' })).toEqual([frozenInFear, attachedFear]);
    expect(resigned.cards[attachedFear]?.tokens).toEqual({});
    expect(checkInvariants(resigned)).toEqual([]);
  });

  it('is cleaned up the same way when an enemy attack defeats them', () => {
    const secondAliceGhoul = instanceId('second_alice_ghoul');
    const attackPhase = stateAfter(
      ctx,
      threeInvestigators([placed(secondAliceGhoul, 'ghoul', engagedWith(alice))]),
      nextPhase,
      startTurn(alice),
      endTurn(alice),
      startTurn(bob),
      endTurn(bob),
      startTurn(carol),
      endTurn(carol),
      nextPhase,
      takeDamage(alice, 7),
    );

    const defeated = stateAfter(ctx, attackPhase, {
      type: 'ResolveEnemyAttack',
      enemyId: aliceGhoul,
      investigatorId: alice,
    });

    expect(investigatorOf(defeated, alice).status).toBe('defeated');
    expect(defeated.cards[hall]?.tokens.clue).toBe(2);
    expect(defeated.cards[secondAliceGhoul]?.zone).toEqual(at(hall));
    expect(defeated.meta.steps[0]).toEqual({
      id: 'enemiesAttack',
      attacks: [{ enemyId: bobGhoul, investigatorId: bob }],
    });
  });
});

describe('the lead investigator leaving', () => {
  it('asks the group for a new lead when several investigators remain', () => {
    const resigned = stateAfter(ctx, aliceTurn(), resign(alice));

    const [decision] = resigned.pending;

    expect(decision).toMatchObject({
      id: decisionId('newLeadInvestigator'),
      kind: 'chooseInvestigator',
      decider: { kind: 'group' },
    });
    expect(decision?.options.map((option) => option.target)).toEqual([bob, carol]);
    expect(resigned.meta.leadInvestigator).toBe(alice);
  });

  it('reads as a question about the lead investigator', () => {
    const resigned = stateAfter(ctx, aliceTurn(), resign(alice));

    expect(describeDecision(ctx, resigned, resigned.pending[0]!)).toBe(
      'Who becomes the lead investigator? bob / carol [chooseInvestigator]',
    );
  });

  it('makes the chosen investigator the lead, which player order follows', () => {
    const resigned = stateAfter(ctx, aliceTurn(), resign(alice));

    const chosen = stateAfter(ctx, resigned, chooseLead(carol));

    expect(chosen.meta.leadInvestigator).toBe(carol);
    expect(chosen.pending).toEqual([]);
    expect(playerOrder(chosen).map((inv) => inv.id)).toEqual([carol, bob]);
  });

  it('asks about a defeated lead too', () => {
    const defeated = stateAfter(ctx, threeInvestigators(), takeHorror(alice, 6));

    expect(defeated.pending.map((decision) => decision.id)).toEqual([
      decisionId('newLeadInvestigator'),
    ]);
  });

  it('makes the last remaining investigator the lead without asking', () => {
    const carolDefeatedFirst = stateAfter(ctx, aliceTurn(), takeDamage(carol, 8));

    const bobAlone = stateAfter(ctx, carolDefeatedFirst, resign(alice));

    expect(bobAlone.pending).toEqual([]);
    expect(bobAlone.meta.leadInvestigator).toBe(bob);
  });

  it('does not ask when another investigator leaves', () => {
    const defeated = stateAfter(ctx, threeInvestigators(), takeHorror(bob, 6));

    expect(defeated.pending).toEqual([]);
    expect(defeated.meta.leadInvestigator).toBe(alice);
  });
});

describe('the last investigator leaving', () => {
  const lastInvestigator = () =>
    stateAfter(ctx, aliceTurn(), takeDamage(bob, 8), takeDamage(carol, 8));

  it('ends the scenario without a resolution', () => {
    const { events, state } = execute(ctx, lastInvestigator(), resign(alice));

    expect(events.at(-1)).toEqual({ type: 'ScenarioEnded' });
    expect(state.meta.resolution).toBeUndefined();
  });

  it('asks nobody for a new lead', () => {
    expect(stateAfter(ctx, lastInvestigator(), resign(alice)).pending).toEqual([]);
  });

  it('does not end the scenario while an investigator remains', () => {
    const { events } = execute(ctx, aliceTurn(), resign(alice));

    expect(events.map((event) => event.type)).not.toContain('ScenarioEnded');
  });

  it('rejects further play, but still takes a correction of the final board', () => {
    const ended = stateAfter(ctx, lastInvestigator(), resign(alice));
    const removeOneHallClue: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: hall, token: 'clue', delta: -1 },
    };
    const hallClues = (state: GameState) => state.cards[hall]?.tokens.clue ?? 0;

    expect(ended.meta.ended).toBe(true);
    expect(rejectionFrom(ctx, ended, nextPhase)).toEqual({
      code: 'scenarioEnded',
      command: 'NextPhase',
    });
    expect(hallClues(stateAfter(ctx, ended, removeOneHallClue))).toBe(hallClues(ended) - 1);
  });
});

describe('DefeatInvestigator', () => {
  it('records that a card effect defeated the investigator', () => {
    const { events } = execute(ctx, aliceTurn(), defeat(bob));

    expect(events[0]).toEqual({
      type: 'InvestigatorDefeated',
      investigatorId: bob,
      cause: 'cardEffect',
    });
  });

  it('defeats an investigator outside their turn and the investigation phase', () => {
    const defeated = stateAfter(ctx, threeInvestigators(), defeat(carol));

    expect(investigatorOf(defeated, carol).status).toBe('defeated');
  });

  it('rejects an investigator who already left', () => {
    const resigned = stateAfter(ctx, aliceTurn(), resign(alice), chooseLead(bob));

    expect(rejectionFrom(ctx, resigned, defeat(alice))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });
});

describe('Resign', () => {
  it('rejects resigning outside the investigation phase', () => {
    expect(rejectionFrom(ctx, threeInvestigators(), resign(alice))).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'setup',
    });
  });

  it('rejects resigning when no turn is in progress', () => {
    const investigation = stateAfter(ctx, threeInvestigators(), nextPhase);

    expect(rejectionFrom(ctx, investigation, resign(alice))).toEqual({
      code: 'turnNotInProgress',
      investigatorId: alice,
    });
  });

  it("rejects resigning in someone else's turn", () => {
    expect(rejectionFrom(ctx, aliceTurn(), resign(bob))).toEqual({
      code: 'turnNotInProgress',
      investigatorId: bob,
      activeInvestigatorId: alice,
    });
  });

  it('rejects an investigator who already left', () => {
    const resigned = stateAfter(ctx, aliceTurn(), resign(alice), chooseLead(bob), startTurn(bob));

    expect(rejectionFrom(ctx, resigned, resign(alice))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });

  it('rejects an unknown investigator', () => {
    expect(rejectionFrom(ctx, aliceTurn(), resign(investigatorId('dave')))).toEqual({
      code: 'unknownInvestigator',
      investigatorId: investigatorId('dave'),
    });
  });
});

describe('SetLeadInvestigator', () => {
  const setLead = (investigator: InvestigatorId): Command => ({
    type: 'SetLeadInvestigator',
    investigatorId: investigator,
  });

  it('makes another active investigator the lead', () => {
    const changed = stateAfter(ctx, threeInvestigators(), setLead(bob));

    expect(changed.meta.leadInvestigator).toBe(bob);
  });

  it('rejects the investigator who already is the lead', () => {
    expect(rejectionFrom(ctx, threeInvestigators(), setLead(alice))).toEqual({
      code: 'alreadyLeadInvestigator',
      investigatorId: alice,
    });
  });

  it('rejects an investigator who left the scenario', () => {
    const defeated = stateAfter(ctx, threeInvestigators(), takeHorror(bob, 6));

    expect(rejectionFrom(ctx, defeated, setLead(bob))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: bob,
    });
  });
});
