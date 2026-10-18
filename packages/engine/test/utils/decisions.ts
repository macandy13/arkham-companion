import { decisionId, type ResolveDecision } from '../../src/index';

/**
 * The players' answer `optionId` to the pending decision `decision`,
 * confirming `amount` for an option with a range (clues discovered, damage
 * dealt) when given.
 */
export function answer(decision: string, optionId: string, amount?: number): ResolveDecision {
  return {
    type: 'ResolveDecision',
    decisionId: decisionId(decision),
    optionId,
    ...(amount === undefined ? {} : { amount }),
  };
}
