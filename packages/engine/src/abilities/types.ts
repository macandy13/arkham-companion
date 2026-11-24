import { resolveAmount, type ScaledValue, type TokenAmount } from '../cards';
import type { Command, TestSkill, ForEachPoint, ByMargin, MarginTier } from '../commands';
import type { CardCode, InstanceId, InvestigatorId } from '../ids';
import type { UsageLimit } from '../usage_limits';
import type { EnemyFilter } from '../enemies';
import type { CardFilter } from '../lookup';
import type {
  AmountRange,
  AnsweredAmount,
  Decision,
  DecisionOption,
  InvestigatorStat,
  NamedAmount,
  Phase,
  SkillTest,
  SkillTestKind,
  SkillTestOutcome,
  TokenKind,
} from '../state';
import type { Zone } from '../zone';

/**
 * The moment a card ability fires (architecture "Triggers and card effects"): the event it waits
 * for (`on`, `WindowEvent`), whose cards hear it (`of`, by default the event's usual listeners,
 * `defaultScope`) and, with `filter`, which card the event must be about ("if the Ghoul Priest is
 * defeated" is `{ on: 'defeated', of: 'currentActOrAgenda', filter: { code } }`). A new window
 * on a known event is a scope or a filter; a new event is a case of `WindowEvent` and of
 * `windowsOpenedBy`, the one place that turns events into windows.
 */
export type TimingWindow = WindowEvent & { of?: ListenerScope; filter?: CardFilter };

/**
 * The events an ability can wait for, with what else the event must match (the phase that ended,
 * the test's action and outcome, the token placed). Who hears each is `ListenerScope`.
 */
