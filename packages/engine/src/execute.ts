import type { EngineContext } from './cards';
import type { Command } from './commands';
import type { ChangeCause } from './change_cause';
import type { Event } from './events';
import { handleWithCauses } from './handle';
import { replay } from './reducer';
import type { GameState } from './state';

/** Outcome of running one command: the events to persist and the state after them. */
export interface ExecuteResult {
  state: GameState;
  events: Event[];
  /** Why each of `events` happened, at the same index (`handleWithCauses`). */
  causes: ChangeCause[];
}

/**
 * Runs a command end to end: `handle` validates it and produces events,
 * which are then applied to the state. This is what the app store calls;
 * it persists `events` and keeps `state`. Throws `CommandRejected` like `handle`.
 */
export function execute(ctx: EngineContext, state: GameState, command: Command): ExecuteResult {
  const { events, causes } = handleWithCauses(ctx, state, command);
  return { state: replay(events, state), events, causes };
}
