import type { InstanceId, InvestigatorId, MapId } from './ids';
import type { MapSpec } from './map';
import type {
  CampaignLog,
  ChaosToken,
  Difficulty,
  Investigator,
  InvestigatorStat,
  TokenKind,
} from './state';
import type { Zone } from './zone';

/** Commands are intents from the UI; `handle` validates them and produces events. */
export type Command =
  | StartScenario
  | ManualAdjust
  | AddConnection
  | RemoveConnection
  | RevealLocation
  | MoveInvestigator
  | AdjustInvestigator
  | DiscoverClues
  | PlaceDoom
  | AdvanceAgenda
  | AdvanceAct
  | EndScenario;

/** A card instance to create when the scenario starts. */
export interface StartingCard {
  /** Explicit instance ID, so other starting cards can reference it. Defaults to `c<index>`. */
  id?: InstanceId;
  code: string;
  zone: Zone;
  faceUp?: boolean;
  /** Tokens the card starts with (doom placed by setup, clues on a revealed location, …). */
  tokens?: Partial<Record<TokenKind, number>>;
}

/**
 * Sets up a scenario from scratch: investigators, maps and every card instance
 * in its initial zone. Produces `ScenarioStarted` and, unless disabled, a
 * `DeckShuffled` for the encounter deck. `compileSetup` builds this command
 * from a `ScenarioDefinition`. An investigator's `locationId` must name a
 * starting card in a `location` zone.
 */
export interface StartScenario {
  type: 'StartScenario';
  scenarioId: string;
  difficulty: Difficulty;
  seed: number;
  investigators: Investigator[];
  /** Maps with their connections; each edge must join two starting locations of that map. */
  maps?: Record<MapId, MapSpec>;
  cards: StartingCard[];
  chaosBag?: ChaosToken[];
  campaign?: CampaignLog;
  /** Shuffle the encounter deck after setup (default true). */
  shuffleEncounterDeck?: boolean;
}

/** Manual correction by the players ("assistant, not referee"). */
export interface ManualAdjust {
  type: 'ManualAdjust';
  adjustment: Adjustment;
}

/** The concrete corrections a `ManualAdjust` can make. */
export type Adjustment =
  | { kind: 'moveCard'; cardId: InstanceId; to: Zone; index?: number }
  | { kind: 'tokens'; cardId: InstanceId; token: TokenKind; delta: number };

/**
 * Connects two location cards (a card effect or scenario step). The cards may
 * still be set aside: the edge only takes part in movement while both are on a
 * map. Produces `ConnectionChanged`.
 *
 * An edge is stored on exactly one map (`GameMap.connections`), the one named
 * by `mapId`; its ends may be on any map. For an edge between two maps, pick
 * the map the edge is drawn on or conceptually belongs to (setup uses the map
 * of the `addMap` step that declares it). Movement ignores the owner.
 */
export interface AddConnection {
  type: 'AddConnection';
  /** The map that stores the edge. */
  mapId: MapId;
  from: InstanceId;
  to: InstanceId;
  /** One-way edges only allow movement from `from` to `to`. Default false. */
  oneWay?: boolean;
}

/**
 * Removes an existing edge from whichever map owns it (no `mapId` needed, an
 * edge exists once on the board). An undirected edge matches in either direction; a
 * one-way edge must match `from` and `to` exactly. Produces `ConnectionChanged`.
 */
export interface RemoveConnection {
  type: 'RemoveConnection';
  from: InstanceId;
  to: InstanceId;
  oneWay?: boolean;
}

/**
 * Turns an unrevealed location face up and places its clues (per investigator
 * unless the card says otherwise). The single place that puts clues on a
 * location mid-scenario. Produces `CardFlipped` and `TokensChanged`.
 */
export interface RevealLocation {
  type: 'RevealLocation';
  locationId: InstanceId;
}