export type WindowEvent =
  /** The card is turned face up: a location revealed, or a drawn encounter card (its revelation). */
  | { on: 'revealed' }
  /**
   * The end of an investigator's turn (`EndTurn`), naming them: "at the end of your turn" for a
   * card in their threat area and "when you end your turn at this location" for their location
   * (`yours`), "at the end of each investigator's turn" for a card in play (`inPlay`, Umôrdhoth).
   * A turn cut short by resignation or defeat opens nothing, as the investigator has left with
   * the card's reason to fire.
   */
  | { on: 'turnEnds' }
  /**
   * "When your turn begins" for a card in an investigator's threat area, and "when your turn
   * begins at this location" for their location (`yours`, as for `turnEnds`): the start of that
   * investigator's turn (`StartTurn`), naming them.
   */
  | { on: 'turnBegins' }
  /**
   * "At the end of the [mythos / investigation / enemy] phase", for every card
   * in play, naming no investigator: opened by the `PhaseChanged` that leaves
   * the phase. The upkeep phase ends with the round, so its end is `roundEnds`.
   */
  | { on: 'phaseEnds'; phase: EndingPhase }
  /**
   * "After [this location / attached location] is successfully
   * investigated", "after you fail to evade [this enemy]": the investigator
   * passed or failed the test of a basic action (`SkillTestResolved.action`)
   * against the location or enemy. Opened for that card and each card
   * attached to it, naming the tester, at ST.6: before the test's results
   * (the clue discovered), as the Rules Reference times "after you
   * successfully investigate". A test that is no investigation, attack or
   * evasion (a revelation's) opens none; a player card's "Investigate." is
   * an `Investigate` command, so it opens it like the basic action.
   */
  | { on: 'tested'; action: TestedAction; outcome: SkillTestOutcome }
  /**
   * "After applying all results of that skill test" (retaliate, alert) and "after it is attacked"
   * (elusive): the skill test of a basic action against the card ended (`SkillTestEnded`, ST.8),
   * its results applied. Opened for the location or enemy tested, naming the tester.
   */
  | { on: 'testEnded'; action: TestedAction; outcome: SkillTestOutcome }
  /**
   * "After you succeed at a skill test at [this card]'s location" (Margaret Liu), or "after you
   * successfully investigate [its] location" with `action` (David Renfield): an investigator
   * passed a test (`SkillTestResolved`), any test, or with `action` the basic action's. Opened at
   * ST.6, like `tested`, for the cards at the test's location (`here`), naming the tester and
   * carrying the margin when the answer gave one (`OpenedWindow.margin`).
   */
  | { on: 'succeeded'; action?: TestedAction }
  /**
   * "After [this enemy] engages you": the enemy became engaged with an
   * investigator (`EnemyEngaged`), whether it engaged them or they engaged
   * it, as the rules treat both alike. Opened for the enemy, naming the
   * investigator.
   */
  | { on: 'engaged' }
  /**
   * "After [this enemy] attacks you": opened by `EnemyAttacked` for the enemy,
   * naming the investigator, after the attack's damage and horror. An attack
   * of opportunity opens it too, being an attack; an investigator the attack
   * defeated is nobody by then.
   */
  | { on: 'attacked' }
  /**
   * "After [this enemy] is evaded": opened by `EnemyEvaded` for the enemy, naming the evader,
   * once it is exhausted and disengaged; unlike `tested` for an evasion, which opens before.
   * With `successful`, "after you successfully evade [this enemy]" (Cornelia Akely): opened once
   * more only after a passed evasion test (`EnemyEvaded.successful`), never after an automatic
   * evade.
   */
  | { on: 'evaded'; successful?: true }
  /**
   * "After you discover clues at [this location]": opened by
   * `CluesDiscovered` for the location, naming the investigator.
   */
  | { on: 'cluesDiscovered' }
  /**
   * "After you enter [this location]": an investigator moved into the
   * location (`InvestigatorMoved`), naming them. When the move turned it
   * face up, it fires before the reveal's abilities: a fixed stand-in, as
   * the rules let the lead order simultaneous forced effects (M1V). Being
   * placed there, at setup or on the map by an investigator without a
   * location, is no move, so it opens nothing. Then the current agenda and act hear it, for an
   * objective on the location (`currentActOrAgenda`, "If an investigator enters the Ritual
   * Site, advance").
   */
  | { on: 'entered' }
  /** "At the end of the round", upkeep step 4.6, for every card in play; names no investigator. */
  | { on: 'roundEnds' }
  /**
   * The agenda or act advanced: its reverse side, opened by `AgendaAdvanced`
   * or `ActAdvanced` for that card while it is still current (`completeAdvance`
   * replaces it afterwards); names no investigator.
   */
  | { on: 'advanced' }
  /**
   * A card entered the victory display (`CardMoved`, or `EnemyDefeated` for an enemy with
   * victory) or was placed beneath the current act: an objective of the current agenda or act
   * on what the display holds ("If there are 6 unique [[Cultist]] enemies in the victory display,
   * advance"), opened for both, naming no investigator; a `countOf` condition over an `eachInZone`
   * reference counts, the cards beneath the act too when it names that zone.
   */
  | { on: 'addedToVictoryDisplay' }
  /**
   * Tokens of `token` were placed on the card (`TokensChanged` with a positive delta): for an
   * objective on the card's own tokens ("If there are 2 clues per investigator on this Act,
   * advance", `whenTokensOnSelf`), which checks the count with a `valueOf` condition on the card's `tokens`. Names
   * no investigator. Corrections (`ManualAdjust`) fire no triggers, so tokens put on by hand
   * open nothing.
   */
  | { on: 'tokensPlaced'; token: TokenKind }
  /**
   * "When [this enemy] is defeated": opened by `EnemyDefeated` for the enemy,
   * naming the location it was at and no investigator. It resolves once the
   * enemy has left play, a stand-in for "when" (before the defeat) that
   * changes nothing while the effect only needs "its location", which the
   * event records, for every card that hears it. Then the current agenda and act hear it, for an objective on the enemy
   * (`currentActOrAgenda`, "if the Ghoul Priest is defeated, advance"); only the current ones,
   * so a used-up act or agenda never fires again.
   */
  | { on: 'defeated' }
  /**
   * An action ability of the card (`CardStats.actions`), taken with `UseCardAction`, naming the
   * investigator who took it and, as every window, the card. No event opens it: the command
   * queues the action's effects itself, so an `Ability` listing this window never fires.
   */
  | { on: 'action' };

/**
 * Whose abilities hear an opened window, relative to what it names (`windowsOpenedBy` opens each
 * event for the scopes its listeners can have, in a fixed order, as the rules let the lead order
 * simultaneous forced effects, M1V):
 * - `self`: the card the event is about, such as the revealed card, the attacking enemy or the
 *   location entered; for a test, cards attached to the tested card too ("after attached location
 *   is successfully investigated").
 * - `yours`: the cards of the investigator the window names, their threat area and then their
 *   location ("at the end of your turn", "when you end your turn at this location").
 * - `inPlay`: every card in play with active abilities ("at the end of the round").
 * - `currentActOrAgenda`: the current agenda, then the current act, for their objectives.
 * - `here`: every card at the location the window names (`locationOfCard`), engaged enemies and
 *   attachments too ("after you succeed at a skill test at Margaret Liu's location").
 */
