import { allConnections, sameEdge } from './board';
import { cardStats, resolveValue, type EngineContext } from './cards';
import type { AddConnection, AddMap, RemoveConnection, RevealLocation } from './commands';
import { isInPlay } from './doom';
import type { CardFlipped, CardMoved, ConnectionChanged, MapAdded, TokensChanged } from './events';
import { moveCardEvent } from './placement';
import type { InstanceId, MapId } from './ids';
import { requireCard } from './lookup';
import { createMap, type Edge, type GameMap } from './map';
import { CommandRejected } from './rejection';
import type { CardInstance, GameState } from './state';

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

/** `AddConnection`: validates the map and both ends, and rejects an edge that already exists. */
export function handleAddConnection(
  ctx: EngineContext,
  state: GameState,
  cmd: AddConnection,
): [ConnectionChanged] {
  if (!state.board.maps[cmd.mapId])
    throw new CommandRejected({ code: 'unknownMap', mapId: cmd.mapId });
  const edge = validatedEdge(ctx, state, cmd);
  if (allConnections(state).some(({ edge: existing }) => sameEdge(existing, edge)))
    throw new CommandRejected({ code: 'duplicateConnection', from: edge.from, to: edge.to });
  return [{ type: 'ConnectionChanged', change: 'added', mapId: cmd.mapId, edge }];
}

/**
 * `AddMap`: the map must be new and each location a location card outside
 * play, named once; its connections are validated like starting ones,
 * against every edge already on the board.
 */
export function handleAddMap(
  ctx: EngineContext,
  state: GameState,
  cmd: AddMap,
): [MapAdded, ...CardMoved[]] {
  if (state.board.maps[cmd.mapId])
    throw new CommandRejected({ code: 'duplicateMap', mapId: cmd.mapId });
  const map = createMap(cmd.map);
  const moves = cmd.locations.map((cardId, i): CardMoved => {
    if (cmd.locations.indexOf(cardId) !== i)
      throw new CommandRejected({ code: 'duplicateCard', cardId });
    validateLocationCard(ctx, state.cards, cardId);
    const card = requireCard(state.cards, cardId);
    if (isInPlay(state, card)) throw new CommandRejected({ code: 'cardAlreadyInPlay', cardId });
    return moveCardEvent(card, { kind: 'location', mapId: cmd.mapId });
  });
  validateConnections(ctx, state.cards, { ...state.board.maps, [cmd.mapId]: map });
  return [{ type: 'MapAdded', mapId: cmd.mapId, map }, ...moves];
}

/** `RemoveConnection`: finds the map that owns the edge; rejects an edge that is not on the board. */
export function handleRemoveConnection(
  ctx: EngineContext,
  state: GameState,
  cmd: RemoveConnection,
): [ConnectionChanged] {
  const edge = validatedEdge(ctx, state, cmd);
  const owned = allConnections(state).find(({ edge: existing }) => sameEdge(existing, edge));
  if (!owned)
    throw new CommandRejected({ code: 'connectionNotFound', from: edge.from, to: edge.to });
  return [{ type: 'ConnectionChanged', change: 'removed', mapId: owned.mapId, edge: owned.edge }];
}

/** The edge a connection command describes, after checking both ends. */
function validatedEdge(
  ctx: EngineContext,
  state: GameState,
  cmd: AddConnection | RemoveConnection,
): Edge {
  const edge: Edge = { from: cmd.from, to: cmd.to, oneWay: cmd.oneWay ?? false };
  validateEnds(ctx, state.cards, edge);
  return edge;
}

/** Rejects an edge whose ends are not known location cards, or are the same card. */
function validateEnds(
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
 * `RevealLocation`: flips the location and, if it has clues, places them
 * (its printed `clues`, resolved for the player count – the same amount setup
 * places on locations that start revealed).
 */
export function handleRevealLocation(
  ctx: EngineContext,
  state: GameState,
  cmd: RevealLocation,
): (CardFlipped | TokensChanged)[] {
  const card = requireCard(state.cards, cmd.locationId);
  if (card.zone.kind !== 'location')
    throw new CommandRejected({ code: 'notALocation', cardId: card.id });
  if (card.faceUp) throw new CommandRejected({ code: 'alreadyRevealed', cardId: card.id });

  const flipped: CardFlipped = { type: 'CardFlipped', cardId: card.id, faceUp: true };
  const printed = cardStats(ctx.cards, card.code).clues;
  const clues = printed ? resolveValue(printed, state.meta.playerCount) : 0;
  if (clues === 0) return [flipped];
  return [flipped, { type: 'TokensChanged', cardId: card.id, token: 'clue', delta: clues }];
}
