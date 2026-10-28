import { locationsInPlay } from './board';
import type { EngineContext } from './cards';
import { cardsInZone, requireCard } from './lookup';
import type { VictoryDisplayFilter } from './abilities';
import type { CardInstance, GameState } from './state';
import { victoryDisplay } from './zone';

/**
 * The victory points the scenario is worth at its end: the cards in the
 * victory display, plus each revealed location in play with victory and no
 * clues on it, which goes to the victory display as the scenario ends (Rules
 * Reference, "Victory Display"). Counted without moving those locations, so
 * the ended game stays as it was played. Resolutions turn it into experience.
 */
export function victoryPoints(ctx: EngineContext, state: GameState): number {
  const inDisplay = cardsInZone(state, victoryDisplay).map((id) => requireCard(state.cards, id));
  const clearedLocations = locationsInPlay(ctx, state).filter(
    (card) => card.faceUp && (card.tokens.clue ?? 0) === 0,
  );
  return [...inDisplay, ...clearedLocations].reduce(
    (total, card) => total + printedVictory(ctx, card),
    0,
  );
}

/** The cards in the victory display that match `filter`, for objectives that count them (`victoryDisplayHolds`). */
export function inVictoryDisplay(
  ctx: EngineContext,
  state: GameState,
  filter: VictoryDisplayFilter,
): CardInstance[] {
  return cardsInZone(state, victoryDisplay)
    .map((id) => requireCard(state.cards, id))
    .filter((card) => {
      const stats = ctx.cards.get(card.code);
      return (
        stats?.traits?.includes(filter.trait) === true &&
        (filter.unique === undefined || stats.unique === true)
      );
    });
}

function printedVictory(ctx: EngineContext, card: CardInstance): number {
  return ctx.cards.get(card.code)?.victory ?? 0;
}
