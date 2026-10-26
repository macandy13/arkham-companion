import { assertNever, withoutKey } from '@arkham/util';
import type { EngineContext } from './cards';
import type { Adjustment, ManualAdjust, MoveCard } from './commands';
import { agendaThresholdDecision } from './doom';
import type { ActionsAdjusted, CardMoved, Event, SkillBoostChanged, TokensChanged } from './events';
import type { InstanceId } from './ids';
import { activeInvestigator } from './investigators';
import { requireCard } from './lookup';
import { cardMoved } from './placement';
import { apply } from './reducer';
import { CommandRejected } from './rejection';
import type { GameState } from './state';
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

/** `MoveCard`: the same move a `ManualAdjust` makes, as a game event. */
export function handleMoveCard(state: GameState, cmd: MoveCard): CardMoved {
  return cardMoved(state, requireCard(state.cards, cmd.cardId), cmd.to, cmd.index);
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
