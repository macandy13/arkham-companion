import type { AbilityEffect, OpenedWindow } from './abilities';
import type { CampaignLog, TraumaKind } from './campaign/campaign_log';
import type { CardType, Trait } from './cards';
import type {
  CardCode,
  DecisionId,
  InstanceId,
  InvestigatorId,
  MapId,
  ResolutionId,
  ScenarioId,
} from './ids';
import type { GridCell, MapPlacement, MapSpec } from './map';
import type {
  Decision,
  ChaosToken,
  Difficulty,
  Investigator,
  InvestigatorStat,
  NamedAmount,
  PerPointFailed,
  SkillTest,
  TokenKind,
} from './state';
import type { Zone } from './zone';

/** Commands are intents from the UI; `handle` validates them and produces events. */
export type Command =
  | StartScenario
  | ManualAdjust
  | MoveCard
  | DiscardCard
  | AddMap
  | PutLocationIntoPlay
  | AddConnection
  | RemoveConnection
  | RevealLocation
  | MoveInvestigator
  | AdjustInvestigator
  | TakeDamageAndHorror
  | DefeatInvestigator
  | DiscoverClues
  | PlaceClues
  | PlaceDoom
  | AdvanceAgenda
  | AdvanceAct
  | EndScenario
  | DrawEncounter
  | FromSetAside
  | ShuffleInto
  | ShuffleEncounterDiscard
  | ShuffleEncounterDeck
  | EngageReadyEnemies
  | SpawnEnemy
  | EngageEnemy
  | DisengageEnemy
  | DamageEnemy
  | HealEnemy
  | GainSurge
  | DefeatEnemy
  | ExhaustEnemy
  | ReadyEnemy
  | MoveEnemy
  | MoveEnemyTowards
  | MoveHunters
  | MoveHunter
  | RequestDecision
  | TestSkill
  | ResolveEffect
  | ResolveDecision
  | CheckDoomThreshold
  | NextPhase
  | StartTurn
  | EndTurn
  | Resign
  | UseCardAction
  | SetLeadInvestigator
  | AdjustActions
  | ResolveEnemyAttack
  | DealEnemyAttack
  | Investigate
  | Fight
  | Evade;

/** A card instance to create when the scenario starts. */
export interface StartingCard {
  /** Explicit instance ID, so other starting cards can reference it. Defaults to `c<index>`. */
  id?: InstanceId;
  code: CardCode;
  zone: Zone;
  faceUp?: boolean;
  /** Tokens the card starts with (doom placed by setup, clues on a revealed location, …). */
  tokens?: Partial<Record<TokenKind, number>>;
}

/**
 * An investigator as the scenario starts with them. `actionsRemaining` is
 * left out because the start sets it (`BASE_ACTIONS_PER_TURN`), like upkeep step 4.2
 * does every round.
 */
export type StartingInvestigator = Omit<Investigator, 'actionsRemaining'>;

/**
 * Sets up a scenario from scratch: investigators, maps and every card instance
 * in its initial zone. Produces `ScenarioStarted` and, unless disabled, a
 * `DeckShuffled` for the encounter deck. `compileSetup` builds this command
 * from a `ScenarioDefinition`. An investigator's `locationId` must name a
 * starting card in a `location` zone.
 */
