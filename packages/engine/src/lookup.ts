import { comparableName, type CardType, type EngineContext } from './cards';
import type { InstanceId } from './ids';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';
import { zoneKey, type Zone } from './zone';

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

/** The zone the card `cardId` is in; undefined for a card not in the state. */
export function zoneOf(state: GameState, cardId: InstanceId): Zone | undefined {
  return state.cards[cardId]?.zone;
}

/** Ids of the cards in `zone`, in zone order (top first for piles). */
export function cardsInZone(state: GameState, zone: Zone): readonly InstanceId[] {
  return state.order[zoneKey(zone)] ?? [];
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
 * The cards placed unengaged at `locationId` (zone `atLocation`: enemies,
 * and other cards put there), in card order. Enemies engaged with an
 * investigator standing there are in that investigator's threat area, not
 * here; `enemiesAt` (`handle_enemy.ts`) counts both.
 */
export function cardsAtLocation(state: GameState, locationId: InstanceId): CardInstance[] {
  return Object.values(state.cards).filter(
    (card) => card.zone.kind === 'atLocation' && card.zone.locationId === locationId,
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

/** The current card of the agenda or act deck; none before setup or once the deck is used up. */
export function currentCard(state: GameState, deck: 'agenda' | 'act'): CardInstance | undefined {
  const id = state[deck].current;
  return id === undefined ? undefined : state.cards[id];
}
