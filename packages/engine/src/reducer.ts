import { withoutKey } from '@arkham/util';
import { sameEdge } from './board';
import type {
  CardFlipped,
  CardMoved,
  ConnectionChanged,
  DeckShuffled,
  DecisionRequested,
  Defeat,
  EnemyDefeated,
  EnemyDisengaged,
  EnemyEngaged,
  InvestigatorDefeated,
  Event,
  LayoutCellSet,
  MapAdded,
  ScenarioEnded,
  ScenarioStarted,
  TokensChanged,
} from './events';
import type { InstanceId } from './ids';
import type { Edge } from './map';
import { seedRng } from './rng';
import { withStatDelta } from './investigators';
import {
  emptyState,
  type CardInstance,
  type GameState,
  type Investigator,
  type SkillName,
} from './state';
import { zoneKey, type Zone, type ZoneKey } from './zone';

/**
 * A defeated or resigned investigator is out of the scenario; if it happens
 * during their turn, the turn ends with them (it counts as taken), so the
 * group can go on with the next investigator.
 */
function applyInvestigatorLeft(
  state: GameState,
  investigatorId: Investigator['id'],
  left: Pick<Investigator, 'status' | 'defeat'>,
): GameState {
  const after = applyInvestigator(state, { investigatorId }, (inv) => ({ ...inv, ...left }));
  return state.meta.turn?.investigatorId === investigatorId
    ? endTurn(after, investigatorId)
    : after;
}

function defeatOf(event: InvestigatorDefeated): Defeat {
  if (event.cause !== 'cardEffect') return { cause: event.cause };
  return { cause: 'cardEffect', ...(event.trauma === undefined ? {} : { trauma: event.trauma }) };
}

function endTurn(state: GameState, investigatorId: Investigator['id']): GameState {
  const meta = withoutKey(state.meta, 'turn');
  return { ...state, meta: { ...meta, turnsTaken: [...meta.turnsTaken, investigatorId] } };
}

/** Pure reducer: applies one event and returns the next state. Never mutates `state`. */
export function apply(state: GameState, event: Event): GameState {
  switch (event.type) {
    case 'ScenarioStarted':
      return applyScenarioStarted(event);
    case 'DeckShuffled':
      return applyDeckShuffled(state, event);
    case 'CardMoved':
      return applyCardMoved(state, event);
    case 'SurgeGained':
      return updateCard(state, event.cardId, (card) => ({ ...card, gainedSurge: true }));
    case 'CardActionUsed': {
      const use = {
        action: event.action,
        investigatorId: event.investigatorId,
        round: state.meta.round,
      };
      return updateCard(state, event.cardId, (card) => ({
        ...card,
        actionUses: [...(card.actionUses ?? []), use],
      }));
    }
    case 'TokensChanged':
      return applyTokensChanged(state, event);
    case 'CardFlipped':
      return applyCardFlipped(state, event);
    case 'ConnectionChanged':
      return applyConnectionChanged(state, event);
    case 'MapAdded':
      return applyMapAdded(state, event);
    case 'LayoutCellSet':
      return applyLayoutCellSet(state, event);
    case 'InvestigatorMoved':
      return applyInvestigator(state, event, (inv) => ({ ...inv, locationId: event.to }));
    case 'InvestigatorChanged':
      return applyInvestigator(state, event, (inv) => withStatDelta(inv, event.stat, event.delta));
    case 'InvestigatorDefeated':
      return applyInvestigatorLeft(state, event.investigatorId, {
        status: 'defeated',
        defeat: defeatOf(event),
      });
    case 'InvestigatorResigned':
      return applyInvestigatorLeft(state, event.investigatorId, { status: 'resigned' });
    case 'LeadInvestigatorChanged':
      return { ...state, meta: { ...state.meta, leadInvestigator: event.investigatorId } };
    case 'DecisionRequested':
      return applyDecisionRequested(state, event);
    case 'DecisionResolved':
      return { ...state, pending: state.pending.filter((d) => d.id !== event.decisionId) };
    case 'AgendaAdvanced':
    case 'ActAdvanced':
      return withoutDecisionsAbout(state, event.cardId);
    case 'CurrentCardChanged':
      return { ...state, [event.deck]: { current: event.cardId } };
    case 'ScenarioEnded':
      return applyScenarioEnded(state, event);
    case 'EncounterCardDrawn':
    case 'AbilityEffectSkipped':
    case 'CommandDeferred':
    case 'CluesDiscovered':
    case 'SkillTestResolved':
    case 'EnemyAttacked':
    case 'EnemyEvaded':
      return state;
    case 'EnemyEngaged':
      return applyEnemyMoved(state, event, {
        kind: 'engaged',
        investigatorId: event.investigatorId,
      });
    case 'EnemyDisengaged':
      return applyEnemyMoved(state, event, { kind: 'atLocation', locationId: event.locationId });
    case 'EnemyDefeated':
      return applyEnemyDefeated(state, event);
    case 'ExhaustChanged':
      return updateCard(state, event.cardId, (card) => ({ ...card, exhausted: event.exhausted }));
    case 'PhaseChanged':
      return {
        ...state,
        meta: { ...state.meta, phase: event.phase, round: event.round, steps: event.steps },
      };
    case 'PhaseStepsChanged':
      return { ...state, meta: { ...state.meta, steps: event.steps } };
    case 'RoundEnded':
      return { ...state, meta: { ...state.meta, turnsTaken: [] } };
    case 'TurnStarted':
      return {
        ...state,
        meta: {
          ...state.meta,
          turn: { investigatorId: event.investigatorId },
        },
      };
    case 'ActionsAdjusted':
      return applyInvestigator(state, event, (inv) => ({
        ...inv,
        actionsRemaining: inv.actionsRemaining + event.delta,
      }));
    case 'SkillBoostChanged':
      return applyInvestigator(state, event, (inv) =>
        withSkillBoost(inv, event.skill, event.delta),
      );
    case 'ActionsReset':
      return applyInvestigator(state, event, (inv) => ({
        ...inv,
        actionsRemaining: event.actions,
      }));
    case 'TurnEnded':
      return endTurn(state, event.investigatorId);
    case 'StepsQueued':
      return {
        ...state,
        meta: { ...state.meta, queue: [...event.steps, ...(state.meta.queue ?? [])] },
      };
    case 'StepResumed':
    case 'ActionDropped':
      return withoutFirstQueuedStep(state);
  }
}

