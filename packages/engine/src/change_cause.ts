import type { TimingWindow } from './abilities';
import type { InstanceId } from './ids';
import type { PhaseStepId } from './state';

/**
 * Why the engine produced an event (M1C.2): the players' own command, a card's forced ability, or
 * a step of the phase sequence the rules run by themselves. `handleWithCauses` returns one per
 * event, so a notice can say what the app changed and why ("1 doom: mythos phase", "1 horror:
 * Rotting Remains"). It travels next to the events, not inside them: replay never needs it.
 */
export type ChangeCause =
  | { readonly kind: 'player' }
  /** A forced ability of `cardId`, opened by `window` (`OpenedWindow`). */
  | { readonly kind: 'card'; readonly cardId: InstanceId; readonly window: TimingWindow }
  /** A step of the round's phases (`PhaseStep`), run by `NextPhase`. */
  | { readonly kind: 'rule'; readonly step: PhaseStepId };

/** The cause of what the players do themselves. */
export const PLAYER_CAUSE: ChangeCause = { kind: 'player' };
