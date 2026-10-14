import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CommandRejected,
  TOKEN_KINDS,
  emptyState,
  execute,
  instanceId,
  investigatorId,
  mapId,
  replay,
  undoLastGroup,
  type Command,
  type Event,
  type GameState,
  type StartScenario,
} from './index';
import { sandboxContext } from '../test/fixtures/sandbox-cards';

const alice = investigatorId('a');
const deckCodes = ['E3', 'E4', 'E1', 'E3', 'E4', 'E3'];
const cardIds = deckCodes.map((_, i) => instanceId(`c${i}`));

const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'undo-prop',
  difficulty: 'standard',
  seed: 5,
  investigators: [
    {
      id: alice,
      code: 'inv',
      name: 'Alice',
      seat: 0,
      health: { max: 8, damage: 0 },
      sanity: { max: 8, horror: 0 },
      clues: 0,
      resources: 5,
      doomOnPlayerCards: 0,
      status: 'active',
    },
  ],
  maps: { [mapId('m')]: { name: 'Map' } },
  cards: deckCodes.map((code) => ({ code, zone: { kind: 'encounterDeck' as const } })),
};

/** Mix of shuffling/drawing commands (RNG), moves and token changes; invalid ones are rejected and skipped. */
const commandArb: fc.Arbitrary<Command> = fc.oneof(
  fc.constant<Command>({ type: 'DrawEncounter', investigatorId: alice }),
  fc.record({
    type: fc.constant('ManualAdjust' as const),
    adjustment: fc.record({
      kind: fc.constant('tokens' as const),
      cardId: fc.constantFrom(...cardIds),
      token: fc.constantFrom(...TOKEN_KINDS),
      delta: fc.integer({ min: -2, max: 2 }),
    }),
  }),
  fc.record({
    type: fc.constant('ManualAdjust' as const),
    adjustment: fc.record({
      kind: fc.constant('moveCard' as const),
      cardId: fc.constantFrom(...cardIds),
      to: fc.constantFrom(
        { kind: 'encounterDeck' as const },
        { kind: 'encounterDiscard' as const },
      ),
    }),
  }),
);

describe('undo properties', () => {
  it('undoing every command group one by one walks back through the earlier states to the empty state', () => {
    fc.assert(
      fc.property(fc.array(commandArb, { maxLength: 25 }), (commands) => {
        let state: GameState = emptyState();
        const states: GameState[] = [state];
        let log: { commandId: string; event: Event }[] = [];
        for (const [i, command] of [start, ...commands].entries()) {
          try {
            const result = execute(sandboxContext, state, command);
            state = result.state;
            states.push(state);
            log = [...log, ...result.events.map((event) => ({ commandId: `cmd-${i}`, event }))];
          } catch (e) {
            if (!(e instanceof CommandRejected)) throw e;
          }
        }

        for (let step = states.length - 2; step >= 0; step--) {
          log = undoLastGroup(log).kept;
          expect(replay(log.map((e) => e.event))).toEqual(states[step]);
        }
        expect(log).toEqual([]);
      }),
    );
  });
});
