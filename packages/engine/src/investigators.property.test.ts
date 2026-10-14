import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  INVESTIGATOR_STATS,
  checkInvariants,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  lowestRemainingHealth,
  mapId,
  type AdjustInvestigator,
  type GameState,
  type Investigator,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const alice = investigatorId('alice');
const hall = instanceId('hall');

function startedState(): GameState {
  const investigator: Investigator = {
    id: alice,
    code: '00001',
    name: 'Test Investigator',
    seat: 1,
    locationId: hall,
    health: { max: 5, damage: 0 },
    sanity: { max: 4, horror: 0 },
    clues: 0,
    resources: 3,
    status: 'active',
  };
  return execute(sandboxContext, emptyState(), {
    type: 'StartScenario',
    scenarioId: 'property',
    difficulty: 'standard',
    seed: 1,
    investigators: [investigator],
    maps: { [mapId('m')]: { name: 'M' } },
    cards: [{ id: hall, code: 'L1', zone: { kind: 'location', mapId: mapId('m') } }],
  }).state;
}

const adjustmentArb: fc.Arbitrary<AdjustInvestigator> = fc.record({
  type: fc.constant('AdjustInvestigator' as const),
  investigatorId: fc.constant(alice),
  stat: fc.constantFrom(...INVESTIGATOR_STATS),
  delta: fc.integer({ min: -4, max: 4 }),
});

/** Runs commands, skipping rejected ones, and checks `check` after every accepted step. */
function runAccepting(commands: AdjustInvestigator[], check: (state: GameState) => void): void {
  let state = startedState();
  for (const command of commands) {
    try {
      state = execute(sandboxContext, state, command).state;
    } catch (e) {
      if (!(e instanceof CommandRejected)) throw e;
    }
    check(state);
  }
}

describe('investigator invariants', () => {
  it('keeps counters non-negative and defeats exactly when health or sanity is used up', () => {
    fc.assert(
      fc.property(fc.array(adjustmentArb, { maxLength: 30 }), (commands) => {
        runAccepting(commands, (state) => {
          const inv = state.investigators[0]!;
          const exhausted =
            inv.health.damage >= inv.health.max || inv.sanity.horror >= inv.sanity.max;
          expect(inv.status === 'defeated').toBe(exhausted);
          expect(checkInvariants(state)).toEqual([]);
        });
      }),
    );
  });

  it('prey results are tied investigators with the same, lowest remaining health', () => {
    const investigatorArb = fc
      .record({ max: fc.integer({ min: 1, max: 9 }), damage: fc.integer({ min: 0, max: 8 }) })
      .map(({ max, damage }) => ({ max, damage: Math.min(damage, max - 1) }));
    fc.assert(
      fc.property(fc.array(investigatorArb, { minLength: 1, maxLength: 4 }), (healths) => {
        const investigators: Investigator[] = healths.map((health, i) => ({
          id: investigatorId(`i${i}`),
          code: '00001',
          name: 'Test Investigator',
          seat: i + 1,
          health,
          sanity: { max: 5, horror: 0 },
          clues: 0,
          resources: 0,
          status: 'active',
        }));
        const remaining = (inv: Investigator): number => inv.health.max - inv.health.damage;

        const tied = lowestRemainingHealth(investigators);

        expect(tied.length).toBeGreaterThan(0);
        expect(new Set(tied.map(remaining)).size).toBe(1);
        expect(remaining(tied[0]!)).toBe(Math.min(...investigators.map(remaining)));
      }),
    );
  });
});
