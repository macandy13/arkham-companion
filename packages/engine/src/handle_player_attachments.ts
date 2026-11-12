import { cardStats, type EngineContext } from './cards';
import type { AttachPlayerCard, DiscardPlayerAttachment } from './commands';
import { isInPlay } from './doom';
import type { PlayerAttachmentDiscarded, PlayerCardAttached } from './events';
import { cardName, playerAttachmentId, type InstanceId, type PlayerAttachmentId } from './ids';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { GameState } from './state';

/**
 * `AttachPlayerCard`: a new `PlayerAttachment` on an enemy or a location in play. Its ID counts
 * up per host, so it stays the same on replay.
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
  return [
    {
      type: 'PlayerCardAttached',
      attachment: {
        id: nextAttachmentId(state, host.id),
        hostId: host.id,
        name: cardName(name),
        ...(cmd.code !== undefined && { code: cmd.code }),
        restrictions: cmd.restrictions,
      },
    },
  ];
}

/** `DiscardPlayerAttachment`: the attachment leaves play; nothing when it is gone already. */
export function handleDiscardPlayerAttachment(
  state: GameState,
  cmd: DiscardPlayerAttachment,
): PlayerAttachmentDiscarded[] {
  const attachment = state.playerAttachments[cmd.attachmentId];
  return attachment === undefined ? [] : [{ type: 'PlayerAttachmentDiscarded', attachment }];
}

function nextAttachmentId(state: GameState, hostId: InstanceId): PlayerAttachmentId {
  const taken = new Set<string>(Object.keys(state.playerAttachments));
  let index = 1;
  while (taken.has(`${hostId}:attachment:${index}`)) index++;
  return playerAttachmentId(`${hostId}:attachment:${index}`);
}
