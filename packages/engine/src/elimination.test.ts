import { describe, expect, it } from 'vitest';
import {
  attachedTo,
  atLocation,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  decisionId,
  describeDecision,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  newGame,
  perInvestigator,
  playerOrder,
  threatAreaOf,
  zoneKey,
  type BuiltGame,
  type Command,
  type GameState,
  type InvestigatorId,
  type Zone,
} from './index';
import { answer, investigatorOf, rejectionFrom, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const carol = investigatorId('carol');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const aliceGhoul = instanceId('alice_ghoul');
const bobGhoul = instanceId('bob_ghoul');
const frozenInFear = instanceId('frozen_in_fear');

const hallCard = blankLocation('hall');
/** 2 health per investigator, so a ghoul with 1 damage is still in play. */
const ghoulCard = blankEnemy('ghoul', { health: perInvestigator(2), damage: 1, horror: 1 });
const frozenInFearCard = blankTreachery('frozen_in_fear');

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

/** Ids of the cards in `zone`, top first. */
function idsIn(state: GameState, zone: Zone): string[] {
  return state.order[zoneKey(zone)] ?? [];
}

/**
 * Hall - cellar. Alice (seat 0, the lead) and bob (seat 1) are in the hall,
 * carol (seat 2) in the cellar. Alice holds 2 clues, has a ghoul with 1 damage
 * engaged and Frozen in Fear with 1 doom in her threat area; bob has a ghoul
 * engaged.
 */
const threeInvestigators = newGame()
  .withLocation(hall, hallCard)
  .withLocation(cellar, blankLocation('cellar'))
  .withConnection(hall, cellar)
  .withInvestigator(alice, { locationId: hall, clues: 2 })
  .withInvestigator(bob, { locationId: hall })
  .withInvestigator(carol, { locationId: cellar })
  .withCard(aliceGhoul, ghoulCard, engagedWith(alice), { tokens: { damage: 1 } })
  .withCard(bobGhoul, ghoulCard, engagedWith(bob))
  .withCard(frozenInFear, frozenInFearCard, threatAreaOf(alice), { tokens: { doom: 1 } });

/** Round 1's investigation phase with alice's turn in progress and her ghoul exhausted. */
function aliceTurn(): BuiltGame {
  const { context, state } = threeInvestigators.start();
  return {
    context,
    state: stateAfter(context, state, nextPhase, startTurn(alice), {
      type: 'ExhaustEnemy',
      enemyId: aliceGhoul,
    }),
  };
}

describe.each([
  ['is defeated by damage', takeDamage(alice, 8)],
  ['is defeated by horror', takeHorror(alice, 6)],
  ['is defeated by a card effect', defeat(alice)],
  ['resigns', resign(alice)],
])('an investigator who %s', (_, leave) => {
  const after = () => {
    const { context, state } = aliceTurn();
    return stateAfter(context, state, leave);
  };

  it('puts their clues on their location', () => {
    expect(investigatorOf(after(), alice).clues).toBe(0);
    expect(after().cards[hall]?.tokens.clue).toBe(2);
  });

  it('leaves their enemy at the location, unengaged, with its damage and exhaustion', () => {
    const ghoul = after().cards[aliceGhoul];

    expect(ghoul?.zone).toEqual(atLocation(hall));
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
    const { context, state } = aliceTurn();
    const bobDone = stateAfter(
      context,
      state,
      resign(alice),
      answer('newLeadInvestigator', bob),
      startTurn(bob),
      endTurn(bob),
      startTurn(carol),
      endTurn(carol),
    );

    expect(stateAfter(context, bobDone, nextPhase).meta.phase).toBe('enemy');
  });

  it('cannot start a turn', () => {
    const { context, state } = aliceTurn();
    const resigned = stateAfter(context, state, resign(alice), answer('newLeadInvestigator', bob));

    expect(rejectionFrom(context, resigned, startTurn(alice))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });

  it('keeps the clues of an investigator without a location with them', () => {
    const { context, state: unplaced } = newGame()
      .withLocation(hall, hallCard)
      .withInvestigator(alice, { clues: 2 })
      .withInvestigator(bob, { locationId: hall })
      .start();

    const defeated = stateAfter(context, unplaced, takeDamage(alice, 8));

    expect(investigatorOf(defeated, alice).clues).toBe(2);
    expect(defeated.cards[hall]?.tokens.clue).toBeUndefined();
  });

  it('discards the enemies of an investigator without a location, without their damage', () => {
    const unplacedGhoul = instanceId('unplaced_ghoul');
    const { context, state: unplaced } = newGame()
      .withLocation(hall, hallCard)
      .withInvestigator(alice)
      .withInvestigator(bob, { locationId: hall })
      .withCard(unplacedGhoul, ghoulCard, engagedWith(alice), { tokens: { damage: 1 } })
      .start();

    const defeated = stateAfter(context, unplaced, takeDamage(alice, 8));

    expect(idsIn(defeated, { kind: 'encounterDiscard' })).toEqual([unplacedGhoul]);
    expect(defeated.cards[unplacedGhoul]?.tokens).toEqual({});
    expect(checkInvariants(defeated)).toEqual([]);
  });

  it('discards the cards attached to a threat-area card along with it', () => {
    const attachedFear = instanceId('attached_fear');
    const { context, state: withAttachment } = threeInvestigators
      .withCard(attachedFear, frozenInFearCard, attachedTo(frozenInFear), { tokens: { doom: 1 } })
      .start();

    const resigned = stateAfter(
      context,
      withAttachment,
      nextPhase,
      startTurn(alice),
      resign(alice),
    );

    expect(idsIn(resigned, { kind: 'encounterDiscard' })).toEqual([frozenInFear, attachedFear]);
    expect(resigned.cards[attachedFear]?.tokens).toEqual({});
    expect(checkInvariants(resigned)).toEqual([]);
  });

  it('is cleaned up the same way when an enemy attack defeats them', () => {
    const secondAliceGhoul = instanceId('second_alice_ghoul');
    const { context, state } = threeInvestigators
      .withCard(secondAliceGhoul, ghoulCard, engagedWith(alice))
      .start();
    const attackPhase = stateAfter(
      context,
      state,
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

    const defeated = stateAfter(context, attackPhase, {
      type: 'ResolveEnemyAttack',
      enemyId: aliceGhoul,
      investigatorId: alice,
    });

    expect(investigatorOf(defeated, alice).status).toBe('defeated');
    expect(defeated.cards[hall]?.tokens.clue).toBe(2);
    expect(defeated.cards[secondAliceGhoul]?.zone).toEqual(atLocation(hall));
    expect(defeated.meta.steps[0]).toEqual({
      id: 'enemiesAttack',
      attacks: [{ enemyId: bobGhoul, investigatorId: bob }],
    });
  });
});

describe('the lead investigator leaving', () => {
  it('asks the group for a new lead when several investigators remain', () => {
    const { context, state } = aliceTurn();
    const resigned = stateAfter(context, state, resign(alice));

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
    const { context, state } = aliceTurn();
    const resigned = stateAfter(context, state, resign(alice));

    expect(describeDecision(context, resigned, resigned.pending[0]!)).toBe(
      'Who becomes the lead investigator? bob / carol [chooseInvestigator]',
    );
  });

  it('makes the chosen investigator the lead, which player order follows', () => {
    const { context, state } = aliceTurn();
    const resigned = stateAfter(context, state, resign(alice));

    const chosen = stateAfter(context, resigned, answer('newLeadInvestigator', carol));

    expect(chosen.meta.leadInvestigator).toBe(carol);
    expect(chosen.pending).toEqual([]);
    expect(playerOrder(chosen).map((inv) => inv.id)).toEqual([carol, bob]);
  });

  it('asks about a defeated lead too', () => {
    const { context, state } = threeInvestigators.start();
    const defeated = stateAfter(context, state, takeHorror(alice, 6));

    expect(defeated.pending.map((decision) => decision.id)).toEqual([
      decisionId('newLeadInvestigator'),
    ]);
  });

  it('makes the last remaining investigator the lead without asking', () => {
    const { context, state } = aliceTurn();
    const carolDefeatedFirst = stateAfter(context, state, takeDamage(carol, 8));

    const bobAlone = stateAfter(context, carolDefeatedFirst, resign(alice));

    expect(bobAlone.pending).toEqual([]);
    expect(bobAlone.meta.leadInvestigator).toBe(bob);
  });

  it('does not ask when another investigator leaves', () => {
    const { context, state } = threeInvestigators.start();
    const defeated = stateAfter(context, state, takeHorror(bob, 6));

    expect(defeated.pending).toEqual([]);
    expect(defeated.meta.leadInvestigator).toBe(alice);
  });
});

describe('the last investigator leaving', () => {
  const lastInvestigator = (): BuiltGame => {
    const { context, state } = aliceTurn();
    return { context, state: stateAfter(context, state, takeDamage(bob, 8), takeDamage(carol, 8)) };
  };

  it('ends the scenario without a resolution', () => {
    const { context, state: last } = lastInvestigator();
    const { events, state } = execute(context, last, resign(alice));

    expect(events.at(-1)).toEqual({ type: 'ScenarioEnded' });
    expect(state.meta.resolution).toBeUndefined();
  });

  it('asks nobody for a new lead', () => {
    const { context, state } = lastInvestigator();

    expect(stateAfter(context, state, resign(alice)).pending).toEqual([]);
  });

  it('does not end the scenario while an investigator remains', () => {
    const { context, state } = aliceTurn();
    const { events } = execute(context, state, resign(alice));

    expect(events.map((event) => event.type)).not.toContain('ScenarioEnded');
  });

  it('rejects further play, but still takes a correction of the final board', () => {
    const { context, state } = lastInvestigator();
    const ended = stateAfter(context, state, resign(alice));
    const removeOneHallClue: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: hall, token: 'clue', delta: -1 },
    };
    const hallClues = (board: GameState) => board.cards[hall]?.tokens.clue ?? 0;

    expect(ended.meta.ended).toBe(true);
    expect(rejectionFrom(context, ended, nextPhase)).toEqual({
      code: 'scenarioEnded',
      command: 'NextPhase',
    });
    expect(hallClues(stateAfter(context, ended, removeOneHallClue))).toBe(hallClues(ended) - 1);
  });
});

describe('DefeatInvestigator', () => {
  it('records that a card effect defeated the investigator', () => {
    const { context, state } = aliceTurn();
    const { events } = execute(context, state, defeat(bob));

    expect(events[0]).toEqual({
      type: 'InvestigatorDefeated',
      investigatorId: bob,
      cause: 'cardEffect',
    });
  });

  it('defeats an investigator outside their turn and the investigation phase', () => {
    const { context, state } = threeInvestigators.start();
    const defeated = stateAfter(context, state, defeat(carol));

    expect(investigatorOf(defeated, carol).status).toBe('defeated');
  });

  it('rejects an investigator who already left', () => {
    const { context, state } = aliceTurn();
    const resigned = stateAfter(context, state, resign(alice), answer('newLeadInvestigator', bob));

    expect(rejectionFrom(context, resigned, defeat(alice))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });
});

describe('Resign', () => {
  it('rejects resigning outside the investigation phase', () => {
    const { context, state } = threeInvestigators.start();

    expect(rejectionFrom(context, state, resign(alice))).toEqual({
      code: 'wrongPhase',
      expected: 'investigation',
      actual: 'setup',
    });
  });

  it('rejects resigning when no turn is in progress', () => {
    const { context, state } = threeInvestigators.start();
    const investigation = stateAfter(context, state, nextPhase);

    expect(rejectionFrom(context, investigation, resign(alice))).toEqual({
      code: 'turnNotInProgress',
      investigatorId: alice,
    });
  });

  it("rejects resigning in someone else's turn", () => {
    const { context, state } = aliceTurn();

    expect(rejectionFrom(context, state, resign(bob))).toEqual({
      code: 'turnNotInProgress',
      investigatorId: bob,
      activeInvestigatorId: alice,
    });
  });

  it('rejects an investigator who already left', () => {
    const { context, state } = aliceTurn();
    const resigned = stateAfter(
      context,
      state,
      resign(alice),
      answer('newLeadInvestigator', bob),
      startTurn(bob),
    );

    expect(rejectionFrom(context, resigned, resign(alice))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: alice,
    });
  });

  it('rejects an unknown investigator', () => {
    const { context, state } = aliceTurn();

    expect(rejectionFrom(context, state, resign(investigatorId('dave')))).toEqual({
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
    const { context, state } = threeInvestigators.start();
    const changed = stateAfter(context, state, setLead(bob));

    expect(changed.meta.leadInvestigator).toBe(bob);
  });

  it('rejects the investigator who already is the lead', () => {
    const { context, state } = threeInvestigators.start();

    expect(rejectionFrom(context, state, setLead(alice))).toEqual({
      code: 'alreadyLeadInvestigator',
      investigatorId: alice,
    });
  });

  it('rejects an investigator who left the scenario', () => {
    const { context, state } = threeInvestigators.start();
    const defeated = stateAfter(context, state, takeHorror(bob, 6));

    expect(rejectionFrom(context, defeated, setLead(bob))).toEqual({
      code: 'investigatorNotActive',
      investigatorId: bob,
    });
  });
});
