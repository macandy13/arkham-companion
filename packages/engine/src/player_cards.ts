import { cardDbWith, cardStats, type EngineContext } from './cards';
import type { AttachPlayerCard } from './commands';
import { isInPlay } from './doom';
import type { PlayerCardAttached } from './events';
import { cardCode, cardName, instanceId, type InstanceId } from './ids';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';

/**
 * `ctx` with the card data of the player cards on the table (`GameState.playerCards`) next to the
 * scenario's, so every card lookup finds an attached player card like any other card. The engine's
 * entry points (`handle`, `BoardView`) read the state through it.
 */
export function gameContext(ctx: EngineContext, state: GameState): EngineContext {
  const playerCards = Object.values(state.playerCards);
  return playerCards.length === 0 ? ctx : { ...ctx, cards: cardDbWith(ctx.cards, playerCards) };
}

/** Whether `card` is a player card the players put on the table (`AttachPlayerCard`). */
export function isPlayerCard(state: GameState, card: CardInstance): boolean {
  return card.code in state.playerCards;
}

/**
 * `AttachPlayerCard`: a new card attached to an enemy or a location in play, with the card data the
 * players gave it. Its ID counts up per host, so it stays the same on replay, and it is its code
 * too: two copies of one card may have been given different abilities.
 */
export function handleAttachPlayerCard(
  ctx: EngineContext,
  state: GameState,
  cmd: AttachPlayerCard,
): PlayerCardAttached[] {
  const host = requireCard(state.cards, cmd.hostId);
  const type = cardStats(ctx.cards, host.code).typeCode;
  if (!isInPlay(state, host) || (type !== 'enemy' && type !== 'location'))
    throw new CommandRejected({ code: 'invalidAttachmentHost', cardId: host.id });
  const name = cmd.name.trim();
  if (!name) throw new CommandRejected({ code: 'unnamedAttachment', cardId: host.id });
  const id = nextPlayerCardId(state, host.id);
  return [
    {
      type: 'PlayerCardAttached',
      cardId: id,
      hostId: host.id,
      stats: {
        code: cardCode(id),
        name: cardName(name),
        typeCode: cmd.typeCode,
        traits: [],
        restrictions: cmd.restrictions,
      },
    },
  ];
}

function nextPlayerCardId(state: GameState, hostId: InstanceId): InstanceId {
  let index = 1;
  while (state.cards[instanceId(`${hostId}:player_card:${index}`)] !== undefined) index++;
  return instanceId(`${hostId}:player_card:${index}`);
}