export type ListenerScope = 'self' | 'yours' | 'inPlay' | 'currentActOrAgenda' | 'here';

/** Who hears a window that names no scope (`TimingWindow.of`): what each event's cards usually mean. */
export function defaultScope(on: WindowEvent['on']): ListenerScope {
  switch (on) {
    case 'turnEnds':
    case 'turnBegins':
      return 'yours';
    case 'phaseEnds':
    case 'roundEnds':
      return 'inPlay';
    case 'addedToVictoryDisplay':
      return 'currentActOrAgenda';
    case 'succeeded':
      return 'here';
    default:
      return 'self';
  }
}

/** The basic actions whose test opens `tested`: investigate, fight and evade. */
export type TestedAction = SkillTestKind['kind'];

/** The phases whose end opens `phaseEnds`: all but setup and upkeep. */
export type EndingPhase = Exclude<Phase, 'setup' | 'upkeep'>;

/** Whether the end of `phase` opens a `phaseEnds` window (`EndingPhase`). */
export function isEndingPhase(phase: Phase): phase is EndingPhase {
  return phase !== 'setup' && phase !== 'upkeep';
}

/**
 * A card an ability names without an instance ID: the card that has the
 * ability, one its window names, or a scenario's unique card by code.
 */
export type RelativeCard =
  | { ref: 'self' }
  /**
   * The location the window names (where a defeated enemy was), or else the
   * location of the investigator the window names (the drawer's location).
   * For the drawer's location only: none once the card's limit of one per
   * location is reached there (`CardStats.limit`), so a
   * revelation that would attach it there does nothing.
   */
  | { ref: 'windowLocation' }
  /**
   * The location the card with the ability is at, attached to or is itself (`locationOfCard`):
   * "this location" on a card attached to one ("each investigator at this location", Fire!); none
   * while the card is nowhere on the map.
   */
  | { ref: 'selfLocation' }
  /** The card this repetition of a `forEach` ability is for (`thatCard()`); none outside one. */
  | { ref: 'thatCard' }
  /**
   * The one copy of `code` in the game, in whatever zone: for a scenario's
   * unique cards ("the Parlor", "the Ghoul Priest"); none while the game holds
   * no copy or several, and the effect is skipped with `AbilityEffectSkipped`.
   */
  | { ref: 'onlyCopy'; code: CardCode }
  /**
   * Each enemy on the table its filter matches (`EachEnemyFilter`: "each unengaged [[Ghoul]]
   * enemy", "each enemy at your location", "each enemy engaged with you"): the command repeats
   * once per enemy, in card order. Unlike hunters, nobody picks the order: one enemy's step
   * towards a fixed location changes no other enemy's path.
   */
  | ({ ref: 'eachEnemy' } & EachEnemyFilter)
  /**
   * Each card in the zone `zone` names, or in each of a list of zones, that its filter matches
   * (`CardFilter`): "each set-aside [[Cultist]] enemy", "6 unique [[Cultist]] enemies in the
   * victory display", "[[Elite]] enemies in the victory display and beneath this act"
   * (`cardsInZones`). The command repeats once per card, zone by zone in zone order, and none
   * when no card matches. With `top`, only the top `top` cards of each zone count: "the top 3
   * cards of the encounter deck", fewer when the zone holds fewer.
   */
  | ({
      ref: 'eachInZone';
      zone: Templated<Zone> | readonly Templated<Zone>[];
      top?: number;
      /** At most this many in all, the first ones in zone order ("1 [per_investigator] copies"). */
      first?: ScaledValue;
    } & CardFilter)
  /**
   * Each card in play (`isInPlay`) its filter matches (`CardFilter`), in card order: "if the
   * Masked Hunter is in play". With `at`, only those at one of the locations it names
   * (`locationOfCard`: the location itself, a card placed there, and what an investigator there
   * is engaged with, controls or has in their threat area): "if Lita Chantler is at your location".
   */
  | ({ ref: 'eachInPlay'; at?: RelativeCard | readonly RelativeCard[] } & CardFilter)
  /**
   * A set-aside copy of `code` (`setAsideCopy`): "the set-aside Lita Chantler", "1 set-aside copy
   * of Fire!". In an effect repeated for each investigator or card, each repetition takes the next
   * copy ("each investigator draws 1 set-aside copy of Mark of Elokoss"), as the repetitions
   * resolve together. None when no copy is left, so the command is left out: the card does as
   * much as it can.
   */
  | { ref: 'setAsideCopy'; code: CardCode }
  /**
   * The enemy its filter matches (`EnemyFilter`) nearest to the location of the investigator the
   * window names ("the nearest [[Cultist]] enemy", `nearestEnemies`); none when there is no such
   * enemy. When several are equally near, the lead investigator picks one (Rules Reference,
   * "Choices"): the effect becomes a decision with an option per enemy.
   */
  | ({ ref: 'nearestEnemy' } & EnemyFilter)
  /**
   * A location in play its filter matches (`LocationFilter`: "move to a [[Central]] location"),
   * other than the one the investigator the window names is at, since moving there would be no
   * move; none when there is no other. When there are several, that investigator picks one: the
   * effect becomes a decision with an option per location.
   */
  | ({ ref: 'locationWith' } & LocationFilter)
  /**
   * One enemy its filter matches (`EnemyFilter`), at `at` when given ("deal 1 damage to an enemy
   * at your location", "place 1 doom on a [[Cultist]] enemy with no doom on it"), picked by the
   * investigator the window names when there are several; none when there is none.
   */
  | ({ ref: 'anEnemy'; at?: RelativeCard } & EnemyFilter)
  /**
   * The location in play with the most `token`s that the card with the ability
   * may attach to ("attach to the location with the most clues and without a
   * copy of Locked Door attached": its `CardStats.limit`
   * limit); none when it may attach nowhere. Equally many go to the lead
   * investigator (Rules Reference, "Choices"): the effect becomes a decision
   * with an option per location.
   */
  | { ref: 'locationWithMost'; token: TokenKind }
  /**
   * The location in play nearest to the location of the investigator the window names, counted in
   * connections (`extremeLocations`, the drawer's own location at 0), that the card with the
   * ability may attach to ("attach to the nearest location without Fire! attached": its
   * `CardStats.limit`); none when it may attach nowhere. Equally near ones go to the lead
   * investigator (Rules Reference, "Choices"), as for `locationWithMost`.
   */
  | { ref: 'nearestLocation' };

