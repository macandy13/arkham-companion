import { CHAOS_TOKENS, type ChaosToken, type SealedToken } from './state';

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

/**
 * The tokens that come from a pool of their own rather than staying in the bag (The Innsmouth
 * Conspiracy, "Bless and Curse"): a card adds one from the pool, a revealed one goes back to it
 * after the test, and none carries over to the next scenario.
 */
export type PoolToken = Extract<ChaosToken, 'bless' | 'curse'>;

/** How many of each `PoolToken` the game holds: no card adds one while all are in play. */
export const POOL_TOKEN_COUNT = 10;

/** Whether `token` is a bless or curse token (`PoolToken`). */
export function isPoolToken(token: ChaosToken): token is PoolToken {
  return token === 'bless' || token === 'curse';
}

/**
 * How many of `token` are left in its pool: `POOL_TOKEN_COUNT` less those in the bag and those
 * sealed on cards, since a sealed token is still in play.
 */
export function poolTokensLeft(
  token: PoolToken,
  bag: readonly ChaosToken[],
  sealed: readonly SealedToken[],
): number {
  const inPlay = [...bag, ...sealed.map((each) => each.token)].filter((each) => each === token);
  return POOL_TOKEN_COUNT - inPlay.length;
}
