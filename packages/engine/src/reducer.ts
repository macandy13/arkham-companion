import { insertedAt, withEntry, without } from '@arkham/util';
import type { CardMoved, DeckShuffled, Event, ScenarioStarted, TokensChanged } from './events';
import type { InstanceId } from './ids';
import { seedRng } from './rng';
import { emptyState, type CardInstance, type GameState } from './state';
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
  const value = (card.tokens[e.token] ?? 0) + e.delta;
  const tokens = withEntry(card.tokens, e.token, value === 0 ? undefined : value);
  return { ...state, cards: { ...state.cards, [e.cardId]: { ...card, tokens } } };
}

/** Sets a zone's order; empty zones are removed so the state has one canonical form. */
function withZoneOrder(
  order: Record<ZoneKey, InstanceId[]>,
  key: ZoneKey,
  ids: InstanceId[],
): Record<ZoneKey, InstanceId[]> {
  return withEntry(order, key, ids.length === 0 ? undefined : ids);
}
