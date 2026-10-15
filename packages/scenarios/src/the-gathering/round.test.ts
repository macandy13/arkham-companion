import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  decisionId,
  instanceId,
  investigatorId,
  type Command,
  type EngineContext,
} from '@arkham/engine';
import { runFrom, startScenario } from '@arkham/engine/test/utils';
import { GATHERING_CODES as codes, theGathering, theGatheringCards } from '../index';

const ctx: EngineContext = { cards: theGatheringCards, hooks: theGathering.hooks };
/** The first two standard investigators, in seat order (see `investigators`). */
const lead = investigatorId('tank');
const second = investigatorId('seeker');
const study = instanceId(`${codes.study}#1`);
const firstAgenda = instanceId(`${codes.whatsGoingOn}#1`);
const next: Command = { type: 'NextPhase' };

describe('a full round of The Gathering', () => {
  const started = startScenario(ctx, theGathering, { playerCount: 2, seed: 7 });
  const { state, events } = runFrom(ctx, started, [
    next,
    { type: 'Investigate', investigatorId: lead },
    { type: 'ResolveDecision', decisionId: decisionId(`investigate:${lead}`), optionId: 'pass' },
    { type: 'EndTurn', investigatorId: lead },
    { type: 'EndTurn', investigatorId: second },
    next,
    next,
    next,
    next,
  ]);

  it('ends in the investigation phase of round 2 with a consistent state', () => {
    expect(state.meta).toMatchObject({
      round: 2,
      phase: 'investigation',
      steps: [],
      turnsTaken: [],
    });
    expect(state.pending).toEqual([]);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('applied the investigation of round 1 in the Study', () => {
    expect(started.cards[study]?.tokens.clue).toBe(4);
    expect(state.investigators.map((inv) => inv.clues)).toEqual([1, 0]);
    expect(state.cards[study]?.tokens.clue).toBe(3);
  });

  it('gave each investigator a resource in upkeep', () => {
    expect(started.investigators.map((inv) => inv.resources)).toEqual([5, 5]);
    expect(state.investigators.map((inv) => inv.resources)).toEqual([6, 6]);
  });

  it('placed the mythos doom and let each investigator draw once, in player order', () => {
    const drawers = events.flatMap((e) =>
      e.type === 'EncounterCardDrawn' && !e.surge ? [e.investigatorId] : [],
    );

    expect(state.cards[firstAgenda]?.tokens.doom).toBe(1);
    expect(drawers).toEqual([lead, second]);
  });
});
