import { comparableName, type CardType, type EngineContext } from './cards';
import type { InstanceId } from './ids';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';

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

/** Every card of the state whose printed type is `typeCode`, wherever it is, in card order. */
export function cardsOfType(
  ctx: EngineContext,
  state: GameState,
  typeCode: CardType,
): CardInstance[] {
  return Object.values(state.cards).filter(
    (card) => ctx.cards.get(card.code)?.typeCode === typeCode,
  );
}

/**
 * Every card printed with `name` (compared with `comparableName`), optionally
 * only of one `typeCode`. Several cards can share a name, so the result is a
 * list and the caller decides what none or many mean (spawn asks the players,
 * for instance). Queries for one kind of card live next to it, e.g.
 * `locationsNamed` in `board.ts`.
 */
export function cardsNamed(
  ctx: EngineContext,
  state: GameState,
  name: string,
  { typeCode }: { typeCode?: CardType } = {},
): CardInstance[] {
  const wanted = comparableName(name);
  return Object.values(state.cards).filter((card) => {
    const stats = ctx.cards.get(card.code);
    return (
      stats !== undefined &&
      comparableName(stats.name) === wanted &&
      (typeCode === undefined || stats.typeCode === typeCode)
    );
  });
}