/**
 * An investigator an ability names relative to its window: the one the
 * window names (the drawer), the lead investigator, or each investigator
 * still in the scenario, in player order (the lead first), which repeats the
 * command once per investigator.
 */
export type RelativeInvestigator =
  | { ref: 'windowInvestigator' }
  | { ref: 'lead' }
  /** Each investigator still in the scenario, in player order; only those at `at` when given. */
  | { ref: 'eachInvestigator'; at?: RelativeCard }
  /**
   * One investigator still in the scenario, at `at` when given, picked by the investigator the
   * window names when there are several ("heal 1 horror from an investigator at this location").
   */
  | { ref: 'anInvestigator'; at?: RelativeCard };

/**
 * Which locations in play a `locationWith` reference may stand for: those its print matches
 * (`CardFilter`, "a [[Central]] location"), and with `connected` only those connecting to the
 * location of the investigator the window names ("move to a connecting location").
 */
export interface LocationFilter extends CardFilter {
  connected?: true;
}

/**
 * Which enemies an `eachEnemy` reference names: those with `trait` and without `withoutTrait`,
 * only the unengaged ones with `unengaged`, only those at one of the locations `at` names
 * (engaged ones are at their investigator's location), and only those engaged with `engagedWith`
 * (none when it names nobody). A single `at` location out of play skips the effect, as any
 * missing `onlyCopy` does; one of a list does not, so "each [[Ghoul]] enemy in the Hallway or
 * Parlor" still finds the ghouls in the one that is there.
 */
export interface EachEnemyFilter extends EnemyFilter {
  at?: RelativeCard | readonly RelativeCard[];
  engagedWith?: RelativeInvestigator;
}

/**
 * `T` with every instance and investigator ID replaced by a relative
 * reference, recursively. Card data is shared by every copy of a card, so it
 * can name no instance; `resolveEffect` fills the IDs in when the ability
 * fires. Map IDs stay as they are: a scenario's maps are fixed by its setup,
 * so card data may name one. Lists are templated item by item (the
 * outcomes of a `skillTest`).
 */
