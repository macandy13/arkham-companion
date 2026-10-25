import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import { isInPlay } from './doom';
import { enemiesAt } from './enemies';
import type { CardInstance, GameState } from './state';

/** The printed values a constant ability may change (`CardModifier.stat`). */
export type ModifiedStat = 'shroud' | 'fight' | 'evade';

/**
 * The cards a constant ability changes, relative to the card that has it:
 * - `host`: the card it is attached to ("Attached location gets +2 shroud").
 * - `enemiesHere`: for a location, each enemy at it, engaged ones included
 *   ("Each enemy at Dining Hall gets +1 fight").
 */
export type ModifiedCards = 'host' | 'enemiesHere';

/**
 * A constant ability that changes a value while its card is in play
 * (`CardStats.modifiers`), as card data: `{ stat: 'shroud', of: 'host', by: 2 }`.
 * `effectiveValue` folds every active one in, so a value is read the same way
 * by the skill test handlers, the suggestion and the views.
 */
export interface CardModifier {
  stat: ModifiedStat;
  of: ModifiedCards;
  by: number;
}

/**
 * The value `stat` of `card` now: the printed value (0 when the card has
 * none) plus every active constant ability that names the card, never below
 * 0 (Rules Reference, "Modifiers"). A location's abilities count only once it
 * is revealed, as its unrevealed side has none.
 */
export function effectiveValue(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
  stat: ModifiedStat,
): number {
  const modified = Object.values(state.cards).reduce(
    (value, source) =>
      value +
      activeModifiers(ctx, state, source)
        .filter(
          (modifier) => modifier.stat === stat && names(ctx, state, source, modifier.of, card),
        )
        .reduce((sum, modifier) => sum + modifier.by, 0),
    cardStats(ctx.cards, card.code)[stat] ?? 0,
  );
  return Math.max(0, modified);
}

function activeModifiers(
  ctx: EngineContext,
  state: GameState,
  source: CardInstance,
): readonly CardModifier[] {
  const stats = cardStats(ctx.cards, source.code);
  if (!stats.modifiers || !isInPlay(state, source)) return [];
  if (stats.typeCode === 'location' && !source.faceUp) return [];
  return stats.modifiers;
}

/** Whether `of`, read from `source`, names `card`. */
function names(
  ctx: EngineContext,
  state: GameState,
  source: CardInstance,
  of: ModifiedCards,
  card: CardInstance,
): boolean {
  switch (of) {
    case 'host':
      return source.zone.kind === 'attachedTo' && source.zone.hostId === card.id;
    case 'enemiesHere':
      return enemiesAt(ctx, state, source.id).some((enemy) => enemy.id === card.id);
    default:
      return assertNever(of);
  }
}
