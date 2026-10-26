import type { AbilityEffect, AbilityStep } from './abilities';
import { isLocationInPlay } from './board';
import { cardStats, resolveValue, type EngineContext, type ScaledValue } from './cards';
import type { ClueSpend, UseCardAction } from './commands';
import { locationOf } from './enemies';
import type { CardActionUsed, InvestigatorChanged } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import {
  activeInvestigator,
  activeInvestigators,
  defaultCluePayments,
  groupCluePayments,
  statValue,
} from './investigators';
import { currentCard, requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState, Investigator } from './state';
import { requireTurnOf } from './turns';

/**
 * An action ability printed on a card ("[action]: …", `CardStats.actions`), taken with
 * `UseCardAction`. Its effects resolve like a forced ability's, in a window that names the
 * investigator who took it and the card it is on.
 */
export interface CardAction {
  /**
   * The action's designator, for the two the rules single out: Resign and Parley never provoke
   * attacks of opportunity (Rules Reference, "Attacks of Opportunity"); every other card action
   * does. Absent for a plain action.
   */
  readonly designator?: 'resign' | 'parley';
  /** "(Limit once per …)", when the card prints one. */
  readonly limit?: ActionLimit;
  /** "Spend N resources:" or "Spend N clues:", paid before the effects. */
  readonly cost?: ActionCost;
  readonly effects: readonly AbilityEffect[];
}

/**
 * "(Limit once per turn.)", "(Limit once per game.)" or "(Group limit once per game.)": how often
 * the action may be taken (Rules Reference, "Limits and Maximums"). A limit counts each
 * investigator's uses apart; a group limit counts everyone's together.
 */
export interface ActionLimit {
  readonly per: 'turn' | 'game';
  readonly group?: true;
}

/**
 * What is paid before an action's effects resolve (Rules Reference, "Costs"); an action that
 * can't be paid for can't be taken. The investigator who takes it pays "Spend 5 resources:" or
 * "Spend 2 clues:" (`resources`, `clues`); the investigators pay "Spend 2 [per investigator]
 * clues, as a group:" (`groupClues`) together, at any location, choosing who pays how many.
 */
export type ActionCost =
  | { readonly spend: 'resources' | 'clues'; readonly amount: number }
  | { readonly spend: 'groupClues'; readonly amount: ScaledValue };

/**
 * Whether `cost` can be paid for `investigator`'s action: they hold the resources or clues, or
 * for a group cost the active investigators hold the clues together. No cost is always paid.
 */
export function canPay(
  state: GameState,
  investigator: Investigator,
  cost: ActionCost | undefined,
): boolean {
  if (cost === undefined) return true;
  if (cost.spend !== 'groupClues') return statValue(investigator, cost.spend) >= cost.amount;
  const held = activeInvestigators(state).reduce((sum, inv) => sum + inv.clues, 0);
  return held >= groupClueAmount(state, cost.amount);
}

/** The clues a group cost asks for the starting player count ("2 [per investigator]"). */
function groupClueAmount(state: GameState, amount: ScaledValue): number {
  return resolveValue(amount, state.meta.playerCount);
}

/**
 * The events that pay `cost` for `investigator`'s action: their own resources or clues, or a
 * group payment by `spend` (default: `defaultCluePayments`). `spend` is for group costs only.
 */
function costPayment(
  state: GameState,
  investigator: Investigator,
  cost: ActionCost | undefined,
  spend: readonly ClueSpend[] | undefined,
): InvestigatorChanged[] {
  if (cost?.spend !== 'groupClues') {
    if (spend !== undefined) throw new CommandRejected({ code: 'noGroupCost' });
    if (cost === undefined) return [];
    const { spend: stat, amount } = cost;
    return [{ type: 'InvestigatorChanged', investigatorId: investigator.id, stat, delta: -amount }];
  }
  const required = groupClueAmount(state, cost.amount);
  return groupCluePayments(
    state,
    spend ?? defaultCluePayments(state, investigator.id, required),
    required,
  );
}

/**
 * "[action] Resign." (the Parlor, the Main Path, The Midnight Masks' agendas): the investigator
 * who takes it resigns.
 */
export function resignAction(): CardAction {
  return {
    designator: 'resign',
    effects: [{ type: 'Resign', investigatorId: { ref: 'windowInvestigator' } }],
  };
}

/**
 * Whether `investigator` may take the action abilities of `card` (Rules Reference, "Abilities"):
 * a revealed location's at that location, an enemy's at its location (engaged with them or not),
 * a card's in a threat area at its owner's location, and the current agenda's and act's anyone.
 * An unrevealed location has only its unrevealed side's text, so it offers none.
 */
