import type { InstanceId } from './ids';
import { CommandRejected } from './rejection';
import type { CardInstance } from './state';

/**
 * The card with id `cardId`; throws `CommandRejected` (`unknownCard`) if there
 * is none. Shared by the handlers so every command refers to a missing card
 * with the same rejection instead of each repeating the lookup and check.
 */
export function requireCard(
  cards: Readonly<Record<InstanceId, CardInstance>>,
  cardId: InstanceId,
): CardInstance {
  const card = cards[cardId];
  if (!card) throw new CommandRejected({ code: 'unknownCard', cardId });
  return card;
}
