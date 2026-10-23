import { isNonNegativeInteger } from '@arkham/util';
import { cardStats, resolveValue, type EngineContext, type LocationAttachment } from './cards';
import type { CardFlipped, TokensChanged } from './events';
import type { InstanceId, MapId } from './ids';
import { cardsInZone, cardsNamed, cardsOfType, requireCard } from './lookup';
import type { Edge, GameMap, GridCell } from './map';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';

/**
 * True if both edges are the same connection: an undirected edge matches in
 * either direction, a one-way edge only exactly, and the two kinds never match.
 */
export function sameEdge(a: Edge, b: Edge): boolean {
  if (a.oneWay !== b.oneWay) return false;
  if (a.from === b.from && a.to === b.to) return true;
  return !a.oneWay && a.from === b.to && a.to === b.from;
}

/** Every connection on the board with the map that owns it, in map order. */
export function allConnections(state: GameState): { mapId: MapId; edge: Edge }[] {
  return (Object.entries(state.board.maps) as [MapId, GameMap][]).flatMap(([mapId, map]) =>
    map.connections.map((edge) => ({ mapId, edge })),
  );
}

/**
 * Locations an investigator or enemy at `locationId` can move to in one step,
 * in the order the edges were added. An edge only counts while both of its
 * locations are on a map (zone `location`): scenario data may connect locations
 * that are still set aside, and these connections wake up once both are in play.
 * Edges may cross maps: every map's edges count, wherever their ends are.
 */
export function neighbours(state: GameState, locationId: InstanceId): InstanceId[] {
  if (!isLocationInPlay(state, locationId)) return [];
  const result = new Set<InstanceId>();
  for (const { edge } of allConnections(state)) {
    if (!isLocationInPlay(state, edge.from) || !isLocationInPlay(state, edge.to)) continue;
    if (edge.from === locationId) result.add(edge.to);
    else if (!edge.oneWay && edge.to === locationId) result.add(edge.from);
  }
  return [...result];
}

/**
 * Every shortest path from `from` to `to` over `neighbours`, each including both
 * ends. `[[from]]` when they are the same location, `[]` when `to` cannot be
 * reached. Hunter enemies and movement need all of them because ties are
 * resolved by the players, never guessed by the engine.
 */
export function shortestPaths(state: GameState, from: InstanceId, to: InstanceId): InstanceId[][] {
  if (!isLocationInPlay(state, from) || !isLocationInPlay(state, to)) return [];
  return pathsBack(shortestPathPredecessors(state, from, to), from, to);
}

/**
 * Whether the card is a location currently on a map. Named for locations
 * because "in play" is a broader game-rule notion (any card in a play area).
 */
export function isLocationInPlay(state: GameState, id: InstanceId): boolean {
  return state.cards[id]?.zone.kind === 'location';
}

/**
 * The card `id` as a location on a map, for a command that names a
 * destination; rejects an unknown card (`unknownCard`) and any other card
 * (`notALocation`).
 */
export function requireLocationInPlay(state: GameState, id: InstanceId): CardInstance {
  const card = requireCard(state.cards, id);
  if (card.zone.kind !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId: id });
  return card;
}

/** The location cards currently on a map, in card order. */
export function locationsInPlay(ctx: EngineContext, state: GameState): CardInstance[] {
  return cardsOfType(ctx, state, 'location').filter((card) => isLocationInPlay(state, card.id));
}

/**
 * The location cards printed with `name` (see `cardsNamed`); with `inPlay` only
 * those on a map. Without it a location that is set aside or out of the game
 * counts too, which lets a spawn tell "no such location" from "not in play".
 */
export function locationsNamed(
  ctx: EngineContext,
  state: GameState,
  name: string,
  { inPlay = false }: { inPlay?: boolean } = {},
): CardInstance[] {
  const named = cardsNamed(ctx, state, name, { typeCode: 'location' });
  return inPlay ? named.filter((card) => isLocationInPlay(state, card.id)) : named;
}

/**
 * Breadth-first search from `from`, stopping after the level that reaches `to`.
 * Maps each visited location to all its neighbours one step closer to `from`.
 */
function shortestPathPredecessors(
  state: GameState,
  from: InstanceId,
  to: InstanceId,
): Map<InstanceId, InstanceId[]> {
  const predecessors = new Map<InstanceId, InstanceId[]>([[from, []]]);
  let frontier = [from];
  while (frontier.length > 0 && !predecessors.has(to)) {
    const next: InstanceId[] = [];
    for (const current of frontier) {
      for (const neighbour of neighbours(state, current)) {
        const known = predecessors.get(neighbour);
        if (known === undefined) {
          predecessors.set(neighbour, [current]);
          next.push(neighbour);
        } else if (next.includes(neighbour)) {
          // Discovered earlier on this same level, so this is an equally short route.
          known.push(current);
        }
      }
    }
    frontier = next;
  }
  return predecessors;
}