export function offersActionsTo(
  state: GameState,
  card: CardInstance,
  investigator: Investigator,
): boolean {
  const { zone } = card;
  const here = investigator.locationId;
  switch (zone.kind) {
    case 'location':
      return isLocationInPlay(state, card.id) && card.faceUp && here === card.id;
    case 'atLocation':
      return here === zone.locationId;
    case 'engaged':
      return here === locationOf(state, card);
    case 'threatArea': {
      const ownerId = zone.investigatorId;
      return here === state.investigators.find((inv) => inv.id === ownerId)?.locationId;
    }
    default:
      return (
        currentCard(state, 'agenda')?.id === card.id || currentCard(state, 'act')?.id === card.id
      );
  }
}

/**
 * One action ability a card offers an investigator (`cardActionsOfferedTo`): the card, the index
 * of the action in its `CardStats.actions` (what `UseCardAction.action` takes) and its designator.
 */
export interface OfferedCardAction {
  readonly cardId: InstanceId;
  readonly action: number;
  readonly designator?: CardAction['designator'];
}

/**
 * Every card action the cards in play offer `investigator` (`offersActionsTo`), their limits
 * still allow (`withinLimit`) and the investigator can pay for (`canPay`), in the order of the
 * cards in the state, then of the actions on each card. It does not check whose turn it is:
 * `UseCardAction` does.
 */
export function cardActionsOfferedTo(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
): OfferedCardAction[] {
  return Object.values(state.cards).flatMap((card) => {
    const actions = cardStats(ctx.cards, card.code).actions ?? [];
    if (actions.length === 0 || !offersActionsTo(state, card, investigator)) return [];
    return actions.flatMap(({ designator, limit, cost }, action) =>
      withinLimit(state, card, action, limit, investigator.id) && canPay(state, investigator, cost)
        ? [{ cardId: card.id, action, ...(designator === undefined ? {} : { designator }) }]
        : [],
    );
  });
}

/**
 * Whether the limit of action number `action` of `card` lets `investigatorId` take it now. "Once
 * per turn" counts the uses of the current round: card actions are taken only in the
 * investigator's own turn, and each investigator has one turn per round.
 */
export function withinLimit(
  state: GameState,
  card: CardInstance,
  action: number,
  limit: ActionLimit | undefined,
  investigatorId: InvestigatorId,
): boolean {
  if (limit === undefined) return true;
  return !(card.actionUses ?? []).some(
    (use) =>
      use.action === action &&
      (limit.group === true || use.investigatorId === investigatorId) &&
      (limit.per === 'game' || use.round === state.meta.round),
  );
}

/** The action `cmd` takes; rejects an index the card doesn't print (`unknownCardAction`). */
export function cardActionOf(ctx: EngineContext, state: GameState, cmd: UseCardAction): CardAction {
  const card = requireCard(state.cards, cmd.cardId);
  const action = cardStats(ctx.cards, card.code).actions?.[cmd.action];
  if (!action)
    throw new CommandRejected({ code: 'unknownCardAction', cardId: card.id, action: cmd.action });
  return action;
}

/**
 * `UseCardAction`: checks that the investigator may take the action now, in their own turn,
 * where the card offers it (`offersActionsTo`, else `cardActionUnavailable`) and as its limit
 * allows (`withinLimit`, else `cardActionLimitReached`), and that they can pay its cost (`canPay`,
 * else `cardActionCostUnpaid`); records the use (`CardActionUsed`) and pays the cost
 * (`costPayment`).
 * Its effects follow as ability steps (`cardActionSteps`).
 */
export function handleUseCardAction(
  ctx: EngineContext,
  state: GameState,
  cmd: UseCardAction,
): (CardActionUsed | InvestigatorChanged)[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  requireTurnOf(state, investigator.id);
  const { limit, cost } = cardActionOf(ctx, state, cmd);
  const card = requireCard(state.cards, cmd.cardId);
  if (!offersActionsTo(state, card, investigator))
    throw new CommandRejected({
      code: 'cardActionUnavailable',
      cardId: cmd.cardId,
      investigatorId: investigator.id,
    });
  if (!withinLimit(state, card, cmd.action, limit, investigator.id))
    throw new CommandRejected({
      code: 'cardActionLimitReached',
      cardId: cmd.cardId,
      action: cmd.action,
      investigatorId: investigator.id,
    });
  if (!canPay(state, investigator, cost))
    throw new CommandRejected({
      code: 'cardActionCostUnpaid',
      cardId: cmd.cardId,
      action: cmd.action,
      investigatorId: investigator.id,
    });
  const used: CardActionUsed = {
    type: 'CardActionUsed',
    cardId: card.id,
    action: cmd.action,
    investigatorId: investigator.id,
  };
  return [used, ...costPayment(state, investigator, cost, cmd.spend)];
}

/** The effects of the action `cmd` takes, as steps in its `action` window. */
export function cardActionSteps(
  ctx: EngineContext,
  state: GameState,
  cmd: UseCardAction,
): AbilityStep[] {
  const opened = {
    window: { kind: 'action' } as const,
    cardId: cmd.cardId,
    investigatorId: cmd.investigatorId,
  };
  return cardActionOf(ctx, state, cmd).effects.map((effect) => ({
    kind: 'ability',
    effect,
    opened,
    origin: effect.type,
  }));
}