export type Templated<T> = T extends InstanceId
  ? RelativeCard
  : T extends InvestigatorId
    ? RelativeInvestigator
    : T extends object
      ? { [K in keyof T]: Templated<T[K]> }
      : T;

/**
 * The commands card data may use: every command of the engine that encounter
 * cards print, whether or not a scenario uses it yet, so card data of a new
 * campaign starts from one vocabulary (ME.1). Setup, corrections and phase
 * flow (`StartScenario`, `ManualAdjust`, `NextPhase`, …) never join, as no
 * card performs them.
 */
export type AbilityCommand =
  | Extract<
      Command,
      {
        type:
          | 'AdjustInvestigator'
          | 'AdjustActions'
          | 'EndTurn'
          | 'DiscoverClues'
          | 'HealInvestigator'
          | 'GainResources'
          | 'DrawCards'
          | 'SearchDeck'
          | 'DiscardFromHand'
          | 'DiscardAsset'
          | 'HealAsset'
          | 'ReadCodexEntry'
          | 'TakeDamageAndHorror'
          | 'CheckDoomThreshold'
          | 'MoveTokens'
          | 'SpendCluesAsGroup'
          | 'ChangeChaosBag'
          | 'MoveCard'
          | 'RevealLocation'
          | 'SpawnEnemy'
          | 'HealEnemy'
          | 'DamageEnemy'
          | 'DefeatEnemy'
          | 'MoveEnemyTowards'
          | 'DisengageEnemy'
          | 'EnemyAttacks'
          | 'EngageEnemy'
          | 'EngageReadyEnemies'
          | 'ReadyEnemy'
          | 'ExhaustEnemy'
          | 'RetreatEnemy'
          | 'GainSurge'
          | 'UseReaction'
          | 'MoveInvestigator'
          | 'AddMap'
          | 'PutLocationIntoPlay'
          | 'AddConnection'
          | 'RemoveConnection'
          | 'Advance'
          | 'BecomeActAndAgenda'
          | 'ShuffleEncounterDiscard'
          | 'ShuffleEncounterDeck'
          | 'DrawCard'
          | 'DefeatInvestigator'
          | 'Resign'
          | 'EndScenario';
      }
    >
  | AbilityTest
  | AbilityForEachPoint
  | AbilityByMargin
  | AbilityChoice;

/**
 * `TestSkill` with outcomes that are ability commands too, so a test in card
 * data can only lead to what card data may do. The outcomes stay templated
 * until the answer: each resolves in its own turn then (`ResolveEffect`), so
 * it sees what the effects before it did, an `each…` reference in one
 * repeats only that effect, and one that names nobody is dropped alone.
 */
export type AbilityTest = Omit<TestSkill, 'test' | 'onPass' | 'onFail'> & {
  test: AbilitySkillTest;
  onPass: readonly AbilityCommand[];
  onFail: readonly AbilityCommand[];
};

/**
 * `SkillTest` as card data writes it: its difficulty may be a count the decider enters as they
 * pick the test in a choice (`skillTestOfEither` with an `AskedCount`), which their answer fills
 * in (`AnsweredAmount`) before the test is asked.
 */
export type AbilitySkillTest = Omit<SkillTest, 'difficulty'> & {
  difficulty: number | AnsweredAmount;
};

/**
 * A count the app does not track, entered by the decider of a choice as they pick an option
 * (`DecisionOption.amounts`), within `range`: "X is the number of cards in your hand"
 * (`cardsInYourHand`).
 */
export interface AskedCount {
  ask: NamedAmount;
  range: AmountRange;
}

/**
 * "X, where X is the number of cards in your hand": the players' hands are not modelled, so the
 * drawer says how many cards they hold, after committing to the test: committed cards leave the
 * hand before the difficulty is checked (ST.6). Five is the opening hand, a default the stepper
 * starts from.
 */
export const cardsInYourHand: AskedCount = { ask: 'cardsInHand', range: { default: 5, min: 0 } };

/** `ForEachPoint` as card data writes it (`forEachPoint`), its commands ability commands too. */
export type AbilityForEachPoint = Omit<ForEachPoint, 'commands'> & {
  commands: readonly AbilityCommand[];
};

