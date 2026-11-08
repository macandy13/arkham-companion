import { CHAOS_TOKENS, type ChaosToken } from './state';

/** One kind of token in a chaos bag and how many of it the bag holds (`tokenCounts`). */
export interface TokenCount {
  readonly token: ChaosToken;
  readonly count: number;
}

/**
 * The tokens in `bag` as the players list them: each kind once, in `CHAOS_TOKENS` order, with its
 * count, leaving out the kinds it holds none of. The campaign log's bag and the bag on the play
 * screen both show it so.
 */
export function tokenCounts(bag: readonly ChaosToken[]): TokenCount[] {
  return CHAOS_TOKENS.flatMap((token) => {
    const count = bag.filter((each) => each === token).length;
    return count > 0 ? [{ token, count }] : [];
  });
}
