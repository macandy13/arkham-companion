import { cardActionOf } from './card_actions';
import type { EngineContext } from './cards';
import type { ActionCommand, AdjustActions, Command } from './commands';
import type { InvestigatorId } from './ids';
import { modifiersOn } from './modifiers';
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
 * them add (`ActionCostModifier`). A free action still pays those (the Frozen in Fear FAQ: a
 * granted or free move costs its additional action) and is the round's first all the same. This
 * is what the engine counts off (`actionPayment`) and what the screen shows on the action's
 * button; two copies of Frozen in Fear each add their one.
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
  return modifiersOn(ctx, state, { kind: 'investigator', investigatorId: investigator })
    .flatMap(({ modifier }) => (modifier.value === 'actionCost' ? [modifier] : []))
    .filter(
      (modifier) =>
        modifier.actions.includes(action) &&
        !(
          modifier.first === 'eachRound' &&
          taken.some((each) => modifier.actions.includes(each.action))
        ),
    )
    .reduce((cost, modifier) => cost + modifier.by, free ? 0 : 1);
}

/**
 * The basic action `command` is when the players take it as an action (`ActionCommand.asAction`),
 * by the word that names it; none for a command taken as a card effect.
 */
function basicActionOf(command: Command): ActionTaken | undefined {
  switch (command.type) {
    case 'MoveInvestigator':
      return taken('move', command);
    case 'Investigate':
      return taken('investigate', command);
    case 'Fight':
      return taken('fight', command);
    case 'Evade':
      return taken('evade', command);
    case 'EngageEnemy':
      return taken('engage', command);
    case 'GainResources':
      return taken('resource', command);
    case 'DrawCards':
      return taken('draw', command);
    case 'PlayCard':
      return taken('play', command);
    default:
      return undefined;
  }
}

/** A basic action a player command takes, and who takes it. */
interface ActionTaken {
  action: BasicAction;
  investigatorId: InvestigatorId;
  free: boolean;
}

function taken(
  action: BasicAction,
  { asAction, investigatorId }: ActionCommand & { investigatorId: InvestigatorId },
): ActionTaken | undefined {
  return asAction === undefined ? undefined : { action, investigatorId, free: asAction === 'free' };
}

/**
 * The `AdjustActions` that counts off what the player command `command` costs as an action, which
 * `handle` resolves before the command itself (and before the attacks of opportunity it provokes):
 * a basic action at its current `actionCost`, named so a raise of the round's first is paid once;
 * a card ability with the action symbol one action, a "[free]" one none. None for a command that
 * is no action. The players still correct the count by hand (`AdjustActions`, `ManualAdjust`).
 */
export function actionPayment(
  ctx: EngineContext,
  state: GameState,
  command: Command,
): AdjustActions | undefined {
  if (command.type === 'UseCardAction')
    return cardActionOf(ctx, state, command).free
      ? undefined
      : { type: 'AdjustActions', investigatorId: command.investigatorId, delta: -1 };
  const taken = basicActionOf(command);
  if (!taken) return undefined;
  const { action, investigatorId, free } = taken;
  return {
    type: 'AdjustActions',
    investigatorId,
    delta: -actionCost(ctx, state, investigatorId, action, { free }),
    for: action,
  };
}
