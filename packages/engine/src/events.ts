import type { CampaignLog } from './campaign/campaign_log';
import type { AbilityCommand } from './abilities';
import type { CardCode, DecisionId, InstanceId, InvestigatorId, MapId, ScenarioId } from './ids';
import type { Edge, GameMap } from './map';
import type { Rejection } from './rejection';
import type { RngState } from './rng';
import type {
  HeldAction,
  QueuedStep,
  CardInstance,
  ChaosToken,
  Decision,
  Difficulty,
  Investigator,
  InvestigatorStat,
  Phase,
  PhaseStep,
  SkillTest,
  SkillTestOutcome,
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
  | InvestigatorResigned
  | LeadInvestigatorChanged
  | DecisionRequested
  | DecisionResolved
  | AgendaAdvanced
  | ActAdvanced
  | CurrentCardChanged
  | ScenarioEnded
  | EncounterCardDrawn
  | AbilityEffectSkipped
  | CluesDiscovered
  | SkillTestResolved
  | EnemyEngaged
  | EnemyDisengaged
  | EnemyDefeated
  | ExhaustChanged
  | PhaseChanged
  | PhaseStepsChanged
  | RoundEnded
  | TurnStarted
  | ActionsAdjusted
  | ActionsReset
  | TurnEnded
  | StepsQueued
  | StepResumed
  | ActionDropped;

/** A scenario was set up; replaces the whole state. Produced by `StartScenario`. */
export interface ScenarioStarted {
  type: 'ScenarioStarted';
  scenarioId: ScenarioId;
  difficulty: Difficulty;
  seed: number;
  /** With `actionsRemaining` set to `BASE_ACTIONS_PER_TURN`, so round 1 starts like every other. */
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

/**
 * An investigator is now at location `to`. Produced by `MoveInvestigator`.
 * `from` is the location they left; absent when they had none and were
 * placed on the map, which is no entering ("after you enter" stays shut).
 */
export interface InvestigatorMoved {
  type: 'InvestigatorMoved';
  investigatorId: InvestigatorId;
  from?: InstanceId;
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
 * An investigator ran out of health (`damage`) or sanity (`horror`), or a
 * card effect defeated them (`cardEffect`, `DefeatInvestigator`); their status
 * becomes `defeated`, and a turn in progress ends with them. Produced by
 * `AdjustInvestigator` and `ResolveEnemyAttack` right after the
 * `InvestigatorChanged` that caused it, and by `DefeatInvestigator`, followed
 * by the clean-up events (`investigatorLeavesEvents`). The cause matters to the
 * campaign: only a defeat by damage or horror earns trauma by itself.
 */
export interface InvestigatorDefeated {
  type: 'InvestigatorDefeated';
  investigatorId: InvestigatorId;
  cause: DefeatCause;
}

/** Why an investigator was defeated (`InvestigatorDefeated`). */
export type DefeatCause = 'damage' | 'horror' | 'cardEffect';

/**
 * The investigator left the scenario by resigning; their status becomes
 * `resigned`, and their turn ends with it. Produced by `Resign`, followed by
 * the same clean-up events as a defeat (`investigatorLeavesEvents`).
 */
export interface InvestigatorResigned {
  type: 'InvestigatorResigned';
  investigatorId: InvestigatorId;
}

/**
 * `investigatorId` is now the lead investigator (`GameMeta.leadInvestigator`).
 * Produced by `SetLeadInvestigator`, and directly when the lead leaves the
 * scenario and only one investigator remains (nothing to choose).
 */
export interface LeadInvestigatorChanged {
  type: 'LeadInvestigatorChanged';
  investigatorId: InvestigatorId;
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
 * opens the `advanced` window while the agenda is still current. Follows
 * the `CardFlipped` that turns it over; drops decisions about the agenda.
 * Produced by `AdvanceAgenda`, which follows it with `CurrentCardChanged` once
 * the reverse side has resolved.
 */
export interface AgendaAdvanced {
  type: 'AgendaAdvanced';
  cardId: InstanceId;
}

/** Like `AgendaAdvanced`, for the act deck. Produced by `AdvanceAct`. */
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
 * the campaign records. Produced by `EndScenario` (typically a reverse side's
 * `endScenario`) and by `AdvanceAgenda`/`AdvanceAct` when the last card of
 * a deck advances without its reverse side ending the scenario.
 *
 * Without a `resolution` no resolution was reached because every investigator
 * resigned or was defeated (`investigatorLeavesEvents`); the scenario's own
 * rules say what follows, which the engine cannot know, so `GameMeta.resolution`
 * stays absent. `GameMeta.ended` is set either way.
 */
export interface ScenarioEnded {
  type: 'ScenarioEnded';
  resolution?: string;
}

/** String literal of every event type. */
export type EventType = Event['type'];

/**
 * An investigator revealed `cardId` from the encounter deck. Only a record for
 * the log and the UI: the card's moves are the `CardMoved` (to `resolving`)
 * and `CardFlipped` that follow, and its placement once its revelation has
 * resolved (`placeDrawnCard`); the reducer ignores this event. `peril` is carried here
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
 * An ability effect of `cardId` was skipped because cards it names by code
 * (`{ ref: 'onlyCopy' }`) are not in the game exactly once: `missing` lists
 * them, in the order the effect names them. That is a mistake in the scenario
 * data or a table set up without the card, not a rule, so the players are
 * told and resolve `effect` by hand. Only a record for the log and the UI;
 * the reducer ignores this event. Produced by an `ability` step.
 */
export interface AbilityEffectSkipped {
  type: 'AbilityEffectSkipped';
  cardId: InstanceId;
  effect: AbilityCommand['type'];
  missing: readonly CardCode[];
}

/**
 * The investigator discovered `amount` clues at `locationId`. Only a record
 * for the log and for "after you discover clues" abilities: the clues move
 * with the `TokensChanged` and `InvestigatorChanged` before it, and the
 * reducer ignores this event. Produced by `DiscoverClues`.
 */
export interface CluesDiscovered {
  type: 'CluesDiscovered';
  investigatorId: InvestigatorId;
  locationId: InstanceId;
  amount: number;
}

/**
 * The players determined the outcome of a skill test (ST.6) by answering
 * its `skillTestResult` decision. Only a record for the log and for "after
 * you succeed / fail" abilities; the reducer ignores it. It comes right
 * after the `DecisionResolved`, ahead of the events of the answer's
 * commands, which apply the test's results (ST.7), "if this test succeeds"
 * effects included. Commands triggered by this event run before those
 * results, because `handle` queues the forced effects of an answer's own
 * events ahead of its option commands; no window opens on it yet (the
 * timing windows add one). Produced by `ResolveDecision`.
 */
export interface SkillTestResolved {
  type: 'SkillTestResolved';
  decisionId: DecisionId;
  /** Absent when the decision is not one investigator's (`Decider`). */
  investigatorId?: InvestigatorId;
  /** The decision's subject: the location, enemy or card the test is about. */
  subject?: InstanceId;
  skillTest: SkillTest;
  outcome: SkillTestOutcome;
  /**
   * How much the test succeeded or failed by, when the answer says: its
   * `margin`, or the 1 a per-point fail
   * (`Decision.perPointFailed`) deals without one.
   */
  margin?: number;
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
 * Round `round` is over (the last step of upkeep): opens `roundEnds` and
 * clears the per-round flags (`GameMeta.turnsTaken`). Produced by `NextPhase`.
 */
export interface RoundEnded {
  type: 'RoundEnded';
  round: number;
}

/** The investigator's turn begins (`GameMeta.turn`). Produced by `StartTurn`. */
export interface TurnStarted {
  type: 'TurnStarted';
  investigatorId: InvestigatorId;
}

/**
 * An investigator's remaining actions (`Investigator.actionsRemaining`)
 * changed by `delta`. Produced by `AdjustActions` and by a `ManualAdjust` of
 * kind `actions`.
 */
export interface ActionsAdjusted {
  type: 'ActionsAdjusted';
  investigatorId: InvestigatorId;
  delta: number;
}

/**
 * An investigator's remaining actions were set to `actions`
 * (`BASE_ACTIONS_PER_TURN`). Produced by upkeep step 4.2 ("reset actions"); an
 * absolute value rather than a delta, since a reset ignores what was left.
 */
export interface ActionsReset {
  type: 'ActionsReset';
  investigatorId: InvestigatorId;
  actions: number;
}

/** The investigator has taken their turn this round (`GameMeta.turnsTaken`). Produced by `EndTurn`; opens `turnEnds`. */
export interface TurnEnded {
  type: 'TurnEnded';
  investigatorId: InvestigatorId;
}

/**
 * Steps wait until the pending decisions are answered; they go in front of
 * whatever already waits (`GameMeta.queue`), so the newest resolution
 * finishes first. An action that provokes attacks of opportunity: the
 * attacks come after the action is paid for but before its effect
 * (produced by `handle` together with the attack decisions,
 * `attackOfOpportunityDecisions`). A surge draw: the next card is drawn only
 * after the surging card's decisions are answered (`resolveSurge`).
 */
export interface StepsQueued {
  type: 'StepsQueued';
  steps: QueuedStep[];
}

/**
 * The first queued step resolves now; its own events follow. Produced by
 * `handle` once no decision is pending any more (`resumeQueue`).
 */
export interface StepResumed {
  type: 'StepResumed';
}

/**
 * The first queued step, a held action, does not resolve: an attack of
 * opportunity or the surging card defeated the investigator, or the command
 * is no longer legal (`reason`, e.g. no encounter card left). Produced by
 * `handle` where `StepResumed` would be, and takes the step off the queue
 * just as that does.
 */
export interface ActionDropped {
  type: 'ActionDropped';
  command: HeldAction;
  reason: Rejection;
}
