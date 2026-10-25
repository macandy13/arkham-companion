import type { AbilityEffect, AbilityStep } from './abilities';
import { isLocationInPlay } from './board';
import { cardStats, type EngineContext } from './cards';
import type { UseCardAction } from './commands';
import { locationOf } from './enemies';
import { activeInvestigator } from './investigators';
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
  readonly effects: readonly AbilityEffect[];
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
 * a location's at that location, an enemy's at its location (engaged with them or not), a card's
 * in a threat area only its owner, and the current agenda's and act's anyone.
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
      return isLocationInPlay(state, card.id) && here === card.id;
    case 'atLocation':
      return here === zone.locationId;
    case 'engaged':
      return here === locationOf(state, card);
    case 'threatArea':
      return zone.investigatorId === investigator.id;
    default:
      return (
        currentCard(state, 'agenda')?.id === card.id || currentCard(state, 'act')?.id === card.id
      );
  }
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
 * `UseCardAction`: checks that the investigator may take the action now, in their own turn and
 * where the card offers it (`offersActionsTo`, else `cardActionUnavailable`). It changes nothing
 * itself: its effects follow as ability steps (`cardActionSteps`).
 */
export function handleUseCardAction(ctx: EngineContext, state: GameState, cmd: UseCardAction): [] {
  const investigator = activeInvestigator(state, cmd.investigatorId);
  requireTurnOf(state, investigator.id);
  cardActionOf(ctx, state, cmd);
  if (!offersActionsTo(state, requireCard(state.cards, cmd.cardId), investigator))
    throw new CommandRejected({
      code: 'cardActionUnavailable',
      cardId: cmd.cardId,
      investigatorId: investigator.id,
    });
  return [];
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
