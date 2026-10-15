import { allConnections, sameEdge } from './board';
import type { InstanceId } from './ids';
import { defeatCause, statValue } from './investigators';
import { INVESTIGATOR_STATS, type GameState } from './state';
import { zoneKey } from './zone';

/**
 * Returns a list of invariant violations (empty = state is consistent):
 * every card is in exactly one zone and listed exactly once in that zone's
 * order, no order list is empty or names an unknown card, no token count is
 * negative, every connection (of any map) joins two known cards and appears only once,
 * and every investigator is consistent (see `investigatorErrors`).
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
  errors.push(...connectionErrors(state));
  errors.push(...investigatorErrors(state));
  return errors;
}

/** Violations of the connection graph: edges to unknown cards and duplicate edges. */
function connectionErrors(state: GameState): string[] {
  const errors: string[] = [];
  const edges = allConnections(state).map(({ edge }) => edge);
  edges.forEach((edge, i) => {
    for (const end of [edge.from, edge.to]) {
      if (!state.cards[end])
        errors.push(`connection ${edge.from} - ${edge.to} names unknown card ${end}`);
    }
    if (edges.slice(0, i).some((earlier) => sameEdge(earlier, edge)))
      errors.push(`connection ${edge.from} - ${edge.to} appears more than once`);
  });
  return errors;
}

/**
 * Violations for investigators: negative counters, an unknown location, and
 * the defeat rule - an active investigator always has health and sanity left,
 * and a defeated one is what `AdjustInvestigator` leaves behind, so no check
 * applies to them.
 */
function investigatorErrors(state: GameState): string[] {
  const errors: string[] = [];
  for (const inv of state.investigators) {
    for (const stat of INVESTIGATOR_STATS) {
      if (statValue(inv, stat) < 0) errors.push(`investigator ${inv.id} has negative ${stat}`);
    }
    if (inv.locationId !== undefined && !state.cards[inv.locationId])
      errors.push(`investigator ${inv.id} is at unknown card ${inv.locationId}`);
    if (inv.status === 'active' && defeatCause(inv) !== undefined)
      errors.push(`investigator ${inv.id} is active but has no health or sanity left`);
  }
  return errors;
}
