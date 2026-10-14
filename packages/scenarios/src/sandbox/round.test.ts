import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  compileSetup,
  decisionId,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  type Command,
  type EngineContext,
  type Event,
  type GameState,
  type Investigator,
} from '@arkham/engine';
import { sandboxCards, sandboxScenario } from '../index';

const ctx: EngineContext = { cards: sandboxCards };
const alice = investigatorId('alice');
const bob = investigatorId('bob');
const foyer = instanceId('SB-L1#1');

function makeInvestigator(id: typeof alice, seat: number): Investigator {
  return {
    id,
    code: id,
    name: id,
    seat,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
    clues: 0,
    resources: 5,
    doomOnPlayerCards: 0,
    status: 'active',
  };
}

/** Runs `commands` in order and collects the final state and every event. */
function play(state: GameState, commands: Command[]): { state: GameState; events: Event[] } {
  return commands.reduce(
    (acc, command) => {
      const result = execute(ctx, acc.state, command);
      return { state: result.state, events: [...acc.events, ...result.events] };
    },
    { state, events: [] as Event[] },
  );
}

const next: Command = { type: 'NextPhase' };

describe('a full round of the sandbox scenario', () => {
  const setup = compileSetup(ctx, sandboxScenario, {
    difficulty: 'standard',
    seed: 7,
    investigators: [makeInvestigator(alice, 0), makeInvestigator(bob, 1)],
  });
  const started = execute(ctx, emptyState(), setup).state;

  const { state, events } = play(started, [
    next,
    { type: 'Investigate', investigatorId: alice },
    { type: 'ResolveDecision', decisionId: decisionId('investigate:alice'), optionId: 'pass' },
    { type: 'EndTurn', investigatorId: alice },
    { type: 'EndTurn', investigatorId: bob },
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

  it('applied the investigation of round 1', () => {
    expect(state.investigators[0]?.clues).toBe(1);
    expect(state.cards[foyer]?.tokens.clue).toBe(1);
  });

  it('gave each investigator a resource in upkeep', () => {
    expect(state.investigators.map((inv) => inv.resources)).toEqual([6, 6]);
  });

  it('placed the mythos doom and let each investigator draw once, in player order', () => {
    const drawers = events.flatMap((e) =>
      e.type === 'EncounterCardDrawn' && !e.surge ? [e.investigatorId] : [],
    );

    expect(state.cards[instanceId('SB-A1#1')]?.tokens.doom).toBe(1);
    expect(drawers).toEqual([alice, bob]);
  });
});
