import {
  CommandRejected,
  compileSetup,
  emptyState,
  execute,
  zoneKey,
  type Command,
  type Difficulty,
  type EngineContext,
  type Event,
  type GameState,
  type Rejection,
  type ScenarioDefinition,
  type SetupOptions,
  type Zone,
} from '../../src/index';
import { investigators } from './investigators';

/**
 * A scenario definition with no agendas, acts, chaos tokens, reference
 * effects or setup steps; tests pass only the parts they exercise.
 */
export function makeDefinition(overrides: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id: 'test',
    chaosBag: { easy: [], standard: [], hard: [], expert: [] },
    reference: { easyStandard: {}, hardExpert: {} },
    agendaDeck: [],
    actDeck: [],
    setup: [],
    ...overrides,
  };
}

/** Setup options for one standard investigator on standard difficulty with seed 1. */
export function makeSetupOptions(overrides: Partial<SetupOptions> = {}): SetupOptions {
  return { difficulty: 'standard', seed: 1, investigators: investigators(1), ...overrides };
}

/** What `startScenario` varies; everything else uses `makeSetupOptions` defaults. */
export interface StartOptions {
  playerCount?: number;
  seed?: number;
  difficulty?: Difficulty;
}

/** The state after compiling and starting `def` with the first `playerCount` standard investigators. */
export function startScenario(
  ctx: EngineContext,
  def: ScenarioDefinition,
  { playerCount = 1, seed = 1, difficulty = 'standard' }: StartOptions = {},
): GameState {
  const options = makeSetupOptions({
    difficulty,
    seed,
    investigators: investigators(playerCount),
  });
  return execute(ctx, emptyState(), compileSetup(ctx, def, options)).state;
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