/** Expands the predecessor map into the paths ending at `to`. */
function pathsBack(
  predecessors: ReadonlyMap<InstanceId, InstanceId[]>,
  from: InstanceId,
  to: InstanceId,
): InstanceId[][] {
  if (!predecessors.has(to)) return [];
  if (to === from) return [[from]];
  return (predecessors.get(to) ?? []).flatMap((previous) =>
    pathsBack(predecessors, from, previous).map((path) => [...path, to]),
  );
}

/** The cards attached to `location` that came there through `CardStats.locationAttachment`, with it. */
export function locationAttachments(
  ctx: EngineContext,
  state: GameState,
  location: CardInstance,
): { card: CardInstance; attachment: LocationAttachment }[] {
  return cardsInZone(state, { kind: 'attachedTo', hostId: location.id }).flatMap((cardId) => {
    const card = requireCard(state.cards, cardId);
    const attachment = cardStats(ctx.cards, card.code).locationAttachment;
    return attachment ? [{ card, attachment }] : [];
  });
}

/** The shroud of `location`: the printed value plus what its attachments add (`LocationAttachment.shroud`). */
export function locationShroud(
  ctx: EngineContext,
  state: GameState,
  location: CardInstance,
): number {
  return locationAttachments(ctx, state, location).reduce(
    (shroud, { attachment }) => shroud + (attachment.shroud ?? 0),
    cardStats(ctx.cards, location.code).shroud ?? 0,
  );
}

/**
 * Rejects `cardId` unless it is a known location card. Where it currently is
 * does not matter: connections may name locations that are still set aside.
 */
export function validateLocationCard(
  ctx: EngineContext,
  cards: Readonly<Record<InstanceId, CardInstance>>,
  cardId: InstanceId,
): void {
  const card = requireCard(cards, cardId);
  if (cardStats(ctx.cards, card.code).typeCode !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId });
}

/**
 * Rejects starting maps whose connections name non-locations or self-loops, or
 * repeat an edge (also across maps, since an edge is stored on exactly one map).
 * The ends may be on any map; see `AddConnection` for who owns a cross-map edge.
 */
export function validateConnections(
  ctx: EngineContext,
  cards: Readonly<Record<InstanceId, CardInstance>>,
  maps: Readonly<Record<MapId, GameMap>>,
): void {
  const edges = Object.values(maps).flatMap((map) => map.connections);
  edges.forEach((edge, i) => {
    validateEnds(ctx, cards, edge);
    if (edges.slice(0, i).some((earlier) => sameEdge(earlier, edge)))
      throw new CommandRejected({ code: 'duplicateConnection', from: edge.from, to: edge.to });
  });
}

/**
 * Checks a map's book layout: every cell belongs to one of the map's own locations (`onMap`) and
 * is a pair of non-negative integers, so a typo in scenario data fails at setup, not on screen.
 */
export function validateLayout(mapId: MapId, map: GameMap, onMap: ReadonlySet<InstanceId>): void {
  for (const [cardId, { column, row }] of Object.entries(map.layout) as [InstanceId, GridCell][]) {
    if (!onMap.has(cardId)) throw new CommandRejected({ code: 'layoutNotOnMap', cardId, mapId });
    if (!isNonNegativeInteger(column) || !isNonNegativeInteger(row))
      throw new CommandRejected({ code: 'invalidGridCell', cardId, column, row });
  }
}

/** Rejects an edge whose ends are not known location cards, or are the same card. */
export function validateEnds(
  ctx: EngineContext,
  cards: Readonly<Record<InstanceId, CardInstance>>,
  edge: Edge,
): void {
  validateLocationCard(ctx, cards, edge.from);
  validateLocationCard(ctx, cards, edge.to);
  if (edge.from === edge.to)
    throw new CommandRejected({ code: 'selfConnection', cardId: edge.from });
}

/**
 * The events of revealing a location: it flips and, if it has clues, they are
 * placed (its printed `clues`, resolved for the player count – the same amount
 * setup places on locations that start revealed). For `RevealLocation` and for
 * a move onto an unrevealed location. Rejects a card that is not a location in
 * play or is already revealed.
 */
export function revealEvents(
  ctx: EngineContext,
  state: GameState,
  locationId: InstanceId,
): (CardFlipped | TokensChanged)[] {
  const card = requireCard(state.cards, locationId);
  if (card.zone.kind !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId: card.id });
  if (card.faceUp) throw new CommandRejected({ code: 'alreadyRevealed', cardId: card.id });

  const flipped: CardFlipped = { type: 'CardFlipped', cardId: card.id, faceUp: true };
  const printed = cardStats(ctx.cards, card.code).clues;
  const clues = printed ? resolveValue(printed, state.meta.playerCount) : 0;
  if (clues === 0) return [flipped];
  return [flipped, { type: 'TokensChanged', cardId: card.id, token: 'clue', delta: clues }];
}
