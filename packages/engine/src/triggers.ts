import { abilitySteps, windowsOpenedBy, type AbilityStep } from './abilities';
import type { EngineContext } from './cards';
import type { Command } from './commands';
import type { Event } from './events';
import { apply } from './reducer';
import type { GameState, QueuedStep } from './state';

/**
 * Upper bound on the follow-up commands one player command may cause, counted
 * over the whole chain. Real forced-effect chains are a handful of steps, so
 * reaching it means card abilities keep re-triggering each other (a
 * mistake in card data).
 */
export const MAX_TRIGGERED_COMMANDS = 50;

/**
 * A follow-up to resolve: one effect of a card ability, the choice of a new
 * lead after the lead left (`newLeadInvestigator`), or a plain command that
 * continues a step (`followUpStep`).
 */
export type TriggeredStep =
  Extract<QueuedStep, { kind: 'command' | 'newLeadInvestigator' }> | AbilityStep;

/** A forced effect that matched an event, not yet evaluated. */
type PendingTrigger = (state: GameState) => readonly TriggeredStep[];

/**
 * The follow-up steps the card abilities in `ctx`'s card data return for
 * `events`, which a command produced from `before`: each ability effect as a
 * step of its own that resolves when its turn comes (`resolveEffect`).
 * Windows open against the state right after each event but abilities are
 * evaluated against the state after all of them, so every ability sees the
 * command's complete outcome. Order: by event. The lead leaving queues a
 * `newLeadInvestigator` step like a forced effect of the departure, so a
 * forced effect of an earlier event of the same command still sees no lead.
 */
export function triggeredSteps(
  ctx: EngineContext,
  before: GameState,
  events: readonly Event[],
): TriggeredStep[] {
  const pending: PendingTrigger[] = [];
  let state = before;
  for (const event of events) {
    const next = apply(state, event);
    if (leadLeft(state, event)) pending.push(() => [{ kind: 'newLeadInvestigator' }]);
    pending.push(
      ...windowsOpenedBy(next, event, events).map(
        (opened) => (after: GameState) => abilitySteps(ctx, after, opened),
      ),
    );
    state = next;
  }
  return pending.flatMap((trigger) => trigger(state));
}

function leadLeft(before: GameState, event: Event): boolean {
  return (
    (event.type === 'InvestigatorDefeated' || event.type === 'InvestigatorResigned') &&
    event.investigatorId === before.meta.leadInvestigator
  );
}

/** A follow-up command as a step of its own, naming its type as the origin a rejection reports. */
export function followUpStep(command: Command): TriggeredStep {
  return { kind: 'command', command, origin: command.type };
}
