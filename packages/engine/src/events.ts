import type { DecisionId, InstanceId, InvestigatorId, MapId } from './ids';
import type { Edge, GameMap } from './map';
import type { RngState } from './rng';
import type { ActionKind } from './turns';
import type {
  CampaignLog,
  CardInstance,
  ChaosToken,
  Decision,
  Difficulty,
  Investigator,
  InvestigatorStat,
  Phase,
  PhaseStep,
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
  | MapAdded
  | InvestigatorMoved
  | InvestigatorChanged
  | InvestigatorDefeated
  | DecisionRequested
  | DecisionResolved
  | AgendaAdvanced
  | ActAdvanced
  | CurrentCardChanged
  | ScenarioEnded
  | EncounterCardDrawn
  | EnemyEngaged
  | EnemyDisengaged
  | EnemyDefeated
  | ExhaustChanged
  | PhaseChanged
  | PhaseStepsChanged
  | RoundEnded
  | TurnStarted
  | ActionTaken
  | ActionsAdjusted
  | TurnEnded;

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
 * A new map with its connections joined the board (`Board.maps`); its
 * locations follow as `CardMoved` events. Produced by `AddMap`.
 */
export interface MapAdded {
  type: 'MapAdded';
  mapId: MapId;
  map: GameMap;
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
 * Produced by rules that need an answer (doom threshold, engagement and hunter
 * ties) and by `RequestDecision`.
 */
export interface DecisionRequested {
  type: 'DecisionRequested';
  decision: Decision;
}

/**
 * The players answered a pending decision; removes it from `GameState.pending`.
 * Produced by `ResolveDecision`, which follows it with the events of the
 * chosen option's commands.
 */
export interface DecisionResolved {
  type: 'DecisionResolved';
  decisionId: DecisionId;
  optionId: string;
}

/**
 * The current agenda `cardId` advanced and its reverse side resolves now: it
 * fires the `onAgendaAdvance` hook while the agenda is still current. Follows
 * the `CardFlipped` that turns it over; drops decisions about the agenda.
 * Produced by `AdvanceAgenda`, which follows it with `CurrentCardChanged` once
 * the reverse side has resolved.
 */
export interface AgendaAdvanced {
  type: 'AgendaAdvanced';
  cardId: InstanceId;
}

/** Like `AgendaAdvanced`, for the act deck (`onActAdvance`). Produced by `AdvanceAct`. */
export interface ActAdvanced {
  type: 'ActAdvanced';
  cardId: InstanceId;
}

/**
 * `cardId` is now the current card of `deck` (absent once the deck is used
 * up). Produced by `AdvanceAgenda`/`AdvanceAct` after the reverse side of the
 * old card has resolved and a `CardMoved` has taken it out of the game.
 */
export interface CurrentCardChanged {
  type: 'CurrentCardChanged';
  deck: 'agenda' | 'act';
  cardId?: InstanceId;
}

/**
 * The scenario is over with the given resolution (`GameMeta.resolution`), which
 * the campaign records. Produced by `EndScenario` (typically returned by a
 * reverse-side hook) and by `AdvanceAgenda`/`AdvanceAct` when the last card of
 * a deck advances without its reverse side ending the scenario.
 */
export interface ScenarioEnded {
  type: 'ScenarioEnded';
  resolution: string;
}

/** String literal of every event type. */
export type EventType = Event['type'];

/**
 * An investigator revealed `cardId` from the encounter deck. Only a record for
 * the log and the UI: the card's moves are the `CardFlipped` and `CardMoved`
 * that follow, and the reducer ignores this event. `peril` is carried here
 * because the app cannot hide information; the UI uses it to warn the players
 * not to discuss the card. `surge` tells that another draw follows. Produced
 * by `DrawEncounter`.
 */
export interface EncounterCardDrawn {
  type: 'EncounterCardDrawn';
  investigatorId: InvestigatorId;
  cardId: InstanceId;
  peril: boolean;
  surge: boolean;
}

/**
 * Enemy `enemyId` is now engaged with the investigator (zone `engaged`),
 * from an unengaged position or another investigator. Drops decisions about
 * the enemy (the pending engagement question is answered). Produced by
 * `SpawnEnemy`, `DrawEncounter`, `EngageEnemy`, `ReadyEnemy`, `MoveHunters`
 * and `StartScenario` (enemies starting at a location with investigators).
 */
export interface EnemyEngaged {
  type: 'EnemyEngaged';
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
}

/** The enemy is no longer engaged and stays at `locationId`. Produced by `DisengageEnemy`. */
export interface EnemyDisengaged {
  type: 'EnemyDisengaged';
  enemyId: InstanceId;
  locationId: InstanceId;
}

/**
 * The enemy was defeated and moves to `to` (victory display or encounter
 * discard). The reducer also removes its tokens and exhaustion and drops
 * decisions about it. Produced by `DefeatEnemy` and `DamageEnemy`.
 */
export interface EnemyDefeated {
  type: 'EnemyDefeated';
  enemyId: InstanceId;
  to: Zone;
}

/** A card was exhausted or readied. Produced by `ExhaustEnemy` and `ReadyEnemy`. */
export interface ExhaustChanged {
  type: 'ExhaustChanged';
  cardId: InstanceId;
  exhausted: boolean;
}

/**
 * The game is now in `phase` of `round` with `steps` outstanding (`GameMeta`).
 * Produced by `NextPhase` when the previous phase has no steps left.
 */
export interface PhaseChanged {
  type: 'PhaseChanged';
  phase: Phase;
  round: number;
  steps: PhaseStep[];
}

/**
 * The outstanding steps of the current phase are now `steps`. Produced by
 * `NextPhase` before it runs a step (so a decision raised by the step resumes
 * after it) or expands the enemy attacks, and by `ResolveEnemyAttack`.
 */
export interface PhaseStepsChanged {
  type: 'PhaseStepsChanged';
  steps: PhaseStep[];
}

/**
 * Round `round` is over (the last step of upkeep): fires `onRoundEnd` and
 * clears the per-round flags (`GameMeta.turnsTaken`). Produced by `NextPhase`.
 */
export interface RoundEnded {
  type: 'RoundEnded';
  round: number;
}

/** The investigator's turn begins (`GameMeta.turn`, no actions taken yet). Produced by `StartTurn`. */
export interface TurnStarted {
  type: 'TurnStarted';
  investigatorId: InvestigatorId;
}

/**
 * The investigator whose turn is in progress spent one action
 * (`Turn.actionsTaken`). Produced by `handle` ahead of the events of an
 * action command the players issue during the investigation phase (see
 * `actionOf`); follow-up commands of hooks and answers are never actions.
 */
export interface ActionTaken {
  type: 'ActionTaken';
  investigatorId: InvestigatorId;
  action: ActionKind;
}

/**
 * The action allowance of the turn in progress changed by `delta`
 * (`Turn.actionAdjustment`). Produced by `AdjustActions` and by a
 * `ManualAdjust` of kind `actions`.
 */
export interface ActionsAdjusted {
  type: 'ActionsAdjusted';
  investigatorId: InvestigatorId;
  delta: number;
}

/** The investigator has taken their turn this round (`GameMeta.turnsTaken`). Produced by `EndTurn`. */
export interface TurnEnded {
  type: 'TurnEnded';
  investigatorId: InvestigatorId;
}
