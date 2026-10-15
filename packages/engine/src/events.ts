import type { InstanceId, InvestigatorId, MapId } from './ids';
import type { Edge, GameMap } from './map';
import type { RngState } from './rng';
import type {
  CampaignLog,
  CardInstance,
  ChaosToken,
  Decision,
  Difficulty,
  Investigator,
  InvestigatorStat,
  TokenKind,
} from './state';
import type { Zone } from './zone';

/**
 * Events are facts: they carry everything needed to apply them, so the
 * reducer never needs to validate, generate IDs or draw random numbers.
 */
export type Event =
  | ScenarioStarted
  | DeckShuffled
  | CardMoved
  | TokensChanged
  | CardFlipped
  | ConnectionChanged
  | InvestigatorMoved
  | InvestigatorChanged
  | InvestigatorDefeated
  | DecisionRequested
  | AgendaAdvanced
  | ActAdvanced
  | ScenarioEnded;

/** A scenario was set up; replaces the whole state. Produced by `StartScenario`. */
export interface ScenarioStarted {
  type: 'ScenarioStarted';
  scenarioId: string;
  difficulty: Difficulty;
  seed: number;
  investigators: Investigator[];
  /** Every map with its connections, written to `board.maps` as one unit. */
  maps: Record<MapId, GameMap>;
  /** All card instances in their initial zones; list order = order within each zone. */
  cards: CardInstance[];
  chaosBag: ChaosToken[];
  campaign?: CampaignLog;
}

/** A zone (usually the encounter deck) was shuffled using the state's RNG. */
export interface DeckShuffled {
  type: 'DeckShuffled';
  zone: Zone;
  /** New order of the zone, top first. */
  order: InstanceId[];
  /** RNG state after the shuffle. */
  rngState: RngState;
}

/** A card instance changed zone or position within its zone. */
export interface CardMoved {
  type: 'CardMoved';
  cardId: InstanceId;
  from: Zone;
  to: Zone;
  /** Position in the destination zone (0 = top). Omitted = bottom/end. */
  index?: number;
}

/** Tokens of one kind were added to (`delta` > 0) or removed from a card. */
export interface TokensChanged {
  type: 'TokensChanged';
  cardId: InstanceId;
  token: TokenKind;
  delta: number;
}

/**
 * A card was turned over (location revealed, later agenda/act advanced).
 * Produced by `RevealLocation`, which follows it with a `TokensChanged` for the clues.
 */
export interface CardFlipped {
  type: 'CardFlipped';
  cardId: InstanceId;
  /** The side that is showing afterwards. */
  faceUp: boolean;
}

/**
 * An edge was added to or removed from `GameMap.connections` of map `mapId`.
 * Produced by `AddConnection`/`RemoveConnection`; `edge` is the stored edge,
 * so removal matches exactly what was added.
 */
export interface ConnectionChanged {
  type: 'ConnectionChanged';
  change: 'added' | 'removed';
  /** The map that owns the edge. */
  mapId: MapId;
  edge: Edge;
}

/** An investigator is now at location `to`. Produced by `MoveInvestigator`. */
export interface InvestigatorMoved {
  type: 'InvestigatorMoved';
  investigatorId: InvestigatorId;
  to: InstanceId;
}

/**
 * One of an investigator's counters changed by `delta`. Produced by
 * `AdjustInvestigator` and `DiscoverClues`; the reducer adds `delta` as is.
 */
export interface InvestigatorChanged {
  type: 'InvestigatorChanged';
  investigatorId: InvestigatorId;
  stat: InvestigatorStat;
  delta: number;
}

/**
 * An investigator ran out of health (`damage`) or sanity (`horror`); their status
 * becomes `defeated`. Produced by `AdjustInvestigator` right after the
 * `InvestigatorChanged` that caused it.
 */
export interface InvestigatorDefeated {
  type: 'InvestigatorDefeated';
  investigatorId: InvestigatorId;
  cause: 'damage' | 'horror';
}

/**
 * The players have to answer `decision`; it is added to `GameState.pending`.
 * Produced by `PlaceDoom` and `AdjustInvestigator` when the doom threshold is
 * reached ('advanceAgenda'); M1.9 generalises this for all decisions.
 */
export interface DecisionRequested {
  type: 'DecisionRequested';
  decision: Decision;
}

/**
 * The agenda `cardId` was advanced and `nextId` is now the current agenda
 * (absent after the last one). Follows the `CardFlipped`/`CardMoved` that take
 * the old agenda out of play; also drops decisions about the old agenda.
 * Produced by `AdvanceAgenda`.
 */
export interface AgendaAdvanced {
  type: 'AgendaAdvanced';
  cardId: InstanceId;
  nextId?: InstanceId;
}

/** Like `AgendaAdvanced`, for the act deck. Produced by `AdvanceAct`. */
export interface ActAdvanced {
  type: 'ActAdvanced';
  cardId: InstanceId;
  nextId?: InstanceId;
}

/**
 * The scenario is over with the given resolution (`GameMeta.resolution`), which
 * the campaign records. Produced by `AdvanceAgenda`/`AdvanceAct` when the last
 * card of a deck advances.
 */
export interface ScenarioEnded {
  type: 'ScenarioEnded';
  resolution: string;
}

/** String literal of every event type. */
export type EventType = Event['type'];
