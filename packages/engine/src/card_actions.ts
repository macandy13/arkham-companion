import { assertNever } from '@arkham/util';
import { advanceAct, type AbilityEffect, type AbilityStep } from './abilities';
import { findInvestigator } from './campaign/campaign_log';
import { isLocationInPlay } from './board';
import {
  cardStats,
  resolveValue,
  type CardStats,
  type EngineContext,
  type ScaledValue,
} from './cards';
import type { ClueSpend, UseCardAction } from './commands';
import { locationOf } from './enemies';
import type { CardActionUsed, CommandDeferred, InvestigatorChanged } from './events';
import type { CardCode, InstanceId, InvestigatorId } from './ids';
import {
  activeInvestigator,
  cluesHeldByGroup,
  defaultCluePayments,
  groupCluePayments,
  statValue,
} from './investigators';
import { currentCard, requireCard } from './lookup';
import { CommandRejected } from './rejection';
import { isRestrictedFor } from './restrictions';
import type { CardInstance, GameState, Investigator } from './state';
import { requireTurnOf } from './turns';
import { playAreaOf, sameZone } from './zone';

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
  /**
   * A "[free]" ability, taken without spending an action in any player window (Rules Reference,
   * "[free]"): `UseCardAction` takes it outside the taker's turn too and not as an
   * action, so it never provokes attacks of opportunity. Abilities limited to a narrower timing (an act's group clue
   * spend, "during any investigator's turn") need their own check. Absent for an action ability.
   */
  readonly free?: true;
  /** "(Limit once per …)", when the card prints one. */
  readonly limit?: ActionLimit;
  /** "Spend N resources:" or "Spend N clues:", paid before the effects. */
  readonly cost?: ActionCost;
  /** "If you control Lita Chantler:", which the investigator taking it must meet (`actionConditionHolds`). */
  readonly condition?: ActionCondition;
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
 * A condition on taking an action, printed before its colon: "If you control Lita Chantler:"
 * (`controls`, Umôrdhoth), or a timing narrower than a free action's any player window, "during
 * any investigator's turn" (`investigatorTurn`, the act's group clue spend). An action whose
 * condition doesn't hold is neither offered nor accepted. Tagged by `kind`, like
 * `AbilityCondition`, so the next condition joins as another member.
 */
export type ActionCondition =
  { readonly kind: 'controls'; readonly card: CardCode } | { readonly kind: 'investigatorTurn' };

/**
 * Whether `condition` holds for `investigator`. "During any investigator's turn" holds while
 * anyone's turn is in progress, not only the taker's. "If you control X" holds when a card X is in
 * their play area. When the game has no card X at all, X is a player card the players hold (Lita
 * Chantler, earned in The Gathering, is in an investigator's deck by The Devourer Below), which
 * the game doesn't track, so it trusts the investigator taking the action, as it trusts a hand
 * card cost, as long as the campaign log says they earned the card
 * (`CampaignInvestigator.earnedCards`). A standalone game has no log: its players pick the
 * earlier resolutions themselves (Rules Reference, "Standalone Mode"), so it trusts the taker
 * too. No condition always holds.
 */
export function actionConditionHolds(
  state: GameState,
  investigator: Investigator,
  condition: ActionCondition | undefined,
): boolean {
  if (condition === undefined) return true;
  switch (condition.kind) {
    case 'investigatorTurn':
      return state.meta.turn !== undefined;
    case 'controls': {
      const copies = Object.values(state.cards).filter((card) => card.code === condition.card);
      if (copies.length === 0) {
        if (state.campaign === undefined) return true;
        const member = findInvestigator(state.campaign, investigator.code);
        return member?.earnedCards.includes(condition.card) === true;
      }
      return copies.some((card) => sameZone(card.zone, playAreaOf(investigator.id)));
    }
    default:
      return assertNever(condition);
  }
}

/**
 * What is paid before an action's effects resolve (Rules Reference, "Costs"); an action that
 * can't be paid for can't be taken. The investigator who takes it pays "Spend 5 resources:" or
 * "Spend 2 clues:" (`resources`, `clues`); the investigators pay "Spend 2 [per investigator]
 * clues, as a group:" (`groupClues`) together, at any location, choosing who pays how many.
 * "Choose and discard 4 cards from your hand:" (`handCards`) is the taker's too, but the game
 * holds no player cards, so the players discard by hand (`DiscardFromHand`, deferred).
 */
export type ActionCost =
  | { readonly spend: 'resources' | 'clues'; readonly amount: number }
  | { readonly spend: 'groupClues'; readonly amount: ScaledValue }
  | { readonly spend: 'handCards'; readonly amount: number };

