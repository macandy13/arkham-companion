import type { CardType, Trait } from './cards';
import type { DecisionId, InstanceId, InvestigatorId, MapId } from './ids';
import type { MapSpec } from './map';
import type {
  CampaignLog,
  Decision,
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
  | MoveCard
  | AddMap
  | AddConnection
  | RemoveConnection
  | RevealLocation
  | MoveInvestigator
  | AdjustInvestigator
  | DiscoverClues
  | PlaceDoom
  | AdvanceAgenda
  | AdvanceAct
  | EndScenario
  | DrawEncounter
  | FromSetAside
  | ShuffleInto
  | SpawnEnemy
  | EngageEnemy
  | DisengageEnemy
  | DamageEnemy
  | DefeatEnemy
  | ExhaustEnemy
  | ReadyEnemy
  | MoveHunters
  | MoveHunter
  | RequestDecision
  | ResolveDecision
  | CheckDoomThreshold
  | NextPhase
  | EndTurn
  | ResolveEnemyAttack
  | Investigate
  | Fight
  | Evade;

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

/**
 * A card effect or reverse side moves a card to another zone ("remove the
 * Study from the game", "discard each enemy there"). Validated like a
 * `ManualAdjust` move, but it is a game event, so forced effects fire (a card
 * entering play triggers `onCardEnters`). Produces `CardMoved`.
 */
export interface MoveCard {
  type: 'MoveCard';
  cardId: InstanceId;
  to: Zone;
}

/**
 * Puts a new map into play mid-scenario (architecture §5 "a second board
 * added mid-scenario"), declared as one unit like setup's `addMap` step:
 * `compileMapStep` builds it from such a step. The `locations` are cards
 * outside play (typically set aside) that move onto the map in the given
 * order, as they are (set-aside locations stay unrevealed). The map's
 * connections may also end on other maps. Produces `MapAdded`, then one
 * `CardMoved` per location.
 */
export interface AddMap {
  type: 'AddMap';
  mapId: MapId;
  map: MapSpec;
  locations: readonly InstanceId[];
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
 * agenda. Produces `TokensChanged`. The threshold is not checked here: the agenda
 * only advances at a `CheckDoomThreshold` (mythos phase). Removing doom is a
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
 * Run by the "yes" answer to the threshold question (see
 * `ResolveDecision`) and by card effects that advance the agenda.
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
 * Advances the current act. Paying clues is only one way to advance: other
 * acts need an objective, an action or an event (an enemy defeated or out of
 * play, …), which players or scenario hooks decide, so those advance with no
 * `spend`. With `spend` the investigators choose who pays; the total must
 * equal the act's clue requirement (its `clues`, resolved for the starting
 * player count) and the act must have one. Like `AdvanceAgenda`, the reverse
 * side (`onActAdvance` hook) resolves before the next act becomes current.
 * Produces `InvestigatorChanged` per payment, `CardFlipped`, `ActAdvanced`,
 * the reverse side's events, `CardMoved`, `CurrentCardChanged` and, for the
 * last act, `ScenarioEnded` unless the reverse side ended the scenario.
 */
export interface AdvanceAct {
  type: 'AdvanceAct';
  /** Clue payments; omit to advance without paying (any act can advance that way). */
  spend?: ClueSpend[];
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

/**
 * An investigator draws the top card of the encounter deck (mythos phase or a
 * card effect), or with `match` the first card that matches (see below). The
 * card is revealed and then: an enemy is placed unengaged at
 * the investigator's location (engagement, aloof and spawn instructions are
 * `SpawnEnemy`, M1.8); a treachery goes to the investigator's threat area if
 * its card says so (`CardStats.entersThreatArea`), otherwise to the encounter
 * discard; anything else goes to the discard. As soon as the deck is empty
 * the discard is shuffled back into it; a card with surge makes the
 * investigator draw again. Produces, per card drawn, `EncounterCardDrawn`,
 * `CardFlipped` and `CardMoved`, followed by `CardMoved`s and a `DeckShuffled`
 * when that card emptied the deck and the discard was shuffled back.
 */
export interface DrawEncounter {
  type: 'DrawEncounter';
  investigatorId: InvestigatorId;
  /**
   * Where a `match` is looked for (default `'deck'`); without `match` the
   * draw always takes the top of the deck and `from` is ignored.
   */
  from?: EncounterSource;
  /**
   * Draws the first card that matches instead of the top card: deck top-down,
   * then discard top-down (the discard's top is its first entry). Every given
   * field has to match; the card is then revealed and placed exactly like a
   * top-of-deck draw, so surge and the empty-deck reshuffle apply as well.
   * Rejected with `noMatchingCard` when nothing matches.
   */
  match?: EncounterMatch;
  /**
   * With `match` in the deck: first discards every card above the match
   * ("discard cards from the top of the encounter deck until a Ghoul enemy is
   * discarded. The lead investigator draws that enemy"). Without it the
   * matching card is taken out of the deck and the rest stays where it is.
   */
  discardSkipped?: boolean;
}

/** The part of the encounter cards a `DrawEncounter` with `match` looks through. */
export type EncounterSource = 'deck' | 'discard' | 'deckOrDiscard';

/** What a card has to be to be drawn by a matched `DrawEncounter`; at least one field. */
export interface EncounterMatch {
  /** Card name as in the `CardDb`, compared exactly. */
  name?: string;
  /** A trait the card has, e.g. the `Ghoul` of "draw a Ghoul enemy". */
  trait?: Trait;
  /** Card type, e.g. `enemy` for "a Ghoul enemy". */
  typeCode?: CardType;
}

/**
 * Takes one set-aside copy of each code (a code listed twice takes two copies)
 * and moves it to `to`. A move into play makes the bus fire `onCardEnters`.
 * Produces `CardMoved` per card.
 */
export interface FromSetAside {
  type: 'FromSetAside';
  codes: readonly string[];
  to: Zone;
}

/**
 * Takes one set-aside copy of each code, adds it to `zone` and shuffles the
 * whole zone (usually the encounter deck). Produces `CardMoved` per card,
 * then `DeckShuffled`.
 */
export interface ShuffleInto {
  type: 'ShuffleInto';
  codes: readonly string[];
  zone: Zone;
}

/**
 * Puts an enemy that is not in play (encounter deck, set aside, …) into play.
 * Where it appears, in this order: `at`; the location named by its `spawn`
 * keyword (several matches or unreadable text: `DecisionRequested` of kind
 * `chooseLocation`, enemy stays put; no such location in play: discarded);
 * the location of `investigatorId` (the investigator who drew it), whom it
 * engages whatever its prey. Elsewhere it engages per `engageEvents`. Produces
 * `CardMoved`, then `EnemyEngaged` or `DecisionRequested` (prey tie). `DrawEncounter` resolves
 * a drawn enemy the same way.
 */
export interface SpawnEnemy {
  type: 'SpawnEnemy';
  enemyId: InstanceId;
  /** The drawing investigator; the fallback spawn location. */
  investigatorId?: InvestigatorId;
  /** Explicit spawn location (a card effect or scenario step); overrides the keyword. */
  at?: InstanceId;
}

/**
 * Engages an enemy in play with an active investigator at its location (an
 * unengaged enemy must be at the investigator's location; an engaged one
 * switches investigator). Produces `EnemyEngaged`.
 */
export interface EngageEnemy {
  type: 'EngageEnemy';
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
}

/**
 * Breaks an enemy's engagement; it stays at the location of the investigator
 * it was engaged with. Produces `EnemyDisengaged`.
 */
export interface DisengageEnemy {
  type: 'DisengageEnemy';
  enemyId: InstanceId;
}

/**
 * Puts `amount` (positive) damage on an enemy in play. An enemy with damage
 * equal to or above its health (per `resolveValue`) is defeated in the same
 * step. Produces `TokensChanged`, then `EnemyDefeated`.
 */
export interface DamageEnemy {
  type: 'DamageEnemy';
  enemyId: InstanceId;
  amount: number;
}

/**
 * Defeats an enemy in play: it goes to the victory display if the card has
 * victory, otherwise to the top of the encounter discard, and loses its
 * tokens. Produces `EnemyDefeated`.
 */
export interface DefeatEnemy {
  type: 'DefeatEnemy';
  enemyId: InstanceId;
}

/** Exhausts a ready enemy in play (after it attacked, or by a card effect). Produces `ExhaustChanged`. */
export interface ExhaustEnemy {
  type: 'ExhaustEnemy';
  enemyId: InstanceId;
}

/**
 * Readies an exhausted enemy in play (upkeep, or a card effect). A readied,
 * unengaged enemy with an investigator at its location engages, as the rules
 * demand. Produces `ExhaustChanged`, then `EnemyEngaged` or `DecisionRequested`.
 */
export interface ReadyEnemy {
  type: 'ReadyEnemy';
  enemyId: InstanceId;
}

/**
 * Moves the ready, unengaged hunter enemies one step towards the nearest
 * investigator (enemy phase; the phase assistant of M1.10 issues it). Hunters
 * with an investigator at their location, without a route or with a pending
 * decision stay. Equally near investigators and equally short routes are
 * settled by prey and then handed to the players. When two or more hunters
 * would move, the lead investigator chooses the order (`hunterOrder`
 * decision, see `handleMoveHunters`) and nothing moves yet. Produces
 * `CardMoved` per moving hunter, then `EnemyEngaged` or `DecisionRequested`,
 * or only the `hunterOrder` `DecisionRequested`.
 */
export interface MoveHunters {
  type: 'MoveHunters';
  /**
   * Only these hunters are considered (default: every hunter in play). The
   * answer to the `hunterOrder` decision passes the hunters that have not
   * moved yet, so a hunter that already moved is not moved again.
   */
  hunters?: InstanceId[];
}

/**
 * Moves one hunter a step, as the players decided a tie in `MoveHunters`: to
 * the neighbouring location `to`, or towards `towards` along that
 * investigator's shortest routes (a remaining tie between routes becomes a
 * `chooseLocation` decision). The hunter must be an unengaged enemy at a location;
 * `to` must be connected to it. With neither `to` nor `towards` the hunter moves
 * along its own rule, as `MoveHunters` would move it alone. Produces `CardMoved`, then `EnemyEngaged` or
 * `DecisionRequested`.
 */
export type MoveHunter = {
  type: 'MoveHunter';
  enemyId: InstanceId;
} & (
  | { to: InstanceId; towards?: never }
  | { towards: InvestigatorId; to?: never }
  | { to?: never; towards?: never }
);

/**
 * Raises a decision, for scenario hooks and card effects ("choose one: …").
 * The id must not be pending, there must be at least one option and option
 * ids must be unique. Produces `DecisionRequested`.
 */
export interface RequestDecision {
  type: 'RequestDecision';
  decision: Decision;
}

/**
 * The players' answer to a pending decision. Produces `DecisionResolved`
 * (which removes the decision), followed by the events of the chosen option's
 * commands, each handled like a hook's follow-up command (validated, with
 * their own forced effects, in the same undo group). If one of them is
 * rejected the whole answer is rejected and the decision stays pending.
 */
export interface ResolveDecision {
  type: 'ResolveDecision';
  decisionId: DecisionId;
  optionId: string;
}

/**
 * Checks the doom threshold: if the doom in play has reached the current
 * agenda's threshold, the players are asked to confirm advancing it
 * (`DecisionRequested` of kind `confirm`, "no" overrides the count at the
 * table and is asked again at the next check). The mythos phase runs it
 * after placing its doom; card effects that say "check the doom threshold"
 * return it. Doom placed at other times never advances the agenda by itself
 * (Rules Reference, "Agenda Deck"). Produces nothing below the threshold.
 */
export interface CheckDoomThreshold {
  type: 'CheckDoomThreshold';
}

/**
 * The phase assistant's "Next": runs the outstanding steps of the current
 * phase (`GameMeta.steps`), or, when none are left, moves on to the next
 * phase (setup → investigation of round 1, skipping its mythos phase;
 * investigation → enemy → upkeep → mythos of the next round) and runs its
 * steps. Steps run until one leaves a decision pending or an enemy attack
 * needs resolving (`ResolveEnemyAttack`); the next `NextPhase` after the
 * answer resumes there. Rejected while an enemy attack of the current step
 * list is still due. Produces `PhaseChanged`, then per step
 * `PhaseStepsChanged` and the events of the step (`PlaceDoom`,
 * `CheckDoomThreshold`, `DrawEncounter`, `MoveHunters`, `ReadyEnemy`,
 * `AdjustInvestigator`, `RoundEnded`).
 */
export interface NextPhase {
  type: 'NextPhase';
}

/**
 * An investigator ends their turn in the investigation phase; sets the
 * per-round "turn taken" flag (`GameMeta.turnsTaken`). Produces `TurnEnded`.
 */
export interface EndTurn {
  type: 'EndTurn';
  investigatorId: InvestigatorId;
}

/**
 * The players resolved one enemy attack of the enemy phase (an `enemyAttack`
 * step). `damage`/`horror` default to the enemy's printed values; the players
 * pass less when assets soak part of it. The enemy exhausts after its last
 * due attack (a massive enemy attacks everyone at its location first).
 * Produces `PhaseStepsChanged`, `InvestigatorChanged` (damage, horror; with
 * `InvestigatorDefeated` as usual, horror is skipped for an investigator the
 * damage defeated) and `ExhaustChanged`.
 */
export interface ResolveEnemyAttack {
  type: 'ResolveEnemyAttack';
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
  damage?: number;
  horror?: number;
}

/**
 * Quick action: the investigator investigates their location. The players
 * resolve the intellect test against its shroud at the table; the engine
 * raises a `skillTestResult` decision whose pass discovers 1 clue (if the
 * location has one). Skipping the test and using `DiscoverClues` directly is
 * equally valid. Produces `DecisionRequested`.
 */
export interface Investigate {
  type: 'Investigate';
  investigatorId: InvestigatorId;
}

/**
 * Quick action: the investigator attacks an enemy at their location
 * (combat test against its fight value). A pass deals `damage` (default 1;
 * weapons deal more) via `DamageEnemy`. Produces `DecisionRequested`.
 */
export interface Fight {
  type: 'Fight';
  investigatorId: InvestigatorId;
  enemyId: InstanceId;
  /** Damage on a pass; default 1. */
  damage?: number;
}

/**
 * Quick action: the investigator evades an enemy engaged with them (agility
 * test against its evade value). A pass exhausts the enemy (if ready) and
 * disengages it (a massive enemy is not in the `engaged` zone and stays).
 * Produces `DecisionRequested`.
 */
export interface Evade {
  type: 'Evade';
  investigatorId: InvestigatorId;
  enemyId: InstanceId;
}

/** String literal of every command type. */
export type CommandType = Command['type'];
