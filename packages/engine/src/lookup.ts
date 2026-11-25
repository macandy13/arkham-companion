import { findInvestigator } from './investigators';
import type { StageDeck } from './commands';
import { assertNever } from '@arkham/util';
import {
  cardStats,
  comparableName,
  type CardStats,
  type CardType,
  type EngineContext,
  type Trait,
} from './cards';
import { cardName, instanceId, type CardCode, type CardName, type InstanceId } from './ids';
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

/** The printed name of `card`, from its card data. */
export function cardNameOf(ctx: EngineContext, card: CardInstance): CardName {
  return cardName(cardStats(ctx.cards, card.code).name);
}

/** The zone the card `cardId` is in; undefined for a card not in the state. */
export function zoneOf(state: GameState, cardId: InstanceId): Zone | undefined {
  return state.cards[cardId]?.zone;
}

/** Ids of the cards in `zone`, in zone order (top first for piles). */
export function cardsInZone(state: GameState, zone: Zone): readonly InstanceId[] {
  return state.order[zoneKey(zone)] ?? [];
}

/**
 * The cards in `zone`, in zone order (top first for piles). Skips an id with no card, so the board
 * printer still shows a broken state; `cardNamesIn` throws on one instead.
 */
export function cardsIn(state: GameState, zone: Zone): CardInstance[] {
  return cardsInZone(state, zone).flatMap((id) => state.cards[id] ?? []);
}

/** The printed names of the cards in `zone`, in zone order. */
export function cardNamesIn(ctx: EngineContext, state: GameState, zone: Zone): CardName[] {
  return cardsInZone(state, zone).map((id) => cardNameOf(ctx, requireCard(state.cards, id)));
}

/** The `n`-th set-aside copy of `code`, counted from 0 in zone order; none when fewer are left. */
export function setAsideCopyOf(
  state: GameState,
  code: CardCode,
  n: number,
): InstanceId | undefined {
  return cardsInZone(state, { kind: 'setAside' }).filter((id) => state.cards[id]?.code === code)[n];
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
export function currentCard(state: GameState, deck: StageDeck): CardInstance | undefined {
  const id = state[deck].current;
  return id === undefined ? undefined : state.cards[id];
}

/**
 * The current card of the agenda or act deck; rejects (`noCurrentCard`) when the deck has none, before
 * setup or once it is used up.
 */
export function requireCurrentCard(state: GameState, deck: StageDeck): CardInstance {
  const id = state[deck].current;
  if (id === undefined) throw new CommandRejected({ code: 'noCurrentCard', deck });
  return requireCard(state.cards, id);
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
 * Which cards a card's text means by what is printed on them: the copies of `code`, those named
 * `name`, or any of a list of names ("Hallway or Parlor"; compared ignoring case and a trailing full
 * stop, as card text writes names), those with `trait` and without `withoutTrait`
 * ("each non-Elite enemy"), those of type `typeCode`, and with `unique` only unique ones. A field
 * left out matches every card. The one description of a card's print: references filter with it
 * (`eachInZone`, `eachInPlay`, and with what the table adds `eachEnemy` and `locationWith`), and so
 * does a matched encounter draw (`DrawPick`).
 */
export interface CardFilter {
  code?: CardCode;
  name?: string | readonly string[];
  trait?: Trait;
  withoutTrait?: Trait;
  typeCode?: CardType;
  unique?: true;
}

/**
 * The cards in `zones` that `filter` matches, zone by zone in zone order ("each [[Elite]] enemy
 * in the victory display and beneath the act"); with `top`, among the top `top` cards of each. A card beneath another one counts only face up:
 * facedown it shows no traits.
 */
export function cardsInZones(
  ctx: EngineContext,
  state: GameState,
  zones: readonly Zone[],
  filter: CardFilter,
  top?: number,
): CardInstance[] {
  return zones
    .flatMap((zone) =>
      cardsInZone(state, zone)
        .slice(0, top)
        .map((id) => requireCard(state.cards, id))
        .filter((card) => zone.kind !== 'beneath' || card.faceUp),
    )
    .filter((card) => matchesCard(ctx, card, filter));
}

/**
 * Whether `card` has what `filter` asks to be printed on it. A card the `CardDb` lacks shows no
 * print, so it matches only a filter that asks for nothing but its code.
 */
export function matchesCard(ctx: EngineContext, card: CardInstance, filter: CardFilter): boolean {
  const stats = ctx.cards.get(card.code);
  if (stats !== undefined) return matchesStats(stats, filter);
  const { code, ...printed } = filter;
  return (code === undefined || code === card.code) && Object.keys(printed).length === 0;
}

/** Whether the card printed as `stats` has what `filter` asks for. */
export function matchesStats(stats: CardStats, filter: CardFilter): boolean {
  return (
    (filter.code === undefined || stats.code === filter.code) &&
    (filter.name === undefined ||
      [filter.name].flat().some((name) => comparableName(name) === comparableName(stats.name))) &&
    (filter.trait === undefined || stats.traits.includes(filter.trait)) &&
    (filter.withoutTrait === undefined || !stats.traits.includes(filter.withoutTrait)) &&
    (filter.typeCode === undefined || stats.typeCode === filter.typeCode) &&
    (filter.unique === undefined || stats.unique === true)
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
      return findInvestigator(state, zone.investigatorId)?.locationId;
    case 'attachedTo': {
      const host = state.cards[zone.hostId];
      // Hosting cycles are rejected when cards are placed, so the recursion ends.
      return host === undefined ? undefined : locationOfCard(state, host);
    }
    case 'encounterDeck':
    case 'encounterDiscard':
    case 'setAside':
    case 'scenarioDeck':
    case 'victoryDisplay':
    case 'outOfGame':
    case 'resolving':
    case 'agendaDeck':
    case 'actDeck':
    case 'beneath':
      return undefined;
    default:
      return assertNever(zone);
  }
}

/**
 * The cards whose location (`locationOfCard`) is `locationId`: unlike `cardsAtLocation`, also the
 * location itself, the enemies engaged with and the cards in play of investigators there, and the
 * attachments, for "at [its] location" abilities.
 */
export function cardsWhoseLocationIs(state: GameState, locationId: InstanceId): CardInstance[] {
  return Object.values(state.cards).filter((card) => locationOfCard(state, card) === locationId);
}

/**
 * An ID for a card that comes into the game (an attached player card, a drawn weakness) that
 * `state` doesn't hold yet: `prefix:1`, `prefix:2`, … The count, not a random ID, keeps it the
 * same on replay.
 */
export function newCardId(state: GameState, prefix: string): InstanceId {
  let index = 1;
  while (state.cards[instanceId(`${prefix}:${index}`)] !== undefined) index++;
  return instanceId(`${prefix}:${index}`);
}
