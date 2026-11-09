import { decisionId, type GameState, type ResolveDecision } from '../../src/index';

/**
 * The players' answer `optionId` to the pending decision with ID `id`,
 * confirming `amount` for an option with a range (clues discovered, damage
 * dealt) when given.
 */
export function answer(id: string, optionId: string, amount?: number): ResolveDecision {
  return {
    type: 'ResolveDecision',
    decisionId: decisionId(id),
    optionId,
    ...(amount === undefined ? {} : { amount }),
  };
}

/** The IDs of the open decisions, oldest first. */
export function pendingIds(state: GameState): string[] {
  return state.pending.map((decision) => decision.id);
}

/**
 * The players' answer to the question the drawn treachery `card` asks before its revelation
 * (`revelationDecision`): resolve it.
 */
export function resolveRevelation(card: string): ResolveDecision {
  return answer(`revelation:${card}`, 'resolve');
}

/** The players' answer to the drawn treachery `card`'s question: cancel its revelation. */
export function cancelRevelation(card: string): ResolveDecision {
  return answer(`revelation:${card}`, 'cancel');
}