/** `ByMargin` as card data writes it (`byMargin`), its tiers' commands ability commands too. */
export type AbilityByMargin = Omit<ByMargin, 'tiers'> & {
  tiers: readonly (Omit<MarginTier, 'commands'> & { commands: readonly AbilityCommand[] })[];
};

/**
 * `RequestDecision` as card data writes it: a choice ("the lead investigator
 * must decide") whose options lead only to what card data may do. It has no
 * `subject`: a decision about an agenda or act would be dropped as the card
 * advances, which is exactly when its reverse side asks. Its lists stay
 * mutable so that it is a `RequestDecision`. Unlike a test's outcomes, its
 * options resolve as the choice is raised, so they can be dry-run
 * (`withResolvableOptions`); the whole choice is dropped when a reference in
 * one option names nobody (`resolveRefs`).
 */
export interface AbilityChoice {
  type: 'RequestDecision';
  decision: Pick<Decision, 'id' | 'prompt' | 'decider' | 'subject'> & {
    kind: 'chooseOption';
    options: AbilityOption[];
  };
}

/**
 * One answer of an `AbilityChoice`: an option whose commands are ability commands, with the counts
 * the decider enters as they pick it (`AskedCount`).
 */
export type AbilityOption = Pick<DecisionOption, 'id' | 'label' | 'amounts'> & {
  commands: AbilityCommand[];
  /** The option is offered only while this holds as the choice is raised (`ChoiceOption.when`). */
  when?: AbilityCondition;
};

/**
 * One step of what an ability does: an allowed command written with
 * relative references instead of IDs ("Revelation – Take 1 horror" is
 * `TakeDamageAndHorror` on `{ ref: 'windowInvestigator' }`). Reusing the
 * command types keeps one vocabulary: a new kind of effect is a command
 * added to `AbilityCommand`, not a new effect type.
 */
export type AbilityEffect = Templated<AbilityCommand>;

/**
 * What must hold when the window opens for an ability to fire ("If it is act 3, …"), for a card
 * action to be offered and taken ("During your turn:", `CardAction.condition`, read in the
 * action's window), or for a resolution step to apply (`ResolutionStep` `when`, read on the
 * ended game outside any window: "if the Ghoul Priest is in the victory display"). An ability
 * checks it once, as its window opens; the effects then resolve whatever they change. Three
 * shapes cover most conditions cards print, each over the references effects use: which card is
 * current, how many things a reference names, and a value on the table; then the phase or turn
 * the game is in, and `allOf`/`anyOf`/`not` to combine them. A new condition is usually a new
 * reference or `Quantity`, not a new kind.
 */
export type AbilityCondition =
  /** The current act or agenda (`deck`) is one of `codes` ("If it is act 3", "if it is agenda 2"). */
  | { kind: 'currentCard'; deck: 'act' | 'agenda'; codes: readonly CardCode[] }
  /**
   * The number of things `of` names as the window opens is within the range: the cards or
   * investigators of an `each…` reference, counted as an effect on each of them would repeat
   * ("if there are no [[Cultist]] enemies in play", "if no enemy is engaged with you", "6 unique
   * [[Cultist]] enemies in the victory display"), or the candidates of a picked reference ("if
   * there is no such location", Locked Door). A reference that names nothing, such as
   * `windowLocation` in a window without one, counts none.
   */
  | ({ kind: 'countOf'; of: RepeatedRef | PickedRef } & StatRange)
  /** `value` is within the range ("if you have no clues", "2 clues per investigator on this act"). */
  | ({ kind: 'valueOf'; value: Quantity } & StatRange)
  /**
   * `value` is at least `than`, each summed over what it names ("whichever you have more of",
   * Ashen Rebirth); fails when either names nothing.
   */
  | { kind: 'atLeast'; value: Quantity; than: Quantity }
  /** The game is in `phase` ("after Hellhound attacks you during the enemy phase"). */
  | { kind: 'phase'; phase: Phase }
  /**
   * The test that opened the window (`succeeded`) succeeded by at least `min` ("by 2 or more").
   * It counts only with a margin the players confirm, which the test then asks for
   * (`passMarginMatters`).
   */
  | { kind: 'margin'; min: number }
  /**
   * An investigator's turn is in progress: anyone's ("during any investigator's turn", the act's
   * group clue spend), or with `of` that of the investigator it names ("during your turn").
   */
  | { kind: 'turn'; of?: RelativeInvestigator }
  /** Each of `conditions` holds ("during your turn, if there are exactly 1 or 2 investigators"). */
  | { kind: 'allOf'; conditions: readonly AbilityCondition[] }
  /** At least one of `conditions` holds. */
  | { kind: 'anyOf'; conditions: readonly AbilityCondition[] }
  /** `condition` does not hold. */
  | { kind: 'not'; condition: AbilityCondition };

