import { assertNever, withoutKey } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import type { Adjustment, ManualAdjust, MoveCard } from './commands';
import { agendaThresholdDecision, isInPlay } from './doom';
import type { ActionsAdjusted, CardMoved, Event, SkillBoostChanged, TokensChanged } from './events';
import type { InstanceId } from './ids';
import { activeInvestigator } from './investigators';
import { cardsInZone, requireCard } from './lookup';
import { cardMoved, clearTokensEvents, discardEncounterCard, limitReached } from './placement';
import { apply, replay } from './reducer';
import { readyEnemyEngagements } from './engagement';
import { discardPileOf } from './player_cards';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { attachedTo, type Zone } from './zone';
import { actionsAdjusted } from './turns';

/**
 * Rejects moving the current agenda or act: `GameState.agenda.current` would
 * point at a card outside its deck. Advancing is the only way to change it.
 */
function assertNotCurrentStage(state: GameState, cardId: InstanceId): void {
  const deck =
    state.agenda.current === cardId ? 'agenda' : state.act.current === cardId ? 'act' : undefined;
  if (deck) throw new CommandRejected({ code: 'currentStageCard', cardId, deck });
}

/**
 * `MoveCard`: the same move a `ManualAdjust` makes, as a game event. A card it takes out of play (to
 * a deck or pile, the victory display, set aside, out of the game or beneath a card) leaves its
 * tokens and attachments behind first, is readied, and a keyword it granted enemies goes with it
 * (`engagementsOnceGrantsLeave`); a player card sent to the encounter discard goes out of the game
 * (Rules Reference, "Leaves Play"; "Escape the Dorms" removes Your Friend's Room with its Fire! and sets
 * the Servant of Flame aside healed); a correction moves the card alone. A card whose limit is
 * reached there (`limitReached`) does not move: the limit keeps it out, so a revelation leaves it
 * in `resolving`, to be discarded.
 */
export function handleMoveCard(ctx: EngineContext, state: GameState, cmd: MoveCard): Event[] {
  const card = requireCard(state.cards, cmd.cardId);
  // A player card discarded from the table goes back to its owner, out of the scenario's game.
  const to: Zone = cmd.to.kind === 'encounterDiscard' ? discardPileOf(ctx, card) : cmd.to;
  if (limitReached(ctx, state, card.id, to)) return [];
  const moved = cardMoved(state, card, to, cmd.index);
  if (!leavesPlay(state, card, to)) return [moved];
  const attachments = cardsInZone(state, attachedTo(card.id)).flatMap((attachedId) =>
    discardEncounterCard(ctx, state, attachedId),
  );
  // Cards enter play ready (RR "Ready"), so an evaded enemy set aside comes back able to engage.
  const readied: Event[] = card.exhausted
    ? [{ type: 'ExhaustChanged', cardId: card.id, exhausted: false }]
    : [];
  const left = [...attachments, ...clearTokensEvents(card), ...readied, moved];
  return [...left, ...engagementsOnceGrantsLeave(ctx, state, left)];
}

/** Whether moving `card` to `to` takes it out of play: to a deck or pile, set aside, out of the game or beneath a card. */
function leavesPlay(state: GameState, card: CardInstance, to: Zone): boolean {
  return isInPlay(state, card) && !isInPlay(state, { ...card, zone: to });
}

/**
 * A card that gave enemies a keyword (Hiding Spot's aloof) takes it along as it leaves play, so a
 * ready enemy left unengaged next to an investigator engages them (RR "Enemy Engagement").
 */
function engagementsOnceGrantsLeave(ctx: EngineContext, state: GameState, left: Event[]): Event[] {
  const grantsLeft = left.some(
    (event) =>
      event.type === 'CardMoved' &&
      cardStats(ctx.cards, requireCard(state.cards, event.cardId).code).keywordGrants !== undefined,
  );
  return grantsLeft ? readyEnemyEngagements(ctx, replay(left, state)) : [];
}

/**
 * `ManualAdjust`: the correction's own event, then, after added doom, the
 * "advance the agenda?" question if the threshold is now reached. A
 * correction fires no forced effects, but the players may have put the doom
 * on late that the mythos check missed, so the engine asks rather than
 * advancing on its own or staying silent.
 */
export function handleManualAdjust(
  ctx: EngineContext,
  state: GameState,
  command: ManualAdjust,
): Event[] {
  const event = handleAdjustment(state, command.adjustment);
  // After the end nothing could answer the question (`scenarioEnded`), and no agenda advances any more.
  if (
    event.type !== 'TokensChanged' ||
    event.token !== 'doom' ||
    event.delta < 0 ||
    state.meta.ended
  )
    return [event];
  return [event, ...agendaThresholdDecision(ctx, apply(state, event))];
}

function handleAdjustment(
  state: GameState,
  adj: Adjustment,
): CardMoved | TokensChanged | ActionsAdjusted | SkillBoostChanged {
  switch (adj.kind) {
    case 'actions':
      return actionsAdjusted(state, adj.investigatorId, adj.delta);
    case 'skillBoost':
      return skillBoostChanged(state, adj);
    case 'moveCard': {
      const card = requireCard(state.cards, adj.cardId);
      assertNotCurrentStage(state, card.id);
      return cardMoved(state, card, adj.to, adj.index);
    }
    case 'tokens': {
      const card = requireCard(state.cards, adj.cardId);
      if (!Number.isInteger(adj.delta) || adj.delta === 0) {
        throw new CommandRejected({ code: 'invalidTokenDelta', delta: adj.delta });
      }
      if ((card.tokens[adj.token] ?? 0) + adj.delta < 0) {
        throw new CommandRejected({
          code: 'negativeTokens',
          cardId: card.id,
          token: adj.token,
          current: card.tokens[adj.token] ?? 0,
          delta: adj.delta,
        });
      }
      return { type: 'TokensChanged', cardId: card.id, token: adj.token, delta: adj.delta };
    }
    default:
      return assertNever(adj);
  }
}

/** The `SkillBoostChanged` of a `skillBoost` correction: a whole, non-zero change for an active investigator. */
function skillBoostChanged(
  state: GameState,
  adj: Extract<Adjustment, { kind: 'skillBoost' }>,
): SkillBoostChanged {
  activeInvestigator(state, adj.investigatorId);
  if (!Number.isInteger(adj.delta) || adj.delta === 0)
    throw new CommandRejected({ code: 'invalidModifierAmount', amount: adj.delta });
  return { type: 'SkillBoostChanged', ...withoutKey(adj, 'kind') };
}
