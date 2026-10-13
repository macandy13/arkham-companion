import type { InstanceId } from './ids';
import type { GameState } from './state';
import { zoneKey } from './zone';

/**
 * Returns a list of invariant violations (empty = state is consistent):
 * every card is in exactly one zone and listed exactly once in that zone's
 * order, no order list is empty or names an unknown card, no token count is
 * negative.
 */
export function checkInvariants(state: GameState): string[] {
  const errors: string[] = [];
  const seen = new Map<InstanceId, string>();
  for (const [key, ids] of Object.entries(state.order) as [string, InstanceId[]][]) {
    if (ids.length === 0) errors.push(`zone ${key} has an empty order list`);
    for (const id of ids) {
      const card = state.cards[id];
      if (!card) errors.push(`zone ${key} lists unknown card ${id}`);
      else if (zoneKey(card.zone) !== key) {
        errors.push(`card ${id} listed in ${key} but its zone is ${zoneKey(card.zone)}`);
      }
      const prev = seen.get(id);
      if (prev !== undefined) errors.push(`card ${id} listed in both ${prev} and ${key}`);
      seen.set(id, key);
    }
  }
  for (const card of Object.values(state.cards)) {
    if (!seen.has(card.id)) errors.push(`card ${card.id} is in no zone order`);
    for (const [token, n] of Object.entries(card.tokens)) {
      if (n !== undefined && n < 0) errors.push(`card ${card.id} has ${n} ${token}`);
    }
  }
  return errors;
}