/**
 * A number on the table a `valueOf` condition reads:
 * - `stat`: what each investigator `who` names has of `stat`; every one of them must be within
 *   the range, and none named (a window without an investigator) fails.
 * - `tokens`: the tokens of `token` on each card `on` names, likewise.
 * - `groupClues`: the clues the investigators at the only copy of `location` who may spend them
 *   (`clueSpendersAt`) hold between them, so they can pay a `spendCluesAsGroup` there (The
 *   Barrier); without a location, all of them anywhere ("Where There's Smoke…").
 */
export type Quantity =
  | { kind: 'stat'; stat: InvestigatorStat; who: RelativeInvestigator }
  | { kind: 'tokens'; token: TokenKind; on: RelativeCard }
  | { kind: 'groupClues'; location?: CardCode };

/**
 * What the table adds to a card's skill test difficulty (`TestSkill.difficultyChanges`):
 * - `per`: `by` for each point of `quantity`, summed over everyone it names ("+1 difficulty for
 *   each damage on you", Eager for Death);
 * - `when`: `by` if `condition` holds ("+2 difficulty if you control 2 or more clues", Red
 *   Herring).
 */
export type DifficultyChange =
  { per: Quantity; by: number } | { when: AbilityCondition; by: number };

/**
 * Bounds on a value, both included, each a number or one per investigator ("2 clues per
 * investigator"); at least one is given, so the range always says something.
 */
export type StatRange =
  { min: TokenAmount; max?: TokenAmount } | { min?: TokenAmount; max: TokenAmount };

/** `amount` as a `ScaledValue`, for views that show an objective's count. */
export function asScaled(amount: TokenAmount): ScaledValue {
  return typeof amount === 'number' ? { fixed: amount, perInvestigator: 0 } : amount;
}

/** Whether `value` lies within `range`, its bounds scaled for `playerCount` investigators. */
export function inRange(value: number, range: StatRange, playerCount: number): boolean {
  const min = range.min === undefined ? 0 : resolveAmount(range.min, playerCount);
  const max = range.max === undefined ? Infinity : resolveAmount(range.max, playerCount);
  return value >= min && value <= max;
}

/**
 * A forced card ability: what it does when its window opens, if its
 * `condition` holds. Card data holds a list of them (`CardStats.abilities`);
 * several abilities of one card in one window resolve in the order they are
 * listed, so two abilities with conditions that exclude each other read as
 * the "If … Otherwise …" of a card.
 */
export interface Ability {
  window: TimingWindow;
  condition?: AbilityCondition;
  /**
   * The effects resolve once for each investigator or card the reference names as the window
   * opens, like the condition, and not at all when it names none (`repetitionsOf`). Each
   * repetition binds what it is for: an investigator becomes the window's (`windowInvestigator`),
   * so `skillTest` and `you()` refer to them ("Each investigator must test [willpower] (4)",
   * `forEachInvestigator`); a card becomes `thatCard()` ("For each [[Ghoul]] enemy in the Hallway or
   * Parlor", `forEachEnemy`; "for each enemy, place 1 doom on it").
   */
  forEach?: RepeatedRef;
  /**
   * "[reaction] After you discover 1 or more clues at this location: Gain 1 resource." The players
   * choose to trigger it (`reaction`): as its window opens, the investigator it names is asked to
   * use it or pass, within its `limit` ("(Limit once per round.)"). Absent, the ability is forced.
   */
  reaction?: { limit?: UsageLimit };
  effects: readonly AbilityEffect[];
}

/** A reference that stands for one of several candidates, which someone may have to pick. */
export type PickedRef =
  | Extract<
      RelativeCard,
      { ref: 'nearestEnemy' | 'anEnemy' | 'locationWith' | 'locationWithMost' | 'nearestLocation' }
    >
  | Extract<RelativeInvestigator, { ref: 'anInvestigator' }>;

/** A reference that repeats the command, as `eachInvestigator` does. */
export type RepeatedRef = Extract<RelativeCard | RelativeInvestigator, { ref: `each${string}` }>;
