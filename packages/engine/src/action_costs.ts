import { cardStats, type EngineContext } from './cards';
import { cardsInPlay } from './doom';
import type { InvestigatorId } from './ids';
import { binds, type RestrictedInvestigator } from './restrictions';
import type { GameState } from './state';

/**
 * The basic actions an investigator takes in their turn (Rules Reference, "Actions"), by the
 * word card text uses for them: what a cost modifier raises (`ActionCostModifier.actions`) and what
 * the players name when they count one off (`AdjustActions.for`). A card ability that is one of
 * them ("[action]: Fight") is that action too (Rules Reference, "Actions"), so it is counted off
 * by its word as well.
 */
export type BasicAction = (typeof BASIC_ACTIONS)[number];

/** Every `BasicAction`. */
export const BASIC_ACTIONS = [
  'investigate',
  'move',
  'draw',
  'resource',
  'play',
  'engage',
  'fight',
  'evade',
] as const;

/**
 * A constant ability that makes basic actions cost more (`CardStats.actionCosts`), as card data:
 * Frozen in Fear's "The first move, fight, or evade action you perform each round costs 1
 * additional action" is `{ actions: ['move', 'fight', 'evade'], by: 1, who: 'threatArea', first:
 * 'eachRound' }`. Like a restriction it holds while its card is in play and binds the
 * investigator in whose threat area it is (`RestrictedInvestigator`).
 */
export interface ActionCostModifier {
  actions: readonly BasicAction[];
  /** The additional actions it costs. */
  by: number;
  who: RestrictedInvestigator;
  /**
   * Only the first of `actions` the investigator performs each round costs more: once they have
   * counted one off this round (`GameMeta.actionsTaken`), the rest cost the usual one.
   */
  first?: 'eachRound';
}

/**
 * A basic action an investigator counted off this round (`AdjustActions.for`), recorded in
 * `GameMeta.actionsTaken` until the round ends, so a cost of the first one each round knows it
 * has been paid.
 */
export interface TakenAction {
  investigatorId: InvestigatorId;
  action: BasicAction;
}

/**
 * The actions `investigator`'s next `action` costs: one, or none when a card lets them perform it
 * without spending an action (`free`), plus what the cost modifiers of the cards in play that bind
 * them add (`CardStats.actionCosts`). A free action still pays those (the Frozen in Fear FAQ: a
 * granted or free move costs its additional action) and is the round's first all the same. The
 * engine leaves counting actions to the players (`Investigator.actionsRemaining`), so this is
 * what they count off, and what the screen shows on the action's button; two copies of Frozen in
 * Fear each add their one.
 */
export function actionCost(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
  action: BasicAction,
  { free = false }: { free?: boolean } = {},
): number {
  const taken = (state.meta.actionsTaken ?? []).filter(
    (each) => each.investigatorId === investigator,
  );
  return cardsInPlay(state).reduce(
    (cost, source) =>
      (cardStats(ctx.cards, source.code).actionCosts ?? [])
        .filter(
          (modifier) =>
            modifier.actions.includes(action) &&
            binds(source, modifier.who, investigator) &&
            !(
              modifier.first === 'eachRound' &&
              taken.some((each) => modifier.actions.includes(each.action))
            ),
        )
        .reduce((sum, modifier) => sum + modifier.by, cost),
    free ? 0 : 1,
  );
}
