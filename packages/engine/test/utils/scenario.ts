import {
  scenarioId,
  CommandRejected,
  apply,
  scenario,
  emptyState,
  execute,
  zoneKey,
  type Command,
  type Decision,
  type Difficulty,
  type EngineContext,
  type Event,
  type GameState,
  type Rejection,
  type ScenarioContext,
  type ScenarioDefinition,
  type StandaloneSetupOptions,
  type Zone,
} from '../../src/index';
import { investigatorSeats } from './investigators';

/**
 * A scenario definition with no agendas, acts, chaos tokens, reference
 * effects or setup steps; tests pass only the parts they exercise.
 */
export function makeDefinition(overrides: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id: scenarioId('test'),
    chaosBag: { easy: [], standard: [], hard: [], expert: [] },
    reference: { easyStandard: {}, hardExpert: {} },
    agendaDeck: [],
    actDeck: [],
    setup: [],
    ...overrides,
  };
}

/** Setup options seating the first standard investigator, on standard difficulty with seed 1. */
export function makeSetupOptions(
  overrides: Partial<StandaloneSetupOptions> = {},
): StandaloneSetupOptions {
  return { difficulty: 'standard', seed: 1, investigators: investigatorSeats(1), ...overrides };
}

/** What `startScenario` varies; everything else uses `makeSetupOptions` defaults. */
export interface StartOptions {
  playerCount?: number;
  seed?: number;
  difficulty?: Difficulty;
}

/** The state after compiling and starting `ctx.scenario` with the first `playerCount` standard investigators. */
export function startScenario(
  ctx: ScenarioContext,
  { playerCount = 1, seed = 1, difficulty = 'standard' }: StartOptions = {},
): GameState {
  const options = makeSetupOptions({
    difficulty,
    seed,
    investigators: investigatorSeats(playerCount),
  });
  return execute(ctx, emptyState(), scenario.compileSetup(ctx, options)).state;
}

/** Executes commands from `state`, returning the final state and all events. */
export function runFrom(
  ctx: EngineContext,
  state: GameState,
  commands: readonly Command[],
): { state: GameState; events: Event[] } {
  let current = state;
  const events: Event[] = [];
  for (const command of commands) {
    const result = execute(ctx, current, command);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** The state after executing commands from `state`; for tests that need only the outcome, not the events. */
export function stateAfter(
  ctx: EngineContext,
  state: GameState,
  ...commands: Command[]
): GameState {
  return runFrom(ctx, state, commands).state;
}

/** The structured rejection `command` causes in `state` (fails the test if it is accepted). */
export function rejectionFrom(ctx: EngineContext, state: GameState, command: Command): Rejection {
  return rejectionOf(() => execute(ctx, state, command));
}

/** Executes commands from an empty state, returning the final state and all events. */
export function run(
  ctx: EngineContext,
  commands: readonly Command[],
): { state: GameState; events: Event[] } {
  return runFrom(ctx, emptyState(), commands);
}

/** Card codes in a zone, top first. */
export function codesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map((id) => state.cards[id]?.code ?? '?');
}

/** The structured rejection `fn` throws (fails the test if it does not throw one). */
export function rejectionOf(fn: () => unknown): Rejection {
  try {
    fn();
  } catch (e) {
    if (e instanceof CommandRejected) return e.rejection;
    throw e;
  }
  throw new Error('expected CommandRejected');
}

/**
 * `state` with `decisions` pending at once, as two attacks of opportunity
 * are. Built from events, because no command asks two unrelated questions
 * at once.
 */
export function withPendingDecisions(state: GameState, ...decisions: Decision[]): GameState {
  return decisions.reduce(
    (built, decision) => apply(built, { type: 'DecisionRequested', decision }),
    state,
  );
}
