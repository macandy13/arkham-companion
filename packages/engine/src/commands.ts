import type { BasicAction } from './action_costs';
import type { AbilityEffect, DifficultyChange, OpenedWindow, TimingWindow } from './abilities';
import type { AttackKind, KeywordAttackKind } from './forced_attacks';
import type { CampaignLog, TraumaKind } from './campaign/campaign_log';
import type { ScaledValue, TokenAmount, Trait } from './cards';
import type { CardFilter } from './lookup';
import type {
  CardCode,
  CodexEntry,
  DecisionId,
  InstanceId,
  InvestigatorId,
  MapId,
  ResolutionId,
  ScenarioId,
} from './ids';
import type { GridCell, MapPlacement, MapSpec } from './map';
import type { InvestigatorRestriction } from './restrictions';
import type {
  Decision,
  ChaosBagChangeKind,
  ChaosBagChangeLasts,
  ChaosToken,
  Difficulty,
  Investigator,
  InvestigatorStat,
  NamedAmount,
  SkillName,
  SkillTest,
  SkillTestOutcome,
  TokenKind,
  WoundKind,
  TestedAction,
} from './state';
import type { Zone } from './zone';

/**
 * Commands are intents from the UI; `handle` validates them and produces events. Any of them may
 * name the card that asked for it (`AskedByCard`).
 */
export type Command = AskedByCard &
  (
    | StartScenario
    | ManualAdjust
    | MoveCard
    | AddMap
    | PutLocationIntoPlay
    | AddConnection
    | RemoveConnection
    | RevealLocation
    | MoveInvestigator
    | AdjustInvestigator
    | HealInvestigator
    | GainResources
    | SpendResources
    | DrawCards
    | SearchDeck
    | DiscardFromHand
    | DiscardAsset
    | HealAsset
    | ReadCodexEntry
    | PlayCard
    | SpendCluesAsGroup
    | TakeDamageAndHorror
    | DefeatInvestigator
    | DiscoverClues
    | MoveTokens
    | ChangeChaosBag
    | SealChaosToken
    | AttachPlayerCard
    | DrawWeakness
    | ReleaseChaosToken
    | Advance
    | BecomeActAndAgenda
    | EndScenario
    | ShuffleEncounterDiscard
    | ShuffleEncounterDeck
    | EngageReadyEnemies
    | SpawnEnemy
    | DrawCard
    | EngageEnemy
    | DisengageEnemy
    | DamageEnemy
    | HealEnemy
    | GainSurge
    | UseReaction
    | ResolveRevelation
    | DefeatEnemy
    | ExhaustEnemy
    | RetreatEnemy
    | EvadeEnemy
    | ReadyEnemy
    | MoveEnemy
    | MoveHunters
    | RequestDecision
    | TestSkill
    | ForEachPoint
    | ByMargin
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
    | RestrictInvestigator
    | SpendActions
    | DealEnemyAttack
    | EnemyAttacks
    | Investigate
    | Fight
    | Evade
    | FailedAttack
    | EndSkillTest
  );

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
 * Produces `CardMoved`; a card leaving play first loses its attachments and tokens and is readied
 * (`handleMoveCard`), and a player card sent to the encounter discard goes out of the game.
 */
