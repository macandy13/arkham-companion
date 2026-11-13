import { cardStats, type CardStats, type EngineContext } from './cards';
import type { AttachPlayerCard } from './commands';
import { isInPlay } from './doom';
import type { PlayerCardAttached } from './events';
import { instanceId, type InstanceId } from './ids';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';

/**
 * Whether `card` is a player card (an asset or an event the players put on the table, such as
 * one they attached), which goes back to its owner rather than to the encounter discard. A story
 * asset is an asset too, but of an encounter set.
 */
export function isPlayerCard(ctx: EngineContext, card: CardInstance): boolean {
  return isPlayerCardStats(cardStats(ctx.cards, card.code));
}

/**
 * `AttachPlayerCard`: a new card attached to an enemy or a location in play. Its ID counts up per
 * host, so it stays the same on replay.
 */
export function handleAttachPlayerCard(
  ctx: EngineContext,
  state: GameState,
  cmd: AttachPlayerCard,
): PlayerCardAttached[] {
  const host = requireCard(state.cards, cmd.hostId);
  const hostType = cardStats(ctx.cards, host.code).typeCode;
  if (!isInPlay(state, host) || (hostType !== 'enemy' && hostType !== 'location'))
    throw new CommandRejected({ code: 'invalidAttachmentHost', cardId: host.id });
  if (!isPlayerCardStats(cardStats(ctx.cards, cmd.code)))
    throw new CommandRejected({ code: 'notAPlayerCard', cardCode: cmd.code });
  return [
    {
      type: 'PlayerCardAttached',
      cardId: nextPlayerCardId(state, host.id),
      code: cmd.code,
      hostId: host.id,
    },
  ];
}

function isPlayerCardStats({ typeCode, encounterCode }: CardStats): boolean {
  return (typeCode === 'asset' || typeCode === 'event') && encounterCode === undefined;
}

function nextPlayerCardId(state: GameState, hostId: InstanceId): InstanceId {
  let index = 1;
  while (state.cards[instanceId(`${hostId}:player_card:${index}`)] !== undefined) index++;
  return instanceId(`${hostId}:player_card:${index}`);
}
