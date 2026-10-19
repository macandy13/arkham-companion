import { decisionId, type ResolveDecision } from '../../src/index';

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
