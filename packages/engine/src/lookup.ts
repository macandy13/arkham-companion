import { comparableName, type CardType, type EngineContext, type Trait } from './cards';
import type { CardCode, InstanceId } from './ids';
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

/**
 * The id of the only copy of `code` in the game, any zone; none when there is no copy or several,
 * so a card effect naming it ("the Hallway", `onlyCopy`) can't pick the wrong one.
 */
export function theOnlyCopy(state: GameState, code: CardCode): InstanceId | undefined {
  const copies = Object.values(state.cards).filter((card) => card.code === code);
  return copies.length === 1 ? copies[0]?.id : undefined;
}

/**
 * Which cards a card's text means by what is printed on them: those with `trait`, the copies of
 * `code`, those of type `typeCode`, and with `unique` only unique ones. A field left out matches
 * every card. The `eachInZone` reference filters with it.
 */
export interface CardFilter {
  trait?: Trait;
  code?: CardCode;
  typeCode?: CardType;
  unique?: true;
}

/**
 * The cards in `zones` that `filter` matches, zone by zone in zone order ("each [[Elite]] enemy
 * in the victory display and beneath the act"). A card beneath another one counts only face up:
 * facedown it shows no traits.
 */
export function cardsInZones(
  ctx: EngineContext,
  state: GameState,
  zones: readonly Zone[],
  filter: CardFilter,
): CardInstance[] {
  return zones
    .flatMap((zone) =>
      cardsInZone(state, zone)
        .map((id) => requireCard(state.cards, id))
        .filter((card) => zone.kind !== 'beneath' || card.faceUp),
    )
    .filter((card) => matchesCard(ctx, card, filter));
}

/** Whether `card` has what `filter` asks to be printed on it. */
export function matchesCard(ctx: EngineContext, card: CardInstance, filter: CardFilter): boolean {
  const stats = ctx.cards.get(card.code);
  return (
    (filter.code === undefined || card.code === filter.code) &&
    (filter.trait === undefined || stats?.traits.includes(filter.trait) === true) &&
    (filter.typeCode === undefined || stats?.typeCode === filter.typeCode) &&
    (filter.unique === undefined || stats?.unique === true)
  );
}

/**
 * The location `card` is at: a location is at itself, a card placed at a location is there, and a
 * card engaged with an investigator or in their threat or play area is where that investigator
 * is; an attachment is where its host is. None for a card off the table or an investigator
 * without a location.
 */
export function locationOfCard(state: GameState, card: CardInstance): InstanceId | undefined {
  const zone = card.zone;
  switch (zone.kind) {
    case 'location':
      return card.id;
    case 'atLocation':
      return zone.locationId;
    case 'engaged':
    case 'threatArea':
    case 'playArea':
      return state.investigators.find(({ id }) => id === zone.investigatorId)?.locationId;
    case 'attachedTo': {
      const host = state.cards[zone.hostId];
      // Hosting cycles are rejected when cards are placed, so the recursion ends.
      return host === undefined ? undefined : locationOfCard(state, host);
    }
    default:
      return undefined;
  }
}