/**
 * Whether `cost` can be paid for `investigator`'s action: they hold the resources or clues, or
 * for a group cost the active investigators hold the clues together, counting only clues no card
 * forbids to spend (`isRestrictedFor`). No cost is always paid.
 */
export function canPay(
  ctx: EngineContext,
  state: GameState,
  investigator: Investigator,
  cost: ActionCost | undefined,
): boolean {
  if (cost === undefined) return true;
  switch (cost.spend) {
    case 'resources':
      return statValue(investigator, cost.spend) >= cost.amount;
    case 'clues':
      return (
        !isRestrictedFor(ctx, state, investigator.id, 'spendClues') &&
        statValue(investigator, cost.spend) >= cost.amount
      );
    case 'groupClues':
      return cluesHeldByGroup(ctx, state) >= groupClueAmount(state, cost.amount);
    case 'handCards':
      // The game doesn't know the hand; the players don't take an action they can't pay for.
      return true;
    default:
      return assertNever(cost);
  }
}

/** The clues a group cost asks for the starting player count ("2 [per investigator]"). */
function groupClueAmount(state: GameState, amount: ScaledValue): number {
  return resolveValue(amount, state.meta.playerCount);
}

/**
 * The events that pay `cost` for `investigator`'s action: their own resources or clues, a group
 * payment by `spend` (default: `defaultCluePayments`), or a discard from their hand left to the
 * players, naming `cardId`, the card whose action it is. `spend` is for group costs only.
 */
function costPayment(
  ctx: EngineContext,
  state: GameState,
  cardId: InstanceId,
  investigator: Investigator,
  cost: ActionCost | undefined,
  spend: readonly ClueSpend[] | undefined,
): (InvestigatorChanged | CommandDeferred)[] {
  if (spend !== undefined && cost?.spend !== 'groupClues')
    throw new CommandRejected({ code: 'noGroupCost' });
  if (cost === undefined) return [];
  switch (cost.spend) {
    case 'resources':
    case 'clues':
      return [
        {
          type: 'InvestigatorChanged',
          investigatorId: investigator.id,
          stat: cost.spend,
          delta: -cost.amount,
        },
      ];
    case 'groupClues': {
      const required = groupClueAmount(state, cost.amount);
      return groupCluePayments(
        ctx,
        state,
        spend ?? defaultCluePayments(ctx, state, investigator.id, required),
        required,
      );
    }
    case 'handCards':
      return [
        {
          type: 'CommandDeferred',
          command: {
            type: 'DiscardFromHand',
            investigatorId: investigator.id,
            amount: cost.amount,
            source: { cardId, window: 'action' },
          },
        },
      ];
    default:
      return assertNever(cost);
  }
}

/**
 * The act's own way to advance (Rules Reference, "Clues" and "Act Deck"): during any investigator's
 * turn, as a [free] ability, the investigators spend `clues` as a group and advance the act. No act
 * prints it, so the act builders add it for an act with a clue threshold; an act whose objective
 * replaces the requirement leaves it out.
 */
export function advanceBySpendingClues(clues: ScaledValue): CardAction {
  return {
    free: true,
    condition: { kind: 'investigatorTurn' },
    cost: { spend: 'groupClues', amount: clues },
    effects: [advanceAct()],
  };
}

/** Whether `action` is an act's `advanceBySpendingClues`: a group clue cost to advance the act. */
function advancesBySpendingClues({ cost, effects }: CardAction): boolean {
  return cost?.spend === 'groupClues' && effects.some((effect) => effect.type === 'AdvanceAct');
}

/**
 * The clues the investigators spend as a group to advance an act of `stats` with its
 * `advanceBySpendingClues` ability; none when it has no such ability.
 */
export function cluesToAdvance(stats: CardStats): ScaledValue | undefined {
  const cost = stats.actions?.find(advancesBySpendingClues)?.cost;
  return cost?.spend === 'groupClues' ? cost.amount : undefined;
}

