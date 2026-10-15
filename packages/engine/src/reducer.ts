import { sameEdge } from './board';
import type {
  CardFlipped,
  CardMoved,
  ConnectionChanged,
  DeckShuffled,
  Event,
  InvestigatorChanged,
  InvestigatorDefeated,
  InvestigatorMoved,
  ScenarioStarted,
  TokensChanged,
} from './events';
import type { InstanceId } from './ids';
import type { Edge } from './map';
import { seedRng } from './rng';
import { withStatDelta } from './investigators';
import { emptyState, type CardInstance, type GameState, type Investigator } from './state';
import { zoneKey, type ZoneKey } from './zone';

/** Pure reducer: applies one event and returns the next state. Never mutates `state`. */
export function apply(state: GameState, event: Event): GameState {
  switch (event.type) {
    case 'ScenarioStarted':
      return applyScenarioStarted(event);
    case 'DeckShuffled':
      return applyDeckShuffled(state, event);
    case 'CardMoved':
      return applyCardMoved(state, event);
    case 'TokensChanged':
      return applyTokensChanged(state, event);
    case 'CardFlipped':
      return applyCardFlipped(state, event);
    case 'ConnectionChanged':
      return applyConnectionChanged(state, event);
    case 'InvestigatorMoved':
      return applyInvestigator(state, event, (inv) => ({ ...inv, locationId: event.to }));
    case 'InvestigatorChanged':
      return applyInvestigator(state, event, (inv) => withStatDelta(inv, event.stat, event.delta));
    case 'InvestigatorDefeated':
      return applyInvestigator(state, event, (inv) => ({ ...inv, status: 'defeated' }));
  }
}

/** Folds a list of events over an initial state (default: empty state). */
export function replay(events: readonly Event[], initial: GameState = emptyState()): GameState {
  return events.reduce(apply, initial);
}

function applyScenarioStarted(e: ScenarioStarted): GameState {
  const base = emptyState();
  const cards: Record<InstanceId, CardInstance> = {};
  const order: Record<ZoneKey, InstanceId[]> = {};
  for (const card of e.cards) {
    cards[card.id] = card;
    const key = zoneKey(card.zone);
    (order[key] ??= []).push(card.id);
  }
  return {
    ...base,
    meta: {
      ...base.meta,
      scenarioId: e.scenarioId,
      difficulty: e.difficulty,
      playerCount: e.investigators.length,
      seed: e.seed,
      rngState: seedRng(e.seed),
      leadInvestigator: e.investigators[0]?.id,
    },
    ...(e.campaign ? { campaign: e.campaign } : {}),
    investigators: e.investigators,
    cards,
    order,
    board: { ...base.board, maps: e.maps },
    chaosBag: e.chaosBag,
  };
}

function applyDeckShuffled(state: GameState, e: DeckShuffled): GameState {
  return {
    ...state,
    meta: { ...state.meta, rngState: e.rngState },
    order: withZoneOrder(state.order, zoneKey(e.zone), e.order),
  };
}

function applyCardMoved(state: GameState, e: CardMoved): GameState {
  const card = state.cards[e.cardId];
  if (!card) return state;
  // Remove from the card's actual zone; `e.from` is informational.
  const fromKey = zoneKey(card.zone);
  const toKey = zoneKey(e.to);
  let order = withZoneOrder(state.order, fromKey, without(state.order[fromKey] ?? [], e.cardId));
  order = withZoneOrder(order, toKey, insertedAt(order[toKey] ?? [], e.cardId, e.index));
  return {
    ...state,
    cards: { ...state.cards, [e.cardId]: { ...card, zone: e.to } },
    order,
  };
}

function applyTokensChanged(state: GameState, e: TokensChanged): GameState {
  const card = state.cards[e.cardId];
  if (!card) return state;
  const tokens = { ...card.tokens };
  const value = (tokens[e.token] ?? 0) + e.delta;
  if (value === 0) delete tokens[e.token];
  else tokens[e.token] = value;
  return { ...state, cards: { ...state.cards, [e.cardId]: { ...card, tokens } } };
}

function applyCardFlipped(state: GameState, e: CardFlipped): GameState {
  const card = state.cards[e.cardId];
  if (!card) return state;
  return { ...state, cards: { ...state.cards, [e.cardId]: { ...card, faceUp: e.faceUp } } };
}

function applyConnectionChanged(state: GameState, e: ConnectionChanged): GameState {
  const map = state.board.maps[e.mapId];
  if (!map) return state;
  let connections: Edge[];
  switch (e.change) {
    case 'added':
      connections = [...map.connections, e.edge];
      break;
    case 'removed':
      connections = map.connections.filter((edge) => !sameEdge(edge, e.edge));
      break;
  }
  return {
    ...state,
    board: { ...state.board, maps: { ...state.board.maps, [e.mapId]: { ...map, connections } } },
  };
}

/** Replaces the event's investigator with `update(investigator)`; unknown IDs leave the state as is. */
function applyInvestigator(
  state: GameState,
  event: InvestigatorMoved | InvestigatorChanged | InvestigatorDefeated,
  update: (investigator: Investigator) => Investigator,
): GameState {
  return {
    ...state,
    investigators: state.investigators.map((inv) =>
      inv.id === event.investigatorId ? update(inv) : inv,
    ),
  };
}

/** Sets a zone's order; empty zones are removed so the state has one canonical form. */
function withZoneOrder(
  order: Record<ZoneKey, InstanceId[]>,
  key: ZoneKey,
  ids: InstanceId[],
): Record<ZoneKey, InstanceId[]> {
  const next = { ...order };
  if (ids.length === 0) delete next[key];
  else next[key] = ids;
  return next;
}

/** Copy of `ids` without `id`. */
function without(ids: readonly InstanceId[], id: InstanceId): InstanceId[] {
  return ids.filter((other) => other !== id);
}

/** Copy of `ids` with `id` inserted at `index` (0 = top); appended when `index` is omitted. */
function insertedAt(ids: readonly InstanceId[], id: InstanceId, index?: number): InstanceId[] {
  const next = ids.slice();
  next.splice(index ?? next.length, 0, id);
  return next;
}
