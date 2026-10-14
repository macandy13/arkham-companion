import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  compileSetup,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  zoneKey,
  type EngineContext,
  type GameState,
  type Investigator,
  type Zone,
} from '@arkham/engine';
import { sandboxCards, sandboxScenario } from '../index';

const ctx: EngineContext = { cards: sandboxCards };
const house = mapId('house');

function makeInvestigator(id: string, seat: number): Investigator {
  return {
    id: investigatorId(id),
    code: id,
    name: id,
    seat,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
    clues: 0,
    resources: 5,
    status: 'active',
  };
}

/** The sandbox scenario set up for `playerCount` investigators. */
function startSandbox(playerCount: number, seed = 7): GameState {
  const investigators = Array.from({ length: playerCount }, (_, i) =>
    makeInvestigator(`inv${i + 1}`, i),
  );
  const command = compileSetup(ctx, sandboxScenario, {
    difficulty: 'standard',
    seed,
    investigators,
  });
  return execute(ctx, emptyState(), command).state;
}

/** Card codes in a zone, top first. */
function codesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map((id) => state.cards[id]?.code ?? '?');
}

describe('sandbox scenario setup', () => {
  it('puts the agendas and acts into their decks in stage order', () => {
    const state = startSandbox(2);

    expect(codesIn(state, { kind: 'agendaDeck' })).toEqual(['SB-A1', 'SB-A2']);
    expect(codesIn(state, { kind: 'actDeck' })).toEqual(['SB-C1', 'SB-C2']);
  });

  it('puts five locations onto the house map and sets the crypt and the elite aside', () => {
    const state = startSandbox(2);

    expect(codesIn(state, { kind: 'location', mapId: house })).toEqual([
      'SB-L1',
      'SB-L2',
      'SB-L3',
      'SB-L4',
      'SB-L5',
    ]);
    expect(codesIn(state, { kind: 'setAside' })).toEqual(['SB-L6', 'SB-E4']);
  });

  it('starts the investigators in the revealed foyer with its clues', () => {
    const state = startSandbox(2);
    const foyer = state.cards[instanceId('SB-L1#1')];

    expect(state.investigators.map((inv) => inv.locationId)).toEqual(['SB-L1#1', 'SB-L1#1']);
    expect(foyer).toMatchObject({ faceUp: true, tokens: { clue: 2 } });
  });

  it('leaves the other locations unrevealed', () => {
    const state = startSandbox(2);

    const revealed = Object.values(state.cards).filter(
      (card) => card.zone.kind === 'location' && card.faceUp,
    );

    expect(revealed.map((card) => card.code)).toEqual(['SB-L1']);
  });

  it('spawns the lurker in the cellar with one doom', () => {
    const state = startSandbox(2);

    const lurkers = codesIn(state, { kind: 'atLocation', locationId: instanceId('SB-L3#1') });

    expect(lurkers).toEqual(['SB-E3']);
    expect(state.cards[instanceId('SB-E3#1')]?.tokens).toEqual({ doom: 1 });
  });

  it('connects the locations, with a one-way edge from the attic to the cellar', () => {
    const state = startSandbox(2);

    expect(state.board.connections).toHaveLength(6);
    expect(state.board.connections).toContainEqual({
      from: 'SB-L4#1',
      to: 'SB-L3#1',
      oneWay: true,
    });
  });

  it('shuffles the remaining enemies and treacheries of both sets into the encounter deck', () => {
    const state = startSandbox(2);

    const deck = codesIn(state, { kind: 'encounterDeck' }).sort();

    expect(deck).toEqual([
      'SB-E1',
      'SB-E1',
      'SB-E1',
      'SB-E2',
      'SB-E2',
      'SB-T1',
      'SB-T1',
      'SB-T2',
      'SB-T2',
      'SB-T2',
      'SB-T3',
      'SB-T3',
    ]);
  });

  it('uses the standard chaos bag', () => {
    const state = startSandbox(1);

    expect(state.chaosBag).toEqual(sandboxScenario.chaosBag.standard);
  });

  it('sets up a consistent state for any seed and player count', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 4 }), (seed, playerCount) => {
        const state = startSandbox(playerCount, seed);

        expect(checkInvariants(state)).toEqual([]);
        expect(codesIn(state, { kind: 'encounterDeck' })).toHaveLength(12);
      }),
    );
  });
});
