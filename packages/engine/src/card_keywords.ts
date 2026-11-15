import { includesAny, unique } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import { cardsInPlay, hasActiveAbilities } from './doom';
import type { Keyword, KeywordName } from './keywords';
import { namesCard } from './scopes';
import type { CardInstance, GameState } from './state';

/**
 * The keywords `card` has now: those printed on it, then those a card in play gives it
 * (`KeywordGrant`, Hiding Spot's aloof) that it lacks, each once. The rules and the board read
 * every keyword of a card in play through this, so a gained keyword counts wherever a printed one
 * does (RR "Gains").
 */
export function cardKeywords(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
): readonly Keyword[] {
  const stats = cardStats(ctx.cards, card.code);
  const printed = stats.keywords ?? [];
  const granted = cardsInPlay(state)
    .filter(hasActiveAbilities)
    .flatMap((source) =>
      (cardStats(ctx.cards, source.code).keywordGrants ?? []).filter(
        (grant) =>
          !includesAny(stats.traits, grant.exceptTraits) &&
          namesCard(ctx, state, source, grant.of, card),
      ),
    )
    .map((grant) => grant.gains);
  const gained = unique(granted).filter(
    (name) => !printed.some((keyword) => keyword.name === name),
  );
  return [...printed, ...gained.map((name) => ({ name }))];
}

/** Whether `card` has the keyword now, printed or given (`cardKeywords`). */
export function cardHasKeyword(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
  name: KeywordName,
): boolean {
  return cardKeywords(ctx, state, card).some((keyword) => keyword.name === name);
}
