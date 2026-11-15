import type { AttachmentHost, CardStats } from '@arkham/engine';
import { playerCardDefs } from '@arkham/scenarios';

/**
 * The player cards the players can attach to a card of type `host` from its details
 * (`AttachedCards`): those of every scenario's card data (`playerCardDefs`) that attach to it
 * (`CardStats.attachesTo`), in their listed order.
 */
export function attachableCards(host: AttachmentHost): readonly CardStats[] {
  return playerCardDefs.filter(({ attachesTo }) => attachesTo === host);
}