/** The index (`UseCardAction.action`) of `act`'s `advanceBySpendingClues` ability; -1 when none. */
export function advanceActionOf(ctx: EngineContext, act: CardInstance): number {
  return (cardStats(ctx.cards, act.code).actions ?? []).findIndex(advancesBySpendingClues);
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
 * "[action] <cost>: Parley. <effects>": an action with the Parley designator, so it provokes no
 * attack of opportunity; the cost, limit and effects are the card's own, built from the usual
 * blocks (The Midnight Masks' cultists: `{ cost: { spend: 'clues', amount: 2 }, effects:
 * [addToVictoryDisplay({ ref: 'self' })] }`).
 */
export function parleyAction(action: Omit<CardAction, 'designator'>): CardAction {
  return { ...action, designator: 'parley' };
}

/**
 * Whether `investigator` may take the action abilities of `card` (Rules Reference, "Abilities"):
 * a revealed location's at that location, an enemy's at its location (engaged with them or not),
 * a card's in a threat area at its owner's location, and the current agenda's and act's anyone.
 * An unrevealed location has only its unrevealed side's text, so it offers none. A card an
 * investigator controls (`playArea`) offers none either: its abilities are its controller's to
 * use by hand, like a player card's, and the one story asset that comes there, Lita Chantler,
 * has an action only while nobody controls her.
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
    case 'playArea':
      return false;
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
  /** The action costs no action (`CardAction.free`). */
  readonly free?: true;
  /**
   * Which of the card's printed actions of the same kind (the same designator, or plain) this is,
   * counting from 1, when the card prints more than one, so each has a name of its own ("Action 2
   * · Parlor"). Counted over the printed actions, not the offered ones, so a name stays put when
   * a used-up action drops out. Absent when the card prints only one of its kind.
   */
  readonly number?: number;
}

/**
 * Every card action the cards in play offer `investigator` (`offersActionsTo`), their limits
 * still allow (`withinLimit`), the investigator can pay for (`canPay`) and meets the condition of
 * (`actionConditionHolds`), in the order of the
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
    return actions.flatMap(({ designator, free, limit, cost, condition }, action) =>
      withinLimit(state, card, action, limit, investigator.id) &&
      canPay(ctx, state, investigator, cost) &&
      actionConditionHolds(state, investigator, condition)
        ? [
            {
              cardId: card.id,
              action,
              ...(designator === undefined ? {} : { designator }),
              ...(free === undefined ? {} : { free }),
              ...numberOfKind(actions, action),
            },
          ]
        : [],
    );
  });
}

/**
 * One action ability as its card prints it (`LocationView.printedActions`): its designator, whether
 * it is free, and its `number` among the card's actions of the same kind (`OfferedCardAction`).
 */
export type PrintedActionView = Pick<OfferedCardAction, 'designator' | 'free' | 'number'>;

/**
 * How a card prints its `actions`, whoever may take them (`LocationView.printedActions`): each
 * one's designator, whether it is free, and its number among the actions of its kind, as
 * `cardActionsOfferedTo` numbers them.
 */
export function printedActions(actions: readonly CardAction[]): PrintedActionView[] {
  return actions.map(({ designator, free }, action) => ({
    ...(designator === undefined ? {} : { designator }),
    ...(free === undefined ? {} : { free }),
    ...numberOfKind(actions, action),
  }));
}

/**
 * `OfferedCardAction.number` of the printed action at index `action` among `actions`: its place
 * among the actions with its designator, when there is more than one of them. An act's
 * spend-clues advance doesn't count: the board shows it apart (`BoardView.act`).
 */
function numberOfKind(actions: readonly CardAction[], action: number): { number?: number } {
  const designator = actions[action]?.designator;
  const sameKind = actions.flatMap((printed, index) =>
    printed.designator === designator && !advancesBySpendingClues(printed) ? [index] : [],
  );
  return sameKind.length > 1 ? { number: sameKind.indexOf(action) + 1 } : {};
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
 * `UseCardAction`: checks that the investigator may take the action now, in their own turn
 * unless it is free,
 * where the card offers it (`offersActionsTo`, else `cardActionUnavailable`) and as its limit
 * allows (`withinLimit`, else `cardActionLimitReached`), that they meet its condition
 * (`actionConditionHolds`, else `cardActionConditionUnmet`) and that they can pay its cost (`canPay`,
 * else `cardActionCostUnpaid`); records the use (`CardActionUsed`) and pays the cost
 * (`costPayment`).
 * Its effects follow as ability steps (`cardActionSteps`).
 */
export function handleUseCardAction(
  ctx: EngineContext,
  state: GameState,
  cmd: UseCardAction,
): (CardActionUsed | InvestigatorChanged | CommandDeferred)[] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  const { free, limit, cost, condition } = cardActionOf(ctx, state, cmd);
  if (!free) requireTurnOf(state, investigator.id);
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
  if (!actionConditionHolds(state, investigator, condition))
    throw new CommandRejected({
      code: 'cardActionConditionUnmet',
      cardId: cmd.cardId,
      action: cmd.action,
      investigatorId: investigator.id,
    });
  if (!canPay(ctx, state, investigator, cost))
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
  return [used, ...costPayment(ctx, state, card.id, investigator, cost, cmd.spend)];
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