/**
 * Moves an active investigator to a location on a map. Normally the destination
 * must be a `neighbours` of the current location. Card effects that move an
 * investigator "to any location" set `ignoreConnections`; the destination must
 * still be in play. An unrevealed destination is revealed through the same path
 * as `RevealLocation`. Produces `InvestigatorMoved`, then `CardFlipped` and
 * `TokensChanged` if the destination was unrevealed.
 */
export interface MoveInvestigator {
  type: 'MoveInvestigator';
  investigatorId: InvestigatorId;
  to: InstanceId;
  /** Skip the connection check (card effects). Default false. */
  ignoreConnections?: boolean;
}

/**
 * Changes one of an active investigator's counters by `delta` (non-zero; a
 * negative delta heals or spends). Produces `InvestigatorChanged`, followed by
 * `InvestigatorDefeated` if damage reached health or horror reached sanity.
 */
export interface AdjustInvestigator {
  type: 'AdjustInvestigator';
  investigatorId: InvestigatorId;
  stat: InvestigatorStat;
  delta: number;
}

/**
 * An active investigator takes `amount` clues from the location they are at.
 * Produces `TokensChanged` (clues leave the location) and `InvestigatorChanged`
 * (clues arrive).
 */
export interface DiscoverClues {
  type: 'DiscoverClues';
  investigatorId: InvestigatorId;
  locationId: InstanceId;
  amount: number;
}

/**
 * Puts `amount` (positive) doom on a card in play, by default on the current
 * agenda. Produces `TokensChanged`, followed by `DecisionRequested` if the
 * doom total now reaches the agenda's threshold. Removing doom is a
 * `ManualAdjust` for now.
 */
export interface PlaceDoom {
  type: 'PlaceDoom';
  /** Defaults to the current agenda. */
  cardId?: InstanceId;
  amount: number;
}

/**
 * Advances the current agenda: all doom in play is removed, the agenda is
 * flipped and its reverse side (`onAgendaAdvance` hook) resolves while it is
 * still current; then it leaves the game and the next agenda becomes current.
 * Used both for the players' answer to the threshold question (until
 * `ResolveDecision` exists, M1.9) and for card effects that advance the agenda.
 * Produces `TokensChanged`/`InvestigatorChanged` (doom removal), `CardFlipped`,
 * `AgendaAdvanced`, the reverse side's events, `CardMoved`, `CurrentCardChanged`
 * and, for the last agenda, `ScenarioEnded` unless the reverse side ended the scenario.
 */
export interface AdvanceAgenda {
  type: 'AdvanceAgenda';
  /**
   * Fallback resolution for the last agenda when its reverse side does not end
   * the scenario itself; rejected while further agendas follow.
   */
  resolution?: string;
}

/** Clues one investigator pays towards advancing the act. */
export interface ClueSpend {
  investigatorId: InvestigatorId;
  amount: number;
}

/**
 * Advances the current act. The investigators choose who pays, so `spend`
 * lists their payments; the total must equal the act's clue requirement
 * (its `clues`, resolved for the starting player count), and it is empty for an act
 * without one. Like `AdvanceAgenda`, the reverse side (`onActAdvance` hook)
 * resolves before the next act becomes current. Produces `InvestigatorChanged`
 * per payment, `CardFlipped`, `ActAdvanced`, the reverse side's events,
 * `CardMoved`, `CurrentCardChanged` and, for the last act, `ScenarioEnded`
 * unless the reverse side ended the scenario.
 */
export interface AdvanceAct {
  type: 'AdvanceAct';
  spend: ClueSpend[];
  /**
   * Fallback resolution for the last act when its reverse side does not end
   * the scenario itself; rejected while further acts follow.
   */
  resolution?: string;
}

/**
 * Ends the scenario with `resolution` (a resolution id of the scenario).
 * Mostly returned by a reverse-side hook ("(→R1)"), which is how the last
 * agenda/act names its resolution. Produces `ScenarioEnded`.
 */
export interface EndScenario {
  type: 'EndScenario';
  resolution: string;
}

/** String literal of every command type. */
export type CommandType = Command['type'];
