import type { EngineContext } from './cards';
import type { Command } from './commands';
import type { Event } from './events';
import { handle } from './handle';
import { replay } from './reducer';
import type { GameState } from './state';

/** Outcome of running one command: the events to persist and the state after them. */
export interface ExecuteResult {
  state: GameState;
  events: Event[];
}

/**
 * Runs a command end to end: `handle` validates it and produces events,
 * which are then applied to the state. This is what the app store calls;
 * it persists `events` and keeps `state`. Throws `CommandRejected` like `handle`.
 */
export function execute(state: GameState, command: Command, ctx: EngineContext): ExecuteResult {
  const events = handle(state, command, ctx);
  return { state: replay(events, state), events };
}
