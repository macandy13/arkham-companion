import { cardStats, type EngineContext } from './cards';
import { cardsInPlay, hasActiveAbilities } from './doom';
import { hasKeyword, type KeywordName } from './keywords';
import { namesCard } from './scopes';
import type { CardInstance, GameState } from './state';

/**
 * Whether `card` has the keyword now: printed on it (`hasKeyword`), or given by a card in play
 * (`KeywordGrant`, Hiding Spot's aloof). The rules read every keyword of a card in play through
 * this, so a gained keyword counts wherever a printed one does.
 */
export function cardHasKeyword(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
  name: KeywordName,
): boolean {
  const stats = cardStats(ctx.cards, card.code);
  if (hasKeyword(stats, name)) return true;
  return cardsInPlay(state)
    .filter(hasActiveAbilities)
    .some((source) =>
      (cardStats(ctx.cards, source.code).keywordGrants ?? []).some(
        (grant) =>
          grant.gains === name &&
          !(grant.exceptTraits ?? []).some((trait) => stats.traits.includes(trait)) &&
          namesCard(ctx, state, source, grant.of, card),
      ),
    );
}
