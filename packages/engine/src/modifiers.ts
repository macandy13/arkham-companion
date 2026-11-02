import { assertNever } from '@arkham/util';
import type { BasicAction } from './action_costs';
import { cardStats, type EngineContext } from './cards';
import { cardsInPlay, hasActiveAbilities } from './doom';
import type { InvestigatorId } from './ids';
import { binds, namesCard, type CardScope, type InvestigatorScope } from './scopes';
import type { CardInstance, GameState } from './state';

/** The printed values of a location a modifier may change. */
export type LocationValue = 'shroud';

/** The printed values of an enemy a modifier may change. */
export type EnemyValue = 'fight' | 'evade';

/** The printed card values a modifier may change; `effectiveValue` reads them. */
export type CardValue = LocationValue | EnemyValue;

/**
 * Raises the cost of basic actions: Frozen in Fear's "The first move, fight, or evade action you
 * perform each round costs 1 additional action" is `{ value: 'actionCost', of: 'threatArea',
 * actions: ['move', 'fight', 'evade'], first: 'eachRound', by: 1 }`; `actionCost` reads it.
 */
export interface ActionCostModifier {
  value: 'actionCost';
  of: InvestigatorScope;
  actions: readonly BasicAction[];
  /**
   * Only the first of `actions` the investigator performs each round costs more: once they have
   * counted one off this round (`GameMeta.actionsTaken`), the rest cost the usual one.
   */
  first?: 'eachRound';
  /** The additional actions it costs. */
  by: number;
}

/**
 * A constant ability that changes a number while its card is in play (`CardStats.modifiers`), as
 * card data: `{ value: 'shroud', of: 'host', by: 2 }` is Obscuring Fog. Each variant ties the value
 * to what can have it, so a location scope never names an investigator. Like any constant ability
 * it holds while its card is in play, and a location's only once it is revealed
 * (`hasActiveAbilities`). `modifiersOn` is the one place that collects them.
 */
export type Modifier =
  | { value: LocationValue; of: Exclude<CardScope, 'enemiesHere'>; by: number }
  | { value: EnemyValue; of: CardScope; by: number }
  | ActionCostModifier;

/** What a modifier is applied to: a card in play or an investigator. */
export type ModifierSubject =
  { kind: 'card'; card: CardInstance } | { kind: 'investigator'; investigatorId: InvestigatorId };

/** A modifier that applies now, with the card whose constant ability it is. */
export interface ActiveModifier {
  source: CardInstance;
  modifier: Modifier;
}

/**
 * Every modifier of the cards in play that names `target`, of any value, so each reader filters
 * the value it needs and can say which card changed it.
 */
export function modifiersOn(
  ctx: EngineContext,
  state: GameState,
  target: ModifierSubject,
): readonly ActiveModifier[] {
  return cardsInPlay(state)
    .filter(hasActiveAbilities)
    .flatMap((source) =>
      (cardStats(ctx.cards, source.code).modifiers ?? [])
        .filter((modifier) => names(ctx, state, source, modifier, target))
        .map((modifier) => ({ source, modifier })),
    );
}

/**
 * The value `value` of `card` now: the printed value (0 when the card has none) plus every
 * active modifier that names the card, never below 0 (Rules Reference, "Modifiers"). The skill
 * test handlers, the suggestion and the views all read it, so they agree.
 */
export function effectiveValue(
  ctx: EngineContext,
  state: GameState,
  card: CardInstance,
  value: CardValue,
): number {
  const modified = modifiersOn(ctx, state, { kind: 'card', card })
    .filter(({ modifier }) => modifier.value === value)
    .reduce((sum, { modifier }) => sum + modifier.by, cardStats(ctx.cards, card.code)[value] ?? 0);
  return Math.max(0, modified);
}

function names(
  ctx: EngineContext,
  state: GameState,
  source: CardInstance,
  modifier: Modifier,
  target: ModifierSubject,
): boolean {
  switch (modifier.value) {
    case 'shroud':
    case 'fight':
    case 'evade':
      return target.kind === 'card' && namesCard(ctx, state, source, modifier.of, target.card);
    case 'actionCost':
      return target.kind === 'investigator' && binds(source, modifier.of, target.investigatorId);
    default:
      return assertNever(modifier);
  }
}