export interface MoveCard {
  type: 'MoveCard';
  cardId: InstanceId;
  to: Zone;
  /** Position in the destination, 0 = top (e.g. the top of the encounter discard); default the bottom. */
  index?: number;
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
 * investigator's remaining actions, like `AdjustActions`; `skillBoost` changes
 * the lasting boost of one of their skills (`Investigator.skillBoosts`).
 */
export type Adjustment =
  | { kind: 'moveCard'; cardId: InstanceId; to: Zone; index?: number }
  | { kind: 'tokens'; cardId: InstanceId; token: TokenKind; delta: number }
  | { kind: 'actions'; investigatorId: InvestigatorId; delta: number }
  | { kind: 'skillBoost'; investigatorId: InvestigatorId; skill: SkillName; delta: number };

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
 * Removes an existing declared edge (`GameMap.connections`) from whichever map owns
 * it (no `mapId` needed, an edge exists once on the board). A connection the cards
 * print (`printedConnections`) has no stored edge, so it is cut instead. An undirected edge
 * matches in either direction; a
 * one-way edge must match `from` and `to` exactly. Asked by a card (`source`), a connection
 * that is already gone is no error: nothing changes. Produces `ConnectionChanged`.
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
 * A command that can be taken as a basic action. With `asAction` the engine counts the action off
 * before the command resolves (`actionPayment`: what it costs now, `actionCost`, named so a cost
 * raised for the first one each round is paid once), and the action provokes attacks of
 * opportunity. The same command from an effect that spends none (a treachery moving someone, a
 * scenario step, a fast ability) leaves it out. `CommandSpec.provokes` reads it.
 */
export interface ActionCommand {
  /**
   * Taken as the investigator's action; `'free'` when a card lets them take it without spending
   * one, which still pays what cards add to its cost and provokes nothing. Default: a card effect.
   */
  asAction?: true | 'free';
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
  /**
   * Who pays the destination's cost to enter (`CardStats.enterCost`), and how many; omitted, the
   * mover pays what they can and the others the rest (`defaultCluePayments`).
   */
  spend?: ClueSpend[];
  /**
   * The players already paid the cost to enter at the table, so the engine charges nothing: the
   * pawn dragged on the map catches the screen up with a move made there.
   */
  paidAtTable?: true;
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
 * "Heal N damage" or "heal N horror": takes up to `amount` (a positive integer) of `stat` off an
 * active investigator, as much as they have, since healing more than is there heals what is
 * (Rules Reference, "Heal"). Produces `InvestigatorChanged`, or nothing when there is none.
 */
export interface HealInvestigator {
  type: 'HealInvestigator';
  investigatorId: InvestigatorId;
  stat: WoundKind;
  amount: number;
}

/**
 * An effect forbids the investigator something until the round ends (`LastingRestriction`):
 * Languor's "you cannot play or commit cards of that type this round". Nothing for an
 * investigator no longer active. Produces `InvestigatorRestricted`.
 */
export interface RestrictInvestigator {
  type: 'RestrictInvestigator';
  investigatorId: InvestigatorId;
  restriction: InvestigatorRestriction;
  until: 'round';
}

/**
 * The investigator gains `amount` resources (a positive integer): the basic resource action, taken
 * `asAction` for 1. A card's "gain N resources" is a `MoveTokens` from the pool (`gainResources`).
 * Produces `InvestigatorChanged`.
 */
export interface GainResources extends ActionCommand {
  type: 'GainResources';
  investigatorId: InvestigatorId;
  amount: number;
}

/**
 * The investigator pays `amount` resources (a positive integer) for a player card: its cost, or
 * what a card asks to spend ("spend 1 resource: +1 skill"). Allowed while a decision is pending, as
 * a fast card is paid for in the window the decision opens (Dodge against an attack, Lucky! on a
 * test) before its effect. Produces `InvestigatorChanged`; rejected when they have too few.
 */
export interface SpendResources {
  type: 'SpendResources';
  investigatorId: InvestigatorId;
  amount: number;
}

/**
 * The card whose ability asked for a command on the players' own cards, and the timing window it
 * resolved in (`action` for a card action and its cost), so the notice can name the card. Absent
 * on a command the players issued themselves, such as the draw action.
 */
export interface CommandSource {
  readonly cardId: InstanceId;
  readonly window: TimingWindow['on'];
}

/**
 * The card that asked for a command, if one did. The ability step that resolves an effect stamps
 * its `source` on every command it produces (`withSource`), as does an action's hand card cost.
 * Without one it is the players' own or a rule step's (the upkeep draw); the play screen relies on
 * that to leave it out of the "Do this by hand" notice (`skippedEffects`). With one, a command
 * that the players' version refuses for having nothing to do does as much as it can instead
 * (Rules Reference, "Effects"; its handler is not `strict`), so a card's "lose 1 action" with none
 * left doesn't fail the whole revelation; the players' buttons keep refusing it.
 */
export interface AskedByCard {
  source?: CommandSource;
}

/**
 * "Draw N cards": the investigator draws from their own deck, as a card effect or `asAction` as
 * the basic draw action. The game holds no player cards, so `deferToPlayers` leaves it to the
 * players (`CommandDeferred`).
 */
export interface DrawCards extends ActionCommand {
  type: 'DrawCards';
  investigatorId: InvestigatorId;
  amount: number;
}

/**
 * "Search (the top `top` cards of) your deck for a card with one of `traits`, add it to your hand
 * and shuffle your deck", or "… and play it (paying its cost)" with `play` (Easttown). Left to
 * the players like `DrawCards`.
 */
export interface SearchDeck {
  type: 'SearchDeck';
  investigatorId: InvestigatorId;
  traits: readonly Trait[];
  top?: number;
  play?: true;
}

/**
 * The investigator plays a card from their hand: the basic play action when `asAction`, which
 * provokes attacks of opportunity even though the engine never sees the card. The game holds no
 * player cards, so the card is left to the players like `DrawCards`; its `cost`, when the players
 * name it, is spent from the investigator's resources in the same step, so paying and playing
 * stay one undo step.
 */
export interface PlayCard extends ActionCommand {
  type: 'PlayCard';
  investigatorId: InvestigatorId;
  /** The resources paid for the card, a whole number up to what they hold. Unset: paid by hand. */
  cost?: number;
}

/**
 * "Choose and discard N cards from your hand" (Herman Collins' Parley cost): the investigator
 * discards from their own hand, or `atRandom` ("discards 1 card at random from their hand", What's
 * Going On?!). Left to the players like `DrawCards`.
 */
export interface DiscardFromHand {
  type: 'DiscardFromHand';
  investigatorId: InvestigatorId;
  amount: number;
  atRandom?: true;
}

/**
 * "Choose and discard 1 asset you control" (Crypt Chill): the investigator discards one of their
 * own assets. The game holds no player cards, so it is left to the players like `DrawCards`.
 */
export interface DiscardAsset {
  type: 'DiscardAsset';
  investigatorId: InvestigatorId;
}

/**
 * "Heal N horror from an [[Ally]] asset at this location" (Arkham Sanatorium): the investigator
 * heals `amount` of `stat` from an asset with `trait` at their location. Assets are player cards,
 * so it is left to the players like `DrawCards`.
 */
export interface HealAsset {
  type: 'HealAsset';
  investigatorId: InvestigatorId;
  stat: WoundKind;
  amount: number;
  trait: Trait;
}

/**
 * "([codex] N)" (the Smoke and Mirrors suspects): the investigator reads entry `entry` of the
 * scenario's codex in the campaign guide. The guide's text is not in the app, so it is left to the
 * players like `DrawCards`.
 */
export interface ReadCodexEntry {
  type: 'ReadCodexEntry';
  investigatorId: InvestigatorId;
  entry: CodexEntry;
}

/**
 * The commands the engine defers to the players (`CommandDeferred`): those on player cards, and
 * reading a codex entry in the campaign guide.
 */
export type PlayerCardCommand = AskedByCard &
  (DrawCards | SearchDeck | PlayCard | DiscardFromHand | DiscardAsset | HealAsset | ReadCodexEntry);

/**
 * Whether the players took `command` as an action at the table (the draw or play action), rather
 * than a card effect asking them to do it.
 */
export function takenAsAction(command: PlayerCardCommand): boolean {
  switch (command.type) {
    case 'DrawCards':
    case 'PlayCard':
      return command.asAction !== undefined;
    case 'SearchDeck':
    case 'DiscardFromHand':
    case 'DiscardAsset':
    case 'HealAsset':
    case 'ReadCodexEntry':
      return false;
  }
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
 * Asked by a card (`source`, "discover 1 clue at a location") or as the pass of an investigation
 * (`investigation`), the location may be any, as many clues as it has are taken, and an
 * investigator who may not discover clues (The Masked Hunter) takes none. Produces
 * `TokensChanged` (clues leave the location) and `InvestigatorChanged` (clues arrive).
 */
export interface DiscoverClues {
  type: 'DiscoverClues';
  investigatorId: InvestigatorId;
  locationId: InstanceId;
  amount: number;
  /**
   * The pass of an investigation (`Investigate`), of the investigator's location or another one
   * (In the Know): it finds what the location holds as the answer arrives, a correction having
   * perhaps taken clues off since the test began, and nothing for an investigator who may not
   * discover clues, as the investigation still succeeds.
   */
  investigation?: true;
}

/**
 * Adds `token` to the chaos bag, or removes one copy of it, during a scenario. Produces
 * `ChaosBagChanged`. A change `lasts: 'campaign'` is also kept in `GameState.chaosBagChanges`,
 * so that `proposeResolution` writes it into the campaign log. Removing a token the bag does not
 * hold changes nothing. Between scenarios the campaign's `AddChaosToken` and
 * `RemoveChaosToken` change the bag instead.
 */
export interface ChangeChaosBag {
  type: 'ChangeChaosBag';
  token: ChaosToken;
  change: ChaosBagChangeKind;
  lasts: ChaosBagChangeLasts;
}

/**
 * The players attach the player card `code` to an enemy or a location (`hostId`, a card in
 * play): Barricade, Handcuffs. Its card data names what it does to its host, such as Barricade's
 * restriction (`enemiesMoveInto` but for Elite enemies). Produces `PlayerCardAttached`, a new card
 * attached to the host; rejects a host that is no enemy or location in play, or not the one the
 * card attaches to (`CardStats.attachesTo`, `invalidAttachmentHost`), and a card that is no player asset or event (`notAPlayerCard`). It leaves
 * play with its host, and `discard` sends it out of the game (`isPlayerCard`).
 */
export interface AttachPlayerCard {
  type: 'AttachPlayerCard';
  hostId: InstanceId;
  code: CardCode;
}

/**
 * `investigatorId` draws the weakness `code` (an enemy or a treachery in the card DB) from their
 * deck: Mob Enforcer, The Thing That Follows. Rules Reference, "Weakness": it resolves as if it
 * were an encounter card, so it is drawn the way `DrawCard` draws one (revelation, peril,
 * surge; an enemy spawns engaged with them unless it has a spawn instruction). Produces
 * `WeaknessDrawn`, a new card they own (`CardInstance.owner`), then `DrawCard`'s events.
 * Rejects a card of another type (`notAWeaknessToDraw`): an asset or event weakness stays in the
 * players' hands, which the app doesn't track.
 */
export interface DrawWeakness {
  type: 'DrawWeakness';
  investigatorId: InvestigatorId;
  code: CardCode;
}

/**
 * Seals one copy of `token` from the chaos bag on a card `investigatorId` controls, or on them
 * (`GameState.sealedTokens`). Produces `ChaosTokenSealed`; a token the bag does not hold seals
 * nothing, like `ChangeChaosBag`'s remove. `ReleaseChaosToken` puts it back.
 */
export interface SealChaosToken {
  type: 'SealChaosToken';
  token: ChaosToken;
  investigatorId: InvestigatorId;
}

/**
 * Releases one copy of `token` sealed on `investigatorId` back into the chaos bag. Produces
 * `ChaosTokenReleased`; nothing when no such token is sealed on them. An investigator leaving
 * the scenario releases theirs on their own (`investigatorLeavesEvents`).
 */
export interface ReleaseChaosToken {
  type: 'ReleaseChaosToken';
  token: ChaosToken;
  investigatorId: InvestigatorId;
}

/**
 * Where `MoveTokens` takes tokens from or puts them: the token pool, the current agenda, a card,
 * an investigator (their clues and resources), or the location an investigator is at ("place 1
 * of your clues on your location"). The pool holds any number; a card holds tokens only while in
 * play (Rules Reference, "Leaves Play": its tokens return to the pool), and an investigator only
 * while in the scenario.
 */
export type TokenHolder =
  | 'pool'
  | 'currentAgenda'
  | { card: InstanceId }
  | { investigator: InvestigatorId }
  | { locationOf: InvestigatorId };

/**
 * How many tokens `MoveTokens` moves: a number or one per investigator, `'all'` that `from`
 * holds, or as many as bring `to` up to `upTo` ("add clues to it until it has 2 clues per
 * investigator on it", Ritual Site), none when it holds that many already.
 */
export type TokenMoveAmount = TokenAmount | 'all' | { upTo: TokenAmount };

/**
 * The one command for tokens changing holder by a card's effect: "place 1 doom on the current
 * agenda" (from the pool), "remove all doom from it" (to the pool), "move all doom from each
 * [[Cultist]] enemy to the current agenda", "move all damage on that enemy to Mother", "take
 * control of 1 of the clues on Constance Dumaine". Moves as many as `from` holds, and none from
 * or to a card out of play or an investigator out of the scenario, since a card effect does as
 * much as it can (Rules Reference, "Effects"). Damage moves only onto a card with health and
 * horror only onto one with sanity (FAQ, October 2024). A card counting its own tokens
 * (`whenTokensOnSelf`) sees moved ones like placed ones, and an enemy that ends up with as much
 * damage as its health is defeated. Doom on the agenda is checked at the mythos threshold step
 * only (`CheckDoomThreshold`). The players' own corrections stay a `ManualAdjust`. Produces
 * `TokensChanged` for each card and `InvestigatorChanged` for each investigator, then any
 * `EnemyDefeated`.
 */
export interface MoveTokens {
  type: 'MoveTokens';
  token: TokenKind;
  amount: TokenMoveAmount;
  from: TokenHolder;
  to: TokenHolder;
}
/** The two decks of stage cards a scenario advances through (`Advance`). */
export type StageDeck = 'agenda' | 'act';

/**
 * Advances the current card of `deck`, paying nothing. Its first step clears the card's tokens:
 * an agenda removes all doom in play, an act the tokens on it, clues included (RR "Act Deck and
 * Agenda Deck"); an act's clues are the cost of its own `advanceBySpendingClues` action, whose
 * effect this is, and an objective met or another card advances it for free. The card then turns
 * to its reverse side (its `advanced` abilities), which resolves while it is still current; then
 * it leaves the game and the next card becomes current. The agenda advances by the "yes" answer
 * to its threshold question (see `ResolveDecision`) and by card effects.
 * Produces `TokensChanged`/`InvestigatorChanged` (the tokens), `CardFlipped`, `AgendaAdvanced`
 * or `ActAdvanced`, the reverse side's events, `CardMoved`, `CurrentCardChanged` and, for the
 * last card, `ScenarioEnded` unless the reverse side ended the scenario.
 */
export interface Advance {
  type: 'Advance';
  deck: StageDeck;
  /**
   * Fallback resolution for the last card when its reverse side does not end the scenario
   * itself; rejected while further cards follow.
   */
  resolution?: ResolutionId;
}

/**
 * "Replace the current act and agenda with this card. It is both the current act and the current
 * agenda" (The Devourer Below, agenda 3's reverse side): the current agenda, while it advances,
 * becomes the current act as well, and the act deck leaves the game, so no act follows. The
 * advance then leaves the card in play, turned to its reverse side, which prints neither a doom
 * threshold nor a clue requirement (`completeAdvance`). Produces `CardMoved` for each card of
 * the act deck, then `CurrentCardChanged`.
 * With `next`, the agenda that follows takes both places instead ("Special agenda 3a replaces
 * the current act and agenda", Queen of Ash, agenda 2's reverse side): the advance then puts the
 * advancing agenda out of the game as usual and makes that card the current agenda too.
 */
export interface BecomeActAndAgenda {
  type: 'BecomeActAndAgenda';
  next?: true;
}

/** Clues one investigator pays towards advancing the act. */
export interface ClueSpend {
  investigatorId: InvestigatorId;
  amount: number;
}

/**
 * "Investigators in the Hallway may, as a group, spend the requisite number of clues" (The
 * Barrier): the active investigators at `locationId`, or anywhere without one, pay `amount`
 * clues together, each what `spend` lists (omitted, the lead pays what they can, then the
 * others in seat order). Rejected like a `groupClues` cost (`groupCluePayments`), and for a
 * payer elsewhere (`investigatorNotAtLocation`). Produces an `InvestigatorChanged` per payment.
 */
export interface SpendCluesAsGroup {
  type: 'SpendCluesAsGroup';
  amount: ScaledValue;
  locationId?: InstanceId;
  spend?: ClueSpend[];
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
 * `investigatorId` draws a card: the top card of the encounter deck (the mythos draw, surge, "draw
 * the top card of the encounter deck"), of another deck ("the top card of the Cultist deck",
 * `scenarioDeck('cultist')`) or of a pile out of play ("the facedown card beneath your location",
 * `beneath(yourLocation())`), or with `pick` a card found in `from`'s zones. The card is revealed
 * into the `resolving` zone and resolves as an encounter card: its revelation first, then an enemy
 * spawns (engagement, aloof and spawn instructions are `SpawnEnemy`) and any other card goes to
 * the discard unless its revelation put it somewhere else (`putIntoThreatArea`); a card with surge
 * makes the investigator draw again from the encounter deck. As soon as the encounter deck is
 * empty its discard is shuffled back in. Rejected when there is no top card to draw
 * (`encounterDeckEmpty`, `nothingToDraw`), so an action that would draw nothing can't be taken; a
 * `pick` that finds nothing draws nothing, as far as the effect can go. Produces, per card drawn,
 * `EncounterCardDrawn`, `CardFlipped` and `CardMoved`, followed by `CardMoved`s and a
 * `DeckShuffled` when that card emptied the encounter deck and the discard was shuffled back.
 */
export interface DrawCard {
  type: 'DrawCard';
  investigatorId: InvestigatorId;
  /** The zone drawn from, or the zones a `pick` looks through in order (deck before discard). */
  from: Zone | readonly Zone[];
  /** A card other than the top card of the (first) zone; see `DrawPick`. */
  pick?: DrawPick;
}

/**
 * Which card a `DrawCard` draws instead of the top one:
 * - `match`: the first card that fits, each zone top-down. With `discardSkipped`, a match in the
 *   encounter deck first discards every card above it ("discard cards from the top of the
 *   encounter deck until a Ghoul enemy is discarded. The lead investigator draws that enemy");
 *   with a match only in the discard, the whole deck is discarded and the discard shuffled back in
 *   before the search goes on, as when the deck runs out mid-discard (Infested Pipes). Without
 *   it the matching card is taken out and the rest stays where it is.
 * - `card`: this card, one copy a search found (`searchAndDrawCopies`); nothing when it has left
 *   `from`'s zones since.
 */
export type DrawPick = { match: CardFilter; discardSkipped?: true } | { card: InstanceId };

/**
 * Puts an enemy that is not in play (encounter deck, set aside, …) into play.
 * Where it appears, in this order: `at`; the location named by its `spawn`
 * keyword (several matches or unreadable text: `DecisionRequested` of kind
 * `chooseLocation`, enemy stays put; no such location in play: discarded);
 * the location of `investigatorId` (the investigator who drew it), whom it
 * engages whatever its prey. Elsewhere it engages per `engageEvents`. Produces
 * `CardMoved`, then `EnemyEngaged` or `DecisionRequested` (prey tie). `DrawCard` resolves
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
 * switches investigator). Asked by a card ("it engages you"), it takes the enemy from any
 * location and does nothing for a massive enemy or one engaged with the investigator already
 * (`AskedByCard`). Produces `EnemyEngaged`.
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
 * Puts `amount` (positive, "1 [per_investigator]" read against the player count) damage on an
 * enemy in play. An enemy with damage equal to or above its health (per `resolveValue`) is
 * defeated in the same step. Produces `TokensChanged`, then `EnemyDefeated`; nothing for an enemy
 * a card keeps from being damaged (`isEnemyRestricted` `damaged`, A Gathering).
 */
export interface DamageEnemy {
  type: 'DamageEnemy';
  enemyId: InstanceId;
  amount: TokenAmount;
}

/**
 * Answers the question every drawn treachery asks before its revelation
 * (`revelationDecision`): resolve it, which opens the card's `revealed`
 * window for `investigatorId`, its drawer, or with `cancelled` (a card such
 * as Ward of Protection) resolve none of it. Either way the card is then
 * placed as usual (discarded) and keywords such as surge still apply.
 * Rejected for a card that is not resolving (`notResolving`). Produces
 * `RevelationResolved`.
 */
export interface ResolveRevelation {
  type: 'ResolveRevelation';
  cardId: InstanceId;
  investigatorId: InvestigatorId;
  cancelled?: true;
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
 * The investigator triggers reaction number `ability` of the card `cardId` (`Ability.reaction`):
 * the "use" option of the question the reaction asks as its window opens puts this in front of
 * the reaction's effects. Produces `ReactionUsed`, which counts towards the reaction's limit; the
 * limit is checked when the question is asked.
 */
export interface UseReaction {
  type: 'UseReaction';
  cardId: InstanceId;
  investigatorId: InvestigatorId;
  ability: number;
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

/**
 * The investigator evades the enemy, as a passed evasion does: a ready enemy
 * exhausts, one engaged with them disengages (a massive enemy only
 * exhausts), and then "after [this enemy] is evaded" opens. Produces
 * `ExhaustChanged`, `EnemyDisengaged`, then `EnemyEvaded`.
 */
export interface EvadeEnemy {
  type: 'EvadeEnemy';
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
  /**
   * A passed evasion test caused it, so it is a "successful" evasion. An automatic evade is
   * not (Rules Reference, "Automatic Failure/Success": no skill test is made).
   */
  successful?: true;
}

/**
 * Rules Reference, "Elusive": after a ready elusive enemy attacks or is attacked, it disengages,
 * moves to a connecting location (one without investigators if able) and exhausts. Without `to`
 * the engine picks the destination, or asks the lead investigator between equal ones with a
 * `chooseLocation` whose options name `to`. Does nothing for an exhausted enemy or one that left
 * the table meanwhile. Produces `EnemyDisengaged`, `CardMoved` and `ExhaustChanged`.
 */
export interface RetreatEnemy {
  type: 'RetreatEnemy';
  enemyId: InstanceId;
  /** A location connecting to the enemy's, as the answer to the choice. */
  to?: InstanceId;
}

/**
 * Exhausts an enemy in play (after it attacked, or by a card effect). Exhausting an exhausted
 * enemy does nothing, as readying a ready one does. Produces `ExhaustChanged`.
 */
export interface ExhaustEnemy {
  type: 'ExhaustEnemy';
  enemyId: InstanceId;
}

/**
 * Readies an exhausted enemy in play (upkeep, or a card effect). A readied,
 * unengaged enemy with an investigator at its location engages, as the rules
 * demand. Readying a ready enemy does nothing, so "at the end of each turn:
 * ready it" (Umôrdhoth) resolves whether or not it is exhausted, and one a card keeps from
 * readying (Handcuffs, `isEnemyRestricted`) stays exhausted. Produces `ExhaustChanged`, then
 * `EnemyEngaged` or `DecisionRequested`.
 */
export interface ReadyEnemy {
  type: 'ReadyEnemy';
  enemyId: InstanceId;
}

/**
 * The destination rule of a `MoveEnemy` step (`enemyWay` in `enemy_ways.ts`):
 *
 * - a location: along a shortest path there ("each unengaged Ghoul enemy moves 1 location
 *   towards the Parlor"), staying while it is out of play;
 * - `prey`: the hunter's rule (Rules Reference, "Hunter"), towards the nearest investigator, prey
 *   breaking ties; equally near investigators whose ways part are first a `chooseInvestigator`
 *   decision (`move:<enemy>:investigator`), answered by a move toward the chosen one's location.
 *   It stays while an investigator is at its location.
 */
export type EnemyDestination = InstanceId | 'prey';

/**
 * A card effect or a hunter's step moves an enemy in play, or the players carry such an effect
 * out by dragging the enemy on the map. With `to` alone it goes straight there ("move it to the
 * Hallway"), connected or not. With a destination rule (`toward`, `EnemyDestination`) it moves
 * one connection along its way, exhausted or not: it stays when it is there already or has no
 * way, and equally short first steps become a `chooseLocation` decision for the lead
 * investigator (`move:<enemy>`), answered by the same move with `to` naming the chosen step.
 *
 * An engaged enemy moves only with its investigator, so a plain effect is refused for it
 * (`enemyEngaged`); a forced instruction (`forced`, "each Cultist enemy moves once toward
 * Underground Cistern") is followed whatever the engagement, so the enemy disengages and moves
 * from its investigator's location. At its destination a ready enemy then engages as when it
 * spawns there (`engageEvents`); an enemy already at `to` stays as it is. An enemy entering an
 * unrevealed location does not reveal it. Produces `CardMoved`, then `EnemyEngaged` or
 * `DecisionRequested`, or only the step's `DecisionRequested`.
 */
export type MoveEnemy = {
  type: 'MoveEnemy';
  enemyId: InstanceId;
  /** A forced instruction, followed even for an engaged enemy. Default false. */
  forced?: boolean;
  /**
   * "If it engages an investigator, it makes an immediate attack" (Aerial Pursuit): the
   * `EnemyAttacks` decision follows the engagement, or each option of the players' choice of whom
   * it engages attacks the one it names.
   */
  attacksIfItEngages?: true;
} & (
  | { to: InstanceId; toward?: never }
  | {
      /** Where it heads, one connection at a time. */
      toward: EnemyDestination;
      /** The first step the players chose between equally short ones; it must be one of them. */
      to?: InstanceId;
    }
);

/**
 * Moves the ready, unengaged hunter enemies one step towards the nearest
 * investigator (enemy phase; the phase assistant of M1.10 issues it), each with
 * a `MoveEnemy` toward its prey. Hunters with an investigator at their location,
 * without a route or with a pending decision stay. When two or more hunters
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
  /**
   * Card data only: what the table adds to `test.difficulty` ("increase this skill test's
   * difficulty by 1 for each damage on you", "+2 difficulty if there is an enemy at your
   * location"). `resolveEffect` reads the table as the ability resolves, folds the changes into
   * `test.difficulty` and drops them, so a command never carries them.
   */
  difficultyChanges?: readonly DifficultyChange[];
  /** What a pass does; a `ForEachPoint` or `ByMargin` among them depends on how much it passed by. */
  onPass: readonly Command[];
  /** What a fail does; a `ForEachPoint` or `ByMargin` among them depends on how much it failed by. */
  onFail: readonly Command[];
}

/**
 * "For each point you fail by, take 1 damage" (Grasping Hands), "you must either …" for each
 * point (Umôrdhoth's Wrath): an entry of a skill test outcome (`TestSkill.onPass`, `onFail`) whose
 * `commands` run once per point of the answer's margin (`ResolveDecision.margin`). An amount
 * (damage, horror, clues, doom) becomes one effect of that many, as "for each" asks; anything else,
 * such as a choice, repeats. `answerCommands` expands it, so it only means something there: on its
 * own it is rejected (`marginOutsideTest`).
 */
export interface ForEachPoint {
  type: 'ForEachPoint';
  commands: readonly Command[];
}

/**
 * "Take 1 damage. If you fail by 2 or more, take 2 damage instead" (Blood and Rust): an entry of a
 * skill test outcome that runs the commands of the tier with the highest `atLeast` the answer's
 * margin reaches, and nothing when it reaches none (no `atLeast: 0` tier). Expanded by
 * `answerCommands` like `ForEachPoint`, and rejected on its own (`marginOutsideTest`).
 */
export interface ByMargin {
  type: 'ByMargin';
  tiers: readonly MarginTier[];
}

/** One tier of `ByMargin`: what the outcome does once its margin is `atLeast` or more. */
export interface MarginTier {
  atLeast: number;
  commands: readonly Command[];
}

/**
 * One effect of a card ability, resolved when its turn comes (`resolveEffect`)
 * against the state then: a card test's outcome, run after the answer. So an
 * effect on a drawer whom the outcome's own damage defeated names nobody and
 * is dropped, rather than rejecting the answer (Rules Reference: resolve as
 * much as possible). Produced by the engine (`abilities/resolve.ts`), never by the
 * players; it becomes an `ability` step instead of reaching a handler.
 */
export interface ResolveEffect {
  type: 'ResolveEffect';
  effect: AbilityEffect;
  opened: OpenedWindow;
  /**
   * Set when the effect picks a card or investigator as it resolves (`PickedRef`: "a [[Cultist]]
   * enemy with no doom on it"), so "for each point you fail by" repeats it, each point picking
   * anew, instead of scaling one pick's amount (`timesMargin`).
   */
  picks?: true;
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
   * (clues discovered, damage dealt), which fills in the option's `{ answer: 'amount' }`
   * (`AnsweredAmount`). Omit to accept the option's default. Rejected for an option
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
   * (`ForEachPoint`), it picks the tier of a `ByMargin`, and
   * `SkillTestResolved.margin` records it.
   */
  margin?: number;
  /**
   * Only for a `skillTestResult` decision: the chaos tokens the players revealed, when the app
   * drew them. The bless and curse tokens among them go back to their pool after the test
   * (`ChaosBagChanged`) instead of into the bag. Ignored for any other decision.
   */
  revealed?: readonly ChaosToken[];
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
 * decision pending (step 3.3 asks about each enemy attack,
 * `attackDecision`); the next `NextPhase` after the answers resumes
 * there. Rejected while a decision is pending, and in the investigation phase
 * while a turn is in progress or an active investigator has not taken their
 * turn (the group ends every turn first, even one without actions). Produces
 * `PhaseChanged`, then per step `PhaseStepsChanged` and the events of the
 * step (`MoveTokens`, `CheckDoomThreshold`, `DrawCard`, `MoveHunters`,
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
 * taken" flag (`GameMeta.turnsTaken`). Asked by a card (`source`, "end your turn") outside
 * that investigator's turn, it does nothing. Produces `TurnEnded`.
 */
export interface EndTurn {
  type: 'EndTurn';
  investigatorId: InvestigatorId;
}

/**
 * Rules Reference, "Resign": an investigator resigns as an action in their
 * own turn, so only in the investigation phase while their turn is in
 * progress, and only through a card that offers it: this is the effect of
 * `resignAction()`, taken with `UseCardAction`. They leave the scenario with status `resigned`, their turn ends
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
  /**
   * A card effect makes them resign now, whatever the phase or turn ("Each investigator
   * immediately resigns", Emergent Evils' reverse side), rather than as their action.
   */
  immediately?: true;
}

/**
 * The investigator takes the action ability number `action` (index into `CardStats.actions`) of
 * the card `cardId` where the card offers it (`offersActionsTo`). The printed ability decides
 * whether it is taken as an action, so unlike an `ActionCommand` it carries no `asAction`: an
 * action ability is taken in the investigator's own turn and provokes attacks of opportunity
 * unless it is a Resign or Parley; a free one (`CardAction.free`) is taken at any time and never
 * provokes. Produces no events of its own: the action's effects follow (`cardActionSteps`).
 */
export interface UseCardAction {
  type: 'UseCardAction';
  investigatorId: InvestigatorId;
  cardId: InstanceId;
  action: number;
  /**
   * Who pays an action's group clue cost, and how many (`ActionCost` `groupClues`); omitted, the
   * investigator taking it pays what they can and the others the rest, in seat order. Rejected
   * for an action without a group cost (`noGroupCost`).
   */
  spend?: ClueSpend[];
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
 * not drop below zero. A correction or a card's grant, never the payment of an action, which is
 * `SpendActions`: the players pass one to correct the count, and an encounter card or player card
 * that takes or grants an action passes its delta, in any phase. Upkeep step 4.2 resets the count to 3; an
 * investigator whose cards grant an additional action each turn gets it by
 * the players passing +1 after that reset. `allRemaining` takes all that remain ("lose all
 * remaining actions"); asked by a card (`source`), any loss takes no more than remain. Produces
 * `ActionsAdjusted`, with the actual change.
 */
export interface AdjustActions {
  type: 'AdjustActions';
  investigatorId: InvestigatorId;
  delta: number | 'allRemaining';
}

/**
 * What a spent action paid for (`SpendActions.for`): a basic action by the word that names it, or
 * the action ability number `action` printed on the card `cardId` (`UseCardAction`).
 */
export type ActionPaidFor =
  { kind: 'basic'; action: BasicAction } | { kind: 'card'; cardId: InstanceId; action: number };

/**
 * The investigator spends `amount` actions to take the action `for` names (Rules Reference,
 * "Action"): what `handle` plays before a command taken as an action resolves (`actionPayment`),
 * and before the attacks of opportunity it provokes. Its own command rather than an
 * `AdjustActions`, so the log tells an action taken apart from a correction or a card's grant,
 * and a card that reacts to spending an action can read what it paid for. `amount` is what the
 * action costs now (`actionCost`); 0 for a basic action a card lets them take for free, which is
 * performed all the same. A basic action is recorded for the round (`GameMeta.actionsTaken`), so a
 * card that raises the first such action each round (Frozen in Fear) raises only that one.
 * Produces `ActionsSpent`.
 */
export interface SpendActions {
  type: 'SpendActions';
  investigatorId: InvestigatorId;
  amount: number;
  for: ActionPaidFor;
}

/**
 * The players resolved one enemy attack, as the answer of its `attackDecision`: an attack of enemy
 * step 3.3 (`kind: 'enemyPhase'`), an attack of opportunity, a retaliate or alert attack, or a card
 * that says the enemy attacks. Deals `damage` and `horror` at once with one defeat check (horror is
 * skipped for an investigator the damage defeated). They default to the enemy's printed values (a
 * due attack's, in the enemy phase); the players pass less when assets soak part of it.
 * `cancelled` (a card cancelled it) deals nothing and fires no "after it attacks" abilities.
 *
 * Only an enemy phase attack exhausts the enemy, after its last due attack (a massive enemy
 * attacks everyone at its location first), cancelled or not; it also leaves step 3.3's list. An
 * attack the step listed that is no longer due (its enemy left or disengaged) only leaves the
 * list, without exhausting anyone; one that was never listed is rejected (`attackNotDue`). Any
 * other kind leaves the enemy as it is (Rules Reference, "Attack of Opportunity") and does nothing
 * once its enemy has left the table or its investigator is no longer active, so a second attack of
 * opportunity on an investigator the first one defeated can still be answered.
 * Produces `PhaseStepsChanged` (enemy phase), `EnemyAttacked`, `InvestigatorChanged`, as usual
 * `InvestigatorDefeated`, and `ExhaustChanged` (enemy phase).
 */
export interface DealEnemyAttack {
  type: 'DealEnemyAttack';
  kind: AttackKind;
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
  damage?: number;
  horror?: number;
  cancelled?: true;
}

/**
 * A card says the enemy attacks the investigator ("it attacks you", "it attacks each investigator
 * at its location"). Asks the investigator an `attackDecision` (`cardAttack:<enemy>:<investigator>`)
 * whose `attack` option deals the printed damage and horror, which the players may lower for what
 * their assets soak (`DealEnemyAttack`), and whose `skip` is a card that cancels the attack. The
 * enemy attacks ready or exhausted and stays as it is. Nothing for an enemy not on the table or an
 * investigator no longer active. Produces `DecisionRequested`.
 */
export interface EnemyAttacks {
  type: 'EnemyAttacks';
  enemyId: InstanceId;
  investigatorId: InvestigatorId;
  /**
   * The keyword that makes the attack (retaliate, alert; `keywordAbilities`): asked as
   * `<keyword>:<enemy>`, and only by a ready enemy, which both keywords require. Without it, a
   * card makes the attack (`cardAttack`).
   */
  kind?: KeywordAttackKind;
}

/**
 * The result of a failed fight (Rules Reference, "Engaged with other investigators"): the attack's
 * `damage` goes to the other investigator the enemy is engaged with, if any, as the enemy is
 * engaged when the answer arrives (the players may have moved it since the test began). Produces
 * the `TakeDamageAndHorror` events, or none.
 */
export interface FailedAttack {
  type: 'FailedAttack';
  investigatorId: InvestigatorId;
  enemyId: InstanceId;
  damage: number;
}

/**
 * The skill test of a basic action ends (ST.8): the last command of each of its outcomes, after
 * the test's results, so that "after applying all results" abilities see them. Produces
 * `SkillTestEnded`.
 */
export interface EndSkillTest {
  type: 'EndSkillTest';
  investigatorId: InvestigatorId;
  subject: InstanceId;
  action: TestedAction;
  outcome: SkillTestOutcome;
}

/**
 * Investigate action: the investigator investigates their location, or `locationId` when a card
 * investigates another one (In the Know). The
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
  /**
   * A revealed location in play to investigate instead of their own, as if they were there (In
   * the Know); its shroud, its "cannot investigate" and its clues count. It names
   * its target, as an investigation has none besides the investigator's location, while `Fight`
   * and `Evade` already name their enemy and only lift a check (`atAnyLocation`).
   */
  locationId?: InstanceId;
}

/**
 * Fight action: the investigator attacks an enemy at their location, or with `atAnyLocation`
 * one elsewhere (Marksmanship), as a card allows (combat test against its fight value). A pass deals `damage` via
 * `DamageEnemy`, or the damage the players confirm in
 * `ResolveDecision.amount` (effects that add damage on a good result).
 * Produces `DecisionRequested`.
 */
export interface Fight extends ActionCommand {
  type: 'Fight';
  investigatorId: InvestigatorId;
  enemyId: InstanceId;
  /** Damage of the attack, the pass option's default; 1 (the basic attack) unless a weapon deals more. */
  damage?: number;
  /** The enemy may be at another location, as a card allows (Marksmanship). Aloof still applies. */
  atAnyLocation?: true;
  /** The attack ignores aloof, as Marksmanship and Telescopic Sight say. */
  ignoreAloof?: true;
}

/**
 * Evade action: the investigator evades an enemy engaged with them, or with `atAnyLocation` any
 * enemy on the table, as a card allows (agility test against its evade value). A pass exhausts the enemy (if ready) and
 * disengages it (a massive enemy is not in the `engaged` zone and stays).
 * Produces `DecisionRequested`.
 */
export interface Evade extends ActionCommand {
  type: 'Evade';
  investigatorId: InvestigatorId;
  enemyId: InstanceId;
  /** The enemy need not be engaged with them: any enemy on the table, as a card allows. */
  atAnyLocation?: true;
}

/** String literal of every command type. */
export type CommandType = Command['type'];
