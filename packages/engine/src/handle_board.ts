import {
  allConnections,
  revealEvents,
  sameEdge,
  validateConnections,
  validateEnds,
  validateGridCell,
  validateLayout,
  validateLocationCard,
} from './board';
import type { EngineContext } from './cards';
import type {
  AddConnection,
  AddMap,
  PutLocationIntoPlay,
  RemoveConnection,
  RevealLocation,
} from './commands';
import { isInPlay } from './doom';
import type {
  CardFlipped,
  CardMoved,
  ConnectionChanged,
  LayoutCellSet,
  MapAdded,
  TokensChanged,
} from './events';
import { moveCardEvent } from './placement';
import { requireCard } from './lookup';
import { createMap, layoutOf, type Edge } from './map';
import { CommandRejected } from './rejection';
import type { GameState } from './state';

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
  const map = createMap({ ...cmd.map, layout: layoutOf(cmd.locations) });
  const locationIds = cmd.locations.map(({ id }) => id);
  const moves = locationIds.map((cardId, i): CardMoved => {
    if (locationIds.indexOf(cardId) !== i)
      throw new CommandRejected({ code: 'duplicateCard', cardId });
    validateLocationCard(ctx, state.cards, cardId);
    const card = requireCard(state.cards, cardId);
    if (isInPlay(state, card)) throw new CommandRejected({ code: 'cardAlreadyInPlay', cardId });
    return moveCardEvent(card, { kind: 'location', mapId: cmd.mapId });
  });
  validateConnections(ctx, state.cards, { ...state.board.maps, [cmd.mapId]: map });
  validateLayout(cmd.mapId, map, new Set(locationIds));
  return [{ type: 'MapAdded', mapId: cmd.mapId, map }, ...moves];
}

/**
 * `PutLocationIntoPlay`: the map must be on the board and the card a location
 * card outside play. It stays unrevealed, as a location put into play is
 * unless the card says otherwise.
 */
export function handlePutLocationIntoPlay(
  ctx: EngineContext,
  state: GameState,
  cmd: PutLocationIntoPlay,
): [CardMoved] | [CardMoved, LayoutCellSet] {
  if (!state.board.maps[cmd.mapId])
    throw new CommandRejected({ code: 'unknownMap', mapId: cmd.mapId });
  validateLocationCard(ctx, state.cards, cmd.locationId);
  const card = requireCard(state.cards, cmd.locationId);
  if (isInPlay(state, card))
    throw new CommandRejected({ code: 'cardAlreadyInPlay', cardId: card.id });
  const moved = moveCardEvent(card, { kind: 'location', mapId: cmd.mapId });
  if (cmd.at === undefined) return [moved];
  validateGridCell(card.id, cmd.at);
  return [moved, { type: 'LayoutCellSet', mapId: cmd.mapId, cardId: card.id, at: cmd.at }];
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

/**
 * `RevealLocation`: flips the location and places its clues (`revealEvents`).
 */
export function handleRevealLocation(
  ctx: EngineContext,
  state: GameState,
  cmd: RevealLocation,
): (CardFlipped | TokensChanged)[] {
  return revealEvents(ctx, state, cmd.locationId);
}
