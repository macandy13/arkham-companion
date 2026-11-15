import { cardStats, type EngineContext } from './cards';
import type { UseReaction } from './commands';
import type { ReactionUsed } from './events';
import type { InvestigatorId } from './ids';
import { activeInvestigator } from './investigators';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { withinLimit, type UsageLimit } from './usage_limits';

/**
 * `UseReaction`: the investigator triggers the card's reaction, recorded for its limit
 * (`ReactionUsed`). Rejected for a card that isn't in the game, an investigator who left it, or a
 * limit used up since the reaction was offered (`reactionLimitReached`): two offers of it may wait
 * at once, and only the first answered may be used.
 */
export function handleUseReaction(
  ctx: EngineContext,
  state: GameState,
  cmd: UseReaction,
): ReactionUsed[] {
  const card = requireCard(state.cards, cmd.cardId);
  activeInvestigator(state, cmd.investigatorId);
  const limit = cardStats(ctx.cards, card.code).abilities?.[cmd.ability]?.reaction?.limit;
  if (!reactionWithinLimit(state, card, cmd.ability, limit, cmd.investigatorId))
    throw new CommandRejected({
      code: 'reactionLimitReached',
      cardId: cmd.cardId,
      ability: cmd.ability,
      investigatorId: cmd.investigatorId,
    });
  return [
    {
      type: 'ReactionUsed',
      cardId: cmd.cardId,
      ability: cmd.ability,
      investigatorId: cmd.investigatorId,
    },
  ];
}

/**
 * Whether `limit` lets `investigatorId` trigger reaction number `ability` of `card` once more,
 * counting its earlier uses (`CardInstance.reactionUses`).
 */
export function reactionWithinLimit(
  state: GameState,
  card: CardInstance,
  ability: number,
  limit: UsageLimit | undefined,
  investigatorId: InvestigatorId,
): boolean {
  const uses = (card.reactionUses ?? []).filter((use) => use.ability === ability);
  return withinLimit(state, uses, limit, investigatorId);
}
