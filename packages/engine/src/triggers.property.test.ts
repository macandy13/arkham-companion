import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  MAX_TRIGGERED_COMMANDS,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  type Command,
  type EngineContext,
  type GameState,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const main = mapId('main');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const agenda = instanceId('agenda');

/** One investigator in the hall with a ghoul; agenda A1 is current. */
function startedState(): GameState {
  return execute(sandboxContext, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'property',
    difficulty: 'standard',
    seed: 1,
    investigators: [
      {
        id: investigatorId('alice'),
        code: '00001',
        name: 'Alice',
        seat: 1,
        locationId: hall,
        health: { max: 5, damage: 0 },
        sanity: { max: 5, horror: 0 },
        clues: 0,
        resources: 0,
        doomOnPlayerCards: 0,
        status: 'active',
      },
    ],
    maps: { [main]: { name: 'Main' } },
    cards: [
      { id: agenda, code: 'A1', zone: { kind: 'agendaDeck' }, faceUp: true },
      { id: hall, code: 'L1', zone: { kind: 'location', mapId: main }, faceUp: true },
      { id: ghoul, code: 'E1', zone: { kind: 'atLocation', locationId: hall }, faceUp: true },
    ],
  }).state;
}

/**
 * A hook program: until the ghoul carries `chainLength` doom, every doom
 * placement triggers `fanOut` more; when `invalidAt` is reached, the hook
 * asks for an impossible command instead.
 */
interface Program {
  chainLength: number;
  fanOut: number;
  invalidAt: number | undefined;
}

const programs: fc.Arbitrary<Program> = fc.record({
  chainLength: fc.integer({ min: 0, max: 2 * MAX_TRIGGERED_COMMANDS }),
  fanOut: fc.integer({ min: 1, max: 3 }),
  invalidAt: fc.option(fc.integer({ min: 1, max: 2 * MAX_TRIGGERED_COMMANDS }), {
    nil: undefined,
  }),
});

const placeDoomOnGhoul: Command = { type: 'PlaceDoom', cardId: ghoul, amount: 1 };

function contextFor(program: Program): EngineContext {
  const invalid: Command = { type: 'RevealLocation', locationId: hall };
  return {
    ...sandboxContext,
    hooks: {
      afterDoomPlaced: (_ctx, state) => {
        const doom = state.cards[ghoul]?.tokens.doom ?? 0;
        if (doom === program.invalidAt) return [invalid];
        return doom < program.chainLength
          ? Array.from({ length: program.fanOut }, () => placeDoomOnGhoul)
          : [];
      },
    },
  };
}

describe('trigger bus properties', () => {
  it('either finishes within the guard or rejects without touching the state', () => {
    fc.assert(
      fc.property(programs, (program) => {
        const state = startedState();
        const snapshot = structuredClone(state);

        let outcome: { state: GameState; followUps: number } | CommandRejected;
        try {
          const result = execute(contextFor(program), state, placeDoomOnGhoul);
          outcome = {
            state: result.state,
            followUps: (result.state.cards[ghoul]?.tokens.doom ?? 0) - 1,
          };
        } catch (error) {
          if (!(error instanceof CommandRejected)) throw error;
          outcome = error;
        }

        expect(state).toEqual(snapshot);
        if (outcome instanceof CommandRejected) {
          expect(['triggerLoop', 'triggeredCommandRejected']).toContain(outcome.rejection.code);
        } else {
          expect(outcome.followUps).toBeLessThanOrEqual(MAX_TRIGGERED_COMMANDS);
          expect(checkInvariants(outcome.state)).toEqual([]);
        }
      }),
    );
  });

  it('runs a single-file chain that fits the guard to its end', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_TRIGGERED_COMMANDS + 1 }), (chainLength) => {
        const ctx = contextFor({ chainLength, fanOut: 1, invalidAt: undefined });

        const { state } = execute(ctx, startedState(), placeDoomOnGhoul);

        expect(state.cards[ghoul]?.tokens.doom).toBe(chainLength);
      }),
    );
  });

  it('rejects a single-file chain longer than the guard', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_TRIGGERED_COMMANDS + 2, max: 2 * MAX_TRIGGERED_COMMANDS }),
        (chainLength) => {
          const ctx = contextFor({ chainLength, fanOut: 1, invalidAt: undefined });

          const run = () => execute(ctx, startedState(), placeDoomOnGhoul);

          expect(run).toThrow(CommandRejected);
        },
      ),
    );
  });
});
