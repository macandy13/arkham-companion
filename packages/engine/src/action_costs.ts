import { assertNever } from '@arkham/util';
import { cardActionOf } from './card_actions';
import type { EngineContext } from './cards';
import type { ActionCommand, Command, SpendActions } from './commands';
import type { InstanceId, InvestigatorId } from './ids';
import { findInvestigator } from './investigators';
import { isLocationCost, modifiersOn, type LocationAction } from './modifiers';
import type { GameState } from './state';

/**
 * The basic actions an investigator takes in their turn (Rules Reference, "Actions"), by the
 * word card text uses for them: what a cost modifier raises (`ActionCostModifier.actions`) and what
 * the engine names when it pays for one (`SpendActions.for`). A card ability that is one of
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
 * A basic action an investigator paid for this round (`SpendActions.for`), recorded in
 * `GameMeta.actionsTaken` until the round ends, so a cost of the first one each round knows it
 * has been paid.
 */
export interface TakenAction {
  investigatorId: InvestigatorId;
  action: BasicAction;
}

/**
 * How an investigator takes the basic action `actionCost` prices: `free` when a card lets them
 * perform it without spending an action, and for a move the location they move `to`, since a
 * card can make entering it, or leaving where they are, cost more (Arcane Lock).
 */
export interface ActionCostQuery {
  free?: boolean;
  to?: InstanceId;
}

/**
 * The actions `investigator`'s next `action` costs: one, or none when a card lets them perform it
 * without spending an action (`free`), plus what the cost modifiers of the cards in play add:
 * those that bind the investigator (`ActionCostModifier`) and those of the locations the action
 * leaves, enters or investigates (`LocationActionCostModifier`, with a move's destination `to`).
 * A free action still pays those and is the round's first all the same: the Frozen in Fear FAQ
 * for the investigator's own (a granted or free move costs its additional action), and for a
 * location's the Rules Reference ("Additional Costs": an additional cost is paid whenever its
 * effect resolves). This is what the engine counts off (`actionPayment`) and what the screen
 * shows on the action's button; two copies of Frozen in Fear each add their one.
 */
export function actionCost(
  ctx: EngineContext,
  state: GameState,
  investigator: InvestigatorId,
  action: BasicAction,
  { free = false, to }: ActionCostQuery = {},
): number {
  const taken = (state.meta.actionsTaken ?? []).filter(
    (each) => each.investigatorId === investigator,
  );
  const ownCost = modifiersOn(ctx, state, { kind: 'investigator', investigatorId: investigator })
    .flatMap(({ modifier }) =>
      modifier.value === 'actionCost' && !isLocationCost(modifier) ? [modifier] : [],
    )
    .filter(
      (modifier) =>
        modifier.actions.includes(action) &&
        !(
          modifier.first === 'eachRound' &&
          taken.some((each) => modifier.actions.includes(each.action))
        ),
    )
    .reduce((cost, modifier) => cost + modifier.by, free ? 0 : 1);
  const here = findInvestigator(state, investigator)?.locationId;
  return aimsOf(action, here, to).reduce(
    (cost, [locationId, aim]) =>
      locationId === undefined ? cost : cost + locationCost(ctx, state, locationId, aim),
    ownCost,
  );
}

/** The locations `action` is aimed at, each with what the investigator does there. */
function aimsOf(
  action: BasicAction,
  here: InstanceId | undefined,
  to: InstanceId | undefined,
): [InstanceId | undefined, LocationAction][] {
  switch (action) {
    case 'move':
      return [
        [here, 'leave'],
        [to, 'enter'],
      ];
    case 'investigate':
      return [[here, 'investigate']];
    case 'draw':
    case 'resource':
    case 'play':
    case 'engage':
    case 'fight':
    case 'evade':
      return [];
    default:
      return assertNever(action);
  }
}

/** What the cost modifiers naming the location `locationId` add to `action` there. */
function locationCost(
  ctx: EngineContext,
  state: GameState,
  locationId: InstanceId,
  action: LocationAction,
): number {
  const location = state.cards[locationId];
  if (location === undefined) return 0;
  return modifiersOn(ctx, state, { kind: 'card', card: location })
    .flatMap(({ modifier }) =>
      modifier.value === 'actionCost' && isLocationCost(modifier) ? [modifier] : [],
    )
    .filter((modifier) => modifier.actions.includes(action))
    .reduce((cost, modifier) => cost + modifier.by, 0);
}

/**
 * The basic action `command` is when the players take it as an action (`ActionCommand.asAction`),
 * by the word that names it; none for a command taken as a card effect.
 */
function basicActionOf(command: Command): ActionTaken | undefined {
  switch (command.type) {
    case 'MoveInvestigator':
      return taken('move', command, command.to);
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

/** A basic action a player command takes, who takes it, and for a move where to. */
interface ActionTaken {
  action: BasicAction;
  investigatorId: InvestigatorId;
  free: boolean;
  to?: InstanceId;
}

function taken(
  action: BasicAction,
  { asAction, investigatorId }: ActionCommand & { investigatorId: InvestigatorId },
  to?: InstanceId,
): ActionTaken | undefined {
  if (asAction === undefined) return undefined;
  return { action, investigatorId, free: asAction === 'free', ...(to === undefined ? {} : { to }) };
}

/**
 * The `SpendActions` that pays what the player command `command` costs as an action, which
 * `handle` resolves before the command itself (and before the attacks of opportunity it provokes):
 * a basic action at its current `actionCost`, named so a raise of the round's first is paid once;
 * a card ability with the action symbol one action, or two for "[action][action]:"
 * (`CardAction.actions`), a "[free]" one none. None for a command that is no action. The
 * players still correct the count by hand (`AdjustActions`, `ManualAdjust`), which the log keeps
 * apart from a payment.
 */
export function actionPayment(
  ctx: EngineContext,
  state: GameState,
  command: Command,
): SpendActions | undefined {
  if (command.type === 'UseCardAction') {
    const { investigatorId, cardId, action } = command;
    const { free, actions = 1 } = cardActionOf(ctx, state, command);
    return free
      ? undefined
      : {
          type: 'SpendActions',
          investigatorId,
          amount: actions,
          for: { kind: 'card', cardId, action },
        };
  }
  const taken = basicActionOf(command);
  if (!taken) return undefined;
  const { action, investigatorId, free, to } = taken;
  return {
    type: 'SpendActions',
    investigatorId,
    amount: actionCost(ctx, state, investigatorId, action, { free, to }),
    for: { kind: 'basic', action },
  };
}
