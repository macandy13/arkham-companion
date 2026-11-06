import { isNonNegativeInteger } from '@arkham/util';
import {
  cardStats,
  printedSymbols,
  printsConnectionTo,
  resolveValue,
  type EngineContext,
  type LocationAttachment,
  type PrintedSymbols,
} from './cards';
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
 * What the location `card` prints on the side that is up: its symbol and the symbols it
 * connects to change when it is revealed.
 */
export function shownSymbols(ctx: EngineContext, card: CardInstance): PrintedSymbols {
  return printedSymbols(cardStats(ctx.cards, card.code), card.faceUp ? 'revealed' : 'unrevealed');
}

/**
 * The connections the locations in play print, from the sides that are up: an edge between two
 * locations when one's connection symbols name the other's symbol, one-way when only one of them
 * prints it, since a move follows the symbols on the card it starts from (RR "Move"). They are
 * derived on each call instead of stored, so revealing a location or one entering or leaving play
 * changes them with nothing to recompute. Maps don't matter: the symbols connect across them.
 */
export function printedConnections(ctx: EngineContext, state: GameState): Edge[] {
  const shown = locationsInPlay(ctx, state).map((card) => ({
    id: card.id,
    symbols: shownSymbols(ctx, card),
  }));
  return shown.flatMap((a, i) =>
    shown.slice(i + 1).flatMap((b): Edge[] => {
      const ab = printsConnectionTo(a.symbols, b.symbols);
      const ba = printsConnectionTo(b.symbols, a.symbols);
      if (ab) return [{ from: a.id, to: b.id, oneWay: !ba }];
      return ba ? [{ from: b.id, to: a.id, oneWay: true }] : [];
    }),
  );
}

/**
 * Every connection that holds now: the printed ones (`printedConnections`), then the open ones the
 * maps declare for what no card prints (`GameMap.connections`: card text such as the Main Path's
 * "is connected to each other Woods location", or an effect), less those the printed ones already
 * make.
 */
export function openConnections(ctx: EngineContext, state: GameState): Edge[] {
  const printed = printedConnections(ctx, state);
  const declared = allConnections(state)
    .map(({ edge }) => edge)
    .filter((edge) => isConnectionOpen(state, edge))
    .filter((edge) => !allowsEveryMove(printed, edge));
  return joinOpposites([...printed, ...declared]);
}

/**
 * `edges` with each pair of opposite one-way edges joined into one two-way edge, where the first
 * of them stood: a printed one way and a declared way back (a revealed Woods and the Main Path)
 * are one connection to draw and list.
 */
function joinOpposites(edges: readonly Edge[]): Edge[] {
  const joined: Edge[] = [];
  for (const edge of edges) {
    const back = edge.oneWay
      ? joined.findIndex(
          (other) => other.oneWay && other.from === edge.to && other.to === edge.from,
        )
      : -1;
    const earlier = joined[back];
    if (earlier) joined[back] = { ...earlier, oneWay: false };
    else joined.push(edge);
  }
  return joined;
}

/** Whether `edges` already allow each move `edge` allows: from its `from`, and back unless one-way. */
function allowsEveryMove(edges: readonly Edge[], edge: Edge): boolean {
  const leads = (from: InstanceId, to: InstanceId) => neighboursOver(edges, from).includes(to);
  return leads(edge.from, edge.to) && (edge.oneWay || leads(edge.to, edge.from));
}

/**
 * Locations an investigator or enemy at `locationId` can move to in one step, over
 * `openConnections`: a one-way edge only from its `from`.
 */
export function neighbours(
  ctx: EngineContext,
  state: GameState,
  locationId: InstanceId,
): InstanceId[] {
  if (!isLocationInPlay(state, locationId)) return [];
  return neighboursOver(openConnections(ctx, state), locationId);
}

/** The locations `edges` let a move from `locationId` go to, in edge order. */
function neighboursOver(edges: readonly Edge[], locationId: InstanceId): InstanceId[] {
  const result = new Set<InstanceId>();
  for (const edge of edges) {
    if (edge.from === locationId) result.add(edge.to);
    else if (!edge.oneWay && edge.to === locationId) result.add(edge.from);
  }
  return [...result];
}

/**
 * True while a declared edge connects its locations: both are on a map. A scenario may declare
 * edges to locations still set aside; they wake up once both are in play.
 */
export function isConnectionOpen(state: GameState, edge: Edge): boolean {
  return isLocationInPlay(state, edge.from) && isLocationInPlay(state, edge.to);
}

/**
 * Every shortest path from `from` to `to` over `neighbours`, each including both
 * ends. `[[from]]` when they are the same location, `[]` when `to` cannot be
 * reached. Hunter enemies and movement need all of them because ties are
 * resolved by the players, never guessed by the engine.
 */
export function shortestPaths(
  ctx: EngineContext,
  state: GameState,
  from: InstanceId,
  to: InstanceId,
): InstanceId[][] {
  if (!isLocationInPlay(state, from) || !isLocationInPlay(state, to)) return [];
  return pathsBack(shortestPathPredecessors(ctx, state, from, to), from, to);
}

/** The distinct locations `paths` (from `shortestPaths`) go to first: where a one-step move along them can go. */
export function firstSteps(paths: readonly (readonly InstanceId[])[]): InstanceId[] {
  return [...new Set(paths.flatMap((path) => path.slice(1, 2)))];
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
  ctx: EngineContext,
  state: GameState,
  from: InstanceId,
  to: InstanceId,
): Map<InstanceId, InstanceId[]> {
  // Derived once for the whole search, since every location in play takes part in it.
  const edges = openConnections(ctx, state);
  const predecessors = new Map<InstanceId, InstanceId[]>([[from, []]]);
  let frontier = [from];
  while (frontier.length > 0 && !predecessors.has(to)) {
    const next: InstanceId[] = [];
    for (const current of frontier) {
      for (const neighbour of neighboursOver(edges, current)) {
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
    validateGridCell(cardId, { column, row });
  }
}

/** Rejects a layout cell for `cardId` that is not a pair of non-negative integers. */
export function validateGridCell(cardId: InstanceId, { column, row }: GridCell): void {
  if (!isNonNegativeInteger(column) || !isNonNegativeInteger(row))
    throw new CommandRejected({ code: 'invalidGridCell', cardId, column, row });
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