/** Takes the step that resolves now off `GameMeta.queue`, dropping the queue once it is empty. */
function withoutFirstQueuedStep(state: GameState): GameState {
  const rest = state.meta.queue?.slice(1) ?? [];
  const meta = withoutKey(state.meta, 'queue');
  return { ...state, meta: rest.length > 0 ? { ...meta, queue: rest } : meta };
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
    agenda: { current: order[zoneKey({ kind: 'agendaDeck' })]?.[0] },
    act: { current: order[zoneKey({ kind: 'actDeck' })]?.[0] },
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
  return moveCard(state, e.cardId, e.to, e.index);
}

/** Moves a card to `to` (position `index`, default the end); unknown cards leave the state as is. */
function moveCard(state: GameState, cardId: InstanceId, to: Zone, index?: number): GameState {
  const card = state.cards[cardId];
  if (!card) return state;
  // Remove from the card's actual zone; the event's `from` is informational.
  const fromKey = zoneKey(card.zone);
  const toKey = zoneKey(to);
  let order = withZoneOrder(state.order, fromKey, without(state.order[fromKey] ?? [], cardId));
  order = withZoneOrder(order, toKey, insertedAt(order[toKey] ?? [], cardId, index));
  // A gained surge belongs to one draw of the card, wherever its revelation puts it; drawing it again starts afresh.
  const kept = to.kind === 'resolving' ? withoutKey(card, 'gainedSurge') : card;
  return { ...state, cards: { ...state.cards, [cardId]: { ...kept, zone: to } }, order };
}

/** Engagement changes: the enemy moves and any open question about it is answered. */
function applyEnemyMoved(state: GameState, e: EnemyEngaged | EnemyDisengaged, to: Zone): GameState {
  return withoutDecisionsAbout(moveCard(state, e.enemyId, to), e.enemyId);
}

function applyEnemyDefeated(state: GameState, e: EnemyDefeated): GameState {
  // The top of the discard is where "topmost" effects look; a defeated enemy keeps nothing it carried.
  const moved = moveCard(state, e.enemyId, e.to, e.to.kind === 'encounterDiscard' ? 0 : undefined);
  const cleared = updateCard(moved, e.enemyId, (card) => ({
    ...card,
    exhausted: false,
    tokens: {},
  }));
  return withoutDecisionsAbout(cleared, e.enemyId);
}

/** Replaces one card with `update(card)`; unknown cards leave the state as is. */
function updateCard(
  state: GameState,
  cardId: InstanceId,
  update: (card: CardInstance) => CardInstance,
): GameState {
  const card = state.cards[cardId];
  if (!card) return state;
  return { ...state, cards: { ...state.cards, [cardId]: update(card) } };
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

function applyDecisionRequested(state: GameState, e: DecisionRequested): GameState {
  return { ...state, pending: [...state.pending, e.decision] };
}

function applyMapAdded(state: GameState, e: MapAdded): GameState {
  return { ...state, board: { ...state.board, maps: { ...state.board.maps, [e.mapId]: e.map } } };
}

function applyLayoutCellSet(state: GameState, e: LayoutCellSet): GameState {
  const map = state.board.maps[e.mapId];
  if (!map) return state;
  const layout = { ...map.layout, [e.cardId]: e.at };
  return {
    ...state,
    board: { ...state.board, maps: { ...state.board.maps, [e.mapId]: { ...map, layout } } },
  };
}

function applyScenarioEnded(state: GameState, e: ScenarioEnded): GameState {
  const resolution = e.resolution === undefined ? {} : { resolution: e.resolution };
  return { ...state, meta: { ...state.meta, ended: true, ...resolution } };
}

/** Drops pending decisions about a card that has advanced or left play, so none outlives its subject. */
function withoutDecisionsAbout(state: GameState, cardId: InstanceId): GameState {
  return { ...state, pending: state.pending.filter((d) => d.subject !== cardId) };
}

/** Replaces the event's investigator with `update(investigator)`; unknown IDs leave the state as is. */
function applyInvestigator(
  state: GameState,
  event: { investigatorId: Investigator['id'] },
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

/** `inv` with the boost of `skill` changed by `delta`; a boost back at 0 is left out. */
function withSkillBoost(inv: Investigator, skill: SkillName, delta: number): Investigator {
  const boost = (inv.skillBoosts?.[skill] ?? 0) + delta;
  const others = withoutKey(inv.skillBoosts ?? {}, skill);
  const skillBoosts = boost === 0 ? others : { ...others, [skill]: boost };
  if (Object.keys(skillBoosts).length > 0) return { ...inv, skillBoosts };
  return withoutKey(inv, 'skillBoosts');
}
