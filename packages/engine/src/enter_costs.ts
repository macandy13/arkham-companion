import { cardStats, resolveValue, type EngineContext } from './cards';
import type { ClueSpend } from './commands';
import type { InvestigatorChanged } from './events';
import { cluesHeldByGroup, defaultCluePayments, groupCluePayments } from './investigators';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, Investigator } from './state';

/**
 * The clues the investigators spend as a group to enter `location` (`CardStats.enterCost`), for
 * the starting player count: only while it is unrevealed, since the cost is printed on that side
 * (Underground Cistern); entering reveals it, and entering again costs nothing.
 */
export function enterCost(
  ctx: EngineContext,
  state: GameState,
  location: CardInstance,
): number | undefined {
  const cost = location.faceUp ? undefined : cardStats(ctx.cards, location.code).enterCost;
  return cost === undefined ? undefined : resolveValue(cost.amount, state.meta.playerCount);
}

/**
 * The payments of `investigator`'s cost to enter `location`, made before they move (Rules
 * Reference, "Additional Costs"): by `spend`, or the mover first and the others in seat order.
 * Rejected when the group holds too few clues (`enterCostUnpaid`), or names payers for a
 * location without a cost (`noGroupCost`).
 */
export function enterCostPayment(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  location: CardInstance,
  spend: readonly ClueSpend[] | undefined,
): InvestigatorChanged[] {
  const required = enterCost(ctx, state, location);
  if (required === undefined) {
    if (spend !== undefined) throw new CommandRejected({ code: 'noGroupCost' });
    return [];
  }
  if (cluesHeldByGroup(ctx, state) < required)
    throw new CommandRejected({ code: 'enterCostUnpaid', locationId: location.id, required });
  return groupCluePayments(
    ctx,
    state,
    spend ?? defaultCluePayments(ctx, state, investigator.id, required),
    required,
  );
}