export interface StartScenario {
  type: 'StartScenario';
  scenarioId: ScenarioId;
  difficulty: Difficulty;
  seed: number;
  investigators: StartingInvestigator[];
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
 * `ManualAdjust` move, but it is a game event, so forced effects fire.
 * Produces `CardMoved`.
 */
export interface MoveCard {
  type: 'MoveCard';
  cardId: InstanceId;
  to: Zone;
  /** Position in the destination, 0 = top (e.g. the top of the encounter discard); default the bottom. */
  index?: number;
}

/**
 * A card effect discards an encounter card ("discard it"): onto the top of
 * the encounter discard, where "topmost" effects look for it, losing its
 * tokens and taking its attachments along (`discardEncounterCard`). Produces
 * `CardMoved`, after `TokensChanged` for any tokens and the attachments'
 * own events.
 */
export interface DiscardCard {
  type: 'DiscardCard';
  cardId: InstanceId;
}

/**
 * Puts a new map into play mid-scenario (a second board, see architecture "Game
 * state" and "Scenarios"), declared as one unit like setup's `addMap` step
 * (`putMapIntoPlay` writes it from such a step). The `locations` are cards
 * outside play (typically set aside) that move onto the map in the given
 * order, as they are (set-aside locations stay unrevealed), each in its
 * layout cell if it has one. The cells go with the locations rather than in
 * a layout keyed by ID, so card data can name the locations by reference.
 * The map's connections may also end on other maps. Produces `MapAdded`,
 * then one `CardMoved` per location.
 */
export interface AddMap {
  type: 'AddMap';
  mapId: MapId;
  map: Omit<MapSpec, 'layout'>;
  locations: readonly MapPlacement[];
}

/**
 * The concrete corrections a `ManualAdjust` can make. `actions` changes an
 * investigator's remaining actions, like `AdjustActions`.
 */
export type Adjustment =
  | { kind: 'moveCard'; cardId: InstanceId; to: Zone; index?: number }
  | { kind: 'tokens'; cardId: InstanceId; token: TokenKind; delta: number }
  | { kind: 'actions'; investigatorId: InvestigatorId; delta: number };

/**
 * Puts one location that is out of play (typically set aside) onto the map
 * `mapId` that is already on the board, unrevealed, in layout cell `at` when
 * given ("put the set-aside Ritual Site into play"). `AddMap` adds a whole
 * new map instead; connections follow as `AddConnection`. Produces
 * `CardMoved`, then `LayoutCellSet` with a cell.
 */
export interface PutLocationIntoPlay {
  type: 'PutLocationIntoPlay';
  locationId: InstanceId;
  mapId: MapId;
  at?: GridCell;
}

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
 * A command that can be taken as an action. Only spending an action provokes
 * attacks of opportunity, so `asAction` is set when an action is spent on it:
 * a basic action, or a card ability that costs an action. The same command
 * from an effect that spends none (a treachery moving someone, a scenario
 * step, a fast ability) leaves it out. `CommandSpec.provokes` reads it.
 */
export interface ActionCommand {
  /** Taken as the investigator's action. Default: a card effect. */
  asAction?: true;
}

/**
 * Moves an active investigator to a location on a map. Normally the destination
 * must be a `neighbours` of the current location. Card effects that move an
 * investigator "to any location" set `ignoreConnections`; the destination must
 * still be in play. An unrevealed destination is revealed through the same path
 * as `RevealLocation`. Produces `InvestigatorMoved`, then `CardFlipped` and
 * `TokensChanged` if the destination was unrevealed, then `EnemyEngaged` (or
 * a `chooseInvestigator` decision) for each ready enemy waiting there, unless
 * `avoidEngagement` is set.
 */
export interface MoveInvestigator extends ActionCommand {
  type: 'MoveInvestigator';
  investigatorId: InvestigatorId;
  to: InstanceId;
  /** Skip the connection check (card effects). Default false. */
  ignoreConnections?: boolean;
  /**
   * The enemies at the destination do not engage (card effects that move
   * "without being engaged"; they stay unengaged there until a rule engages
   * them again, e.g. readying, or the engage action). Default false.
   */
  avoidEngagement?: boolean;
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
 * An active investigator takes `damage` and `horror` from one effect ("take 1
 * horror and 1 damage"), placed at once like an attack's: neither is lost to a
 * defeat the other causes. Amounts are whole numbers, at least one above 0.
 * Produces an `InvestigatorChanged` per amount above 0, then
 * `InvestigatorDefeated` if damage reached health or horror reached sanity.
 */
export interface TakeDamageAndHorror {
  type: 'TakeDamageAndHorror';
  investigatorId: InvestigatorId;
  damage: number;
  horror: number;
}

/**
 * A card effect defeats an active investigator outright ("each investigator
 * that has not resigned is defeated"), without damage or horror. Produces
 * `InvestigatorDefeated` with cause `cardEffect` and the same clean-up as any
 * defeat (`investigatorLeavesEvents`), ending the scenario if nobody is left.
 */
export interface DefeatInvestigator {
  type: 'DefeatInvestigator';
  investigatorId: InvestigatorId;
  /** The 1 trauma the card adds, as in "is defeated and suffers 1 physical trauma". */
  trauma?: TraumaKind;
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
 * An active investigator places up to `amount` of their clues on the location
 * they are at ("place 1 of your clues on your location" for each point a test
 * fails by): as many as they have, so none at all with no clues or with no
 * location (not on the map yet). `amount` is positive. Produces
 * `InvestigatorChanged` (clues leave) and `TokensChanged` (clues arrive).
 */
export interface PlaceClues {
  type: 'PlaceClues';
  investigatorId: InvestigatorId;
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
 * flipped and its reverse side (its `advanced` abilities) resolves while it is
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
  resolution?: ResolutionId;
}

/** Clues one investigator pays towards advancing the act. */
export interface ClueSpend {
  investigatorId: InvestigatorId;
  amount: number;
}

/**
 * Advances the current act. Paying clues is only one way to advance: other
 * acts need an objective, an action or an event (an enemy defeated or out of
 * play, …), which players or card abilities decide, so those advance with no
 * `spend`. With `spend` the investigators choose who pays; the total must
 * equal the act's clue requirement (its `clues`, resolved for the starting
 * player count) less the clue tokens on the act, and the act must have one.
 * Like `AdvanceAgenda`, the reverse side (its `advanced` abilities) resolves
 * before the next act becomes current. Produces `InvestigatorChanged` per
 * payment, `TokensChanged` for the tokens on the act, `CardFlipped`, `ActAdvanced`,
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
  resolution?: ResolutionId;
}

/**
 * Ends the scenario with `resolution` (a resolution id of the scenario).
 * Mostly a reverse side's effect ("(→R1)", `endScenario`), which is how the last
 * agenda/act names its resolution. Produces `ScenarioEnded`.
 */
export interface EndScenario {
  type: 'EndScenario';
  resolution: ResolutionId;
}

/**
 * An investigator draws the top card of the encounter deck (mythos phase or a
 * card effect), or with `match` the first card that matches (see below). The
 * card is revealed and then: an enemy is placed unengaged at
 * the investigator's location (engagement, aloof and spawn instructions are
 * `SpawnEnemy`, M1.8); any other card goes to the discard unless its
 * revelation put it somewhere else (`putIntoThreatArea`). As soon as the deck is empty
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
   * Draws and discards nothing when no card matches: the effect resolves as
   * far as it can. With `discardSkipped` this assumes the discard was just
   * shuffled into the deck, as Rise of the Ghouls does first; a match left in
   * the discard is not looked for.
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
 * and moves it to `to`. Produces `CardMoved` per card.
 */
export interface FromSetAside {
  type: 'FromSetAside';
  codes: readonly CardCode[];
  to: Zone;
}

/**
 * Takes one set-aside copy of each code, adds it to `zone` and shuffles the
 * whole zone (usually the encounter deck). Produces `CardMoved` per card,
 * then `DeckShuffled`.
 */
export interface ShuffleInto {
  type: 'ShuffleInto';
  codes: readonly CardCode[];
  zone: Zone;
}

/**
 * Shuffles the encounter discard pile into the encounter deck (a reverse
 * side such as Rise of the Ghouls, or a card effect). Produces `CardMoved` per
 * discarded card, then `DeckShuffled`; nothing at all when the discard is
 * empty, because the rules do not shuffle the deck then.
 */
export interface ShuffleEncounterDiscard {
  type: 'ShuffleEncounterDiscard';
}

/**
 * Lets every ready, unengaged enemy at a location with an investigator
 * engage (Rules Reference, "Enemy Engagement"), after an effect that leaves
 * one there: On Wings of Darkness disengages enemies, then moves the drawer
 * away, and an enemy left with another investigator engages them. Produces
 * `EnemyEngaged`s, or a `chooseEngagement` decision per enemy with a choice.
 */
export interface EngageReadyEnemies {
  type: 'EngageReadyEnemies';
}

/**
 * Shuffles the encounter deck ("Shuffle the encounter deck" after a search,
 * Mysterious Chanting). Produces `DeckShuffled`; nothing for an empty deck.
 */
export interface ShuffleEncounterDeck {
  type: 'ShuffleEncounterDeck';
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
  /**
   * The investigator the enemy spawns engaged with, at their location; overrides the keyword.
   * Set by the answer to the tie of a "Spawn - Engaged with prey" instruction. `at` wins when
   * both are set.
   */
  engagedWith?: InvestigatorId;
}

/**
 * Engages an enemy in play with an active investigator at its location (an
 * unengaged enemy must be at the investigator's location; an engaged one
 * switches investigator). Produces `EnemyEngaged`.
 */
export interface EngageEnemy extends ActionCommand {
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
 * "This card gains surge": the drawn card that is resolving draws another
 * encounter card for its drawer once it has been placed, as a card with
 * printed surge does. Rejected for a card that is not resolving
 * (`notResolving`). Produces `SurgeGained`.
 */
export interface GainSurge {
  type: 'GainSurge';
  cardId: InstanceId;
}

/**
 * Removes up to `amount` (positive) damage from an enemy in play ("heal 2
 * damage from it"), as much as it has: healing an undamaged enemy does
 * nothing. Produces `TokensChanged`.
 */
export interface HealEnemy {
  type: 'HealEnemy';
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
 * demand. Readying a ready enemy does nothing, so "at the end of each turn:
 * ready it" (Umôrdhoth) resolves whether or not it is exhausted. Produces `ExhaustChanged`, then `EnemyEngaged` or `DecisionRequested`.
 */
export interface ReadyEnemy {
  type: 'ReadyEnemy';
  enemyId: InstanceId;
}

/**
 * A card effect moves an enemy in play to the location `to` ("move it to the
 * Hallway"), or the players carry such an effect out by dragging the enemy
 * on the map. Unlike a hunter's step it needs no connection. An engaged enemy
 * moves only with its investigator, so a plain effect is refused for it
 * (`enemyEngaged`); a forced instruction (`forced`) is followed whatever the
 * engagement, so the enemy disengages and moves. At `to` a ready enemy then
 * engages as when it spawns there (`engageEvents`); an enemy already at `to`
 * stays as it is. An enemy entering an unrevealed location does not reveal it. Produces `CardMoved`, then
 * `EnemyEngaged` or `DecisionRequested`.
 */
export interface MoveEnemy {
  type: 'MoveEnemy';
  enemyId: InstanceId;
  to: InstanceId;
  /** A forced instruction, followed even for an engaged enemy. Default false. */
  forced?: boolean;
}

/**
 * A card effect moves an unengaged enemy one connection towards the location
 * `towards` along a shortest path ("each unengaged Ghoul enemy moves 1
 * location towards the Parlor"), exhausted or not. It stays when it is
 * there already or has no path (also while `towards` is out of play); equally short first steps become a
 * `chooseLocation` decision for the lead investigator (`towards:<enemy>`),
 * answered with `MoveEnemy`. An engaged enemy moves only with its
 * investigator, so it is refused (`enemyEngaged`). Produces what `MoveEnemy`
 * produces, or the `DecisionRequested`.
 */
export interface MoveEnemyTowards {
  type: 'MoveEnemyTowards';
  enemyId: InstanceId;
  towards: InstanceId;
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
 * Raises a decision, for rule modules and card effects ("choose one: …", `leadDecides`).
 * The id must not be pending, there must be at least one option and option
 * ids must be unique. Produces `DecisionRequested`.
 */
export interface RequestDecision {
  type: 'RequestDecision';
  decision: Decision;
}

/**
 * A card asks an investigator for a skill test ("Test [willpower] (3). If you
 * succeed, …"): a `skillTestResult` decision about the card (`test:<card>`),
 * answered by that investigator, whose options run `onPass` or `onFail`.
 * What a card ability writes as `skillTest(…)`. The id allows one test per
 * card at a time, which is all a card asks for. Produces `DecisionRequested`.
 */
export interface TestSkill {
  type: 'TestSkill';
  investigatorId: InvestigatorId;
  /** The card that asks for the test, which the decision is about. */
  cardId: InstanceId;
  test: SkillTest;
  onPass: readonly Command[];
  onFail: readonly Command[];
  /**
   * "For each point you fail by, take 1 damage" (Grasping Hands), horror
   * (Rotting Remains) or "place 1 of your clues on your location" (False
   * Lead): the fail answer confirms how much the test failed by, and the
   * investigator pays that much, ahead of `onFail`.
   */
  perPointFailed?: PerPointFailed;
}

/**
 * One effect of a card ability, resolved when its turn comes (`resolveEffect`)
 * against the state then: a card test's outcome, run after the answer. So an
 * effect on a drawer whom the outcome's own damage defeated names nobody and
 * is dropped, rather than rejecting the answer (Rules Reference: resolve as
 * much as possible). Produced by the engine (`abilities.ts`), never by the
 * players; it becomes an `ability` step instead of reaching a handler.
 */
export interface ResolveEffect {
  type: 'ResolveEffect';
  effect: AbilityEffect;
  opened: OpenedWindow;
}

/**
 * The players' answer to a pending decision. Produces `DecisionResolved`
 * (which removes the decision), followed by the events of the chosen option's
 * commands, each handled like a forced effect's command (validated, with
 * their own forced effects, in the same undo group). If one of them is
 * rejected the whole answer is rejected and the decision stays pending.
 */
export interface ResolveDecision {
  type: 'ResolveDecision';
  decisionId: DecisionId;
  optionId: string;
  /**
   * The count the players confirmed for an option with an `amount` range
   * (clues discovered, damage dealt), which the decision's resolver reads
   * (`testedActionCommands`). Omit to accept the option's default. Rejected for an option
   * without a range or outside it.
   */
  amount?: number;
  /**
   * The counts the players confirmed for an option with named `amounts`
   * (an attack's damage and horror), filled into the option's commands where
   * they name it (`AnsweredAmount`). Counts left out keep their default. Rejected for
   * `damage` or `horror` when the option has no range for it, or outside its
   * range; the type allows no other name.
   */
  amounts?: Readonly<Partial<Record<NamedAmount, number>>>;
  /**
   * Only for a `skillTestResult` decision: how much the test succeeded or
   * failed by, a whole number of 0 or more (the suggestion's `margin`, or
   * what the players worked out). A per-point fail deals that much
   * (`Decision.perPointFailed`), and `SkillTestResolved.margin` records it.
   */
  margin?: number;
  /**
   * The investigator giving the answer, when the app knows who it is (one
   * device per player). The answer is then rejected unless they may give it
   * (`Decision.decider`). Omitted when the table shares one device, which is
   * why it is optional: the group then answers for whoever decides.
   */
  answeredBy?: InvestigatorId;
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
 * phase (`GameMeta.steps`, numbered as in the Rules Reference, `PhaseStepId`),
 * or, when none are left, moves on to the next phase (setup → investigation
 * of round 1, skipping its mythos phase; investigation → enemy → upkeep →
 * mythos of the next round) and runs its steps. Steps run until one leaves a
 * decision pending or an enemy attack needs resolving (`ResolveEnemyAttack`);
 * the next `NextPhase` after the answer resumes there. Rejected while an
 * enemy attack of step 3.3 is still due, and in the investigation phase
 * while a turn is in progress or an active investigator has not taken their
 * turn (the group ends every turn first, even one without actions). Produces
 * `PhaseChanged`, then per step `PhaseStepsChanged` and the events of the
 * step (`PlaceDoom`, `CheckDoomThreshold`, `DrawEncounter`, `MoveHunters`,
 * `ActionsReset`, `ReadyEnemy`, `AdjustInvestigator`, `RoundEnded`).
 */
export interface NextPhase {
  type: 'NextPhase';
}

/**
 * Rules Reference 2.2: the group picks the investigator whose turn begins,
 * any active investigator who has not taken a turn this round, in any order.
 * Only in the investigation phase and while no other turn is in progress.
 * The turn tells the UI whose turn it is; the engine does not restrict other
 * commands to the investigator whose turn is in progress, since without
 * player cards it cannot tell an action from a card effect. Produces
 * `TurnStarted`.
 */
export interface StartTurn {
  type: 'StartTurn';
  investigatorId: InvestigatorId;
}

/**
 * Rules Reference 2.2.2: the investigator whose turn is in progress ends it,
 * whether or not they used all their actions; sets the per-round "turn
 * taken" flag (`GameMeta.turnsTaken`). Produces `TurnEnded`.
 */
export interface EndTurn {
  type: 'EndTurn';
  investigatorId: InvestigatorId;
}

/**
 * Rules Reference, "Resign": an investigator resigns as an action in their
 * own turn, so only in the investigation phase while their turn is in
 * progress. They leave the scenario with status `resigned`, their turn ends
 * and the same clean-up as for a defeat follows: their clues stay on their
 * location, enemies engaged with them stay there unengaged, treacheries in
 * their threat area are discarded, and a new lead investigator is chosen if
 * they were the lead. The last investigator to resign ends the scenario
 * without a resolution. Produces `InvestigatorResigned` and the clean-up
 * events, then possibly `LeadInvestigatorChanged`, `DecisionRequested` or
 * `ScenarioEnded`.
 */
export interface Resign {
  type: 'Resign';
  investigatorId: InvestigatorId;
}

/**
 * The investigator takes the action ability number `action` (index into `CardStats.actions`) of
 * the card `cardId`, in their own turn and where the card offers it (`offersActionsTo`). Taken
 * as an action it provokes attacks of opportunity, unless it is a Resign or Parley. Produces no
 * events of its own: the action's effects follow (`cardActionSteps`).
 */
export interface UseCardAction extends ActionCommand {
  type: 'UseCardAction';
  investigatorId: InvestigatorId;
  cardId: InstanceId;
  action: number;
}

/**
 * Makes an active investigator the lead investigator. Raised by the decision
 * that asks the group for a new lead after the lead was defeated or resigned;
 * also usable on its own, as the lead investigator may change by card effect
 * or by the group's choice. Produces `LeadInvestigatorChanged`.
 */
export interface SetLeadInvestigator {
  type: 'SetLeadInvestigator';
  investigatorId: InvestigatorId;
}

/**
 * Changes an active investigator's remaining actions
 * (`Investigator.actionsRemaining`) by `delta`, a non-zero integer; they may
 * not drop below zero. The players count actions themselves, since player
 * cards are not modelled: they pass -1 for each action they take, and an
 * encounter card or player card that takes or grants an action passes its
 * delta, in any phase. Upkeep step 4.2 resets the count to 3; an
 * investigator whose cards grant an additional action each turn gets it by
 * the players passing +1 after that reset. Produces `ActionsAdjusted`.
 */
export interface AdjustActions {
  type: 'AdjustActions';
  investigatorId: InvestigatorId;
  delta: number;
}

/**
 * The players resolved one enemy attack of the enemy phase (an `enemyAttack`
 * step). `damage`/`horror` default to the enemy's printed values; the players
 * pass less when assets soak part of it. The enemy exhausts after its last
 * due attack (a massive enemy attacks everyone at its location first).
 * Produces `PhaseStepsChanged`, `EnemyAttacked`, `InvestigatorChanged` (damage, horror; with
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
 * An enemy attack outside enemy step 3.3: an attack of opportunity (raised by
 * `attackOfOpportunityDecisions`, whose `attack` option runs this) or a card
 * that says the enemy attacks. Deals `damage` and `horror` at once with one
 * defeat check, like `ResolveEnemyAttack`, but the enemy does not exhaust
 * (Rules Reference, "Attack of Opportunity"). The amounts are the ones the
 * players confirmed (printed values, less what assets soak). An attack whose
 * enemy has left play or whose investigator is no longer active does nothing,
 * so a second attack of opportunity on an investigator the first one defeated
 * can still be answered. Produces `EnemyAttacked`, `InvestigatorChanged` and, as usual,
 * `InvestigatorDefeated`.
 */
export interface DealEnemyAttack {
  type: 'DealEnemyAttack';
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
  damage: number;
  horror: number;
}

/**
 * Investigate action: the investigator investigates their location. The
 * players resolve the intellect test against its shroud at the table; the
 * engine raises a `skillTestResult` decision whose pass discovers clues: 1
 * by default, or the count the players confirm in `ResolveDecision.amount`
 * (cards that discover more, up to the clues on the location). A location
 * without clues when the answer arrives makes the pass discover nothing.
 * Skipping the test and using `DiscoverClues` directly is equally valid.
 * Produces `DecisionRequested`.
 */
export interface Investigate extends ActionCommand {
  type: 'Investigate';
  investigatorId: InvestigatorId;
}

/**
 * Fight action: the investigator attacks an enemy at their location
 * (combat test against its fight value). A pass deals `damage` via
 * `DamageEnemy`, or the damage the players confirm in
 * `ResolveDecision.amount` (effects that add damage on a good result).
 * Produces `DecisionRequested`.
 */
export interface Fight {
  type: 'Fight';
  investigatorId: InvestigatorId;
  enemyId: InstanceId;
  /** Damage of the attack, the pass option's default; 1 (the basic attack) unless a weapon deals more. */
  damage?: number;
}

/**
 * Evade action: the investigator evades an enemy engaged with them (agility
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
