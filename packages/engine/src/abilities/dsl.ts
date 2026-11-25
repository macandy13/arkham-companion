import type { ScaledValue, TokenAmount, Trait } from '../cards';
import type {
  Advance,
  ChangeChaosBag,
  CommandSource,
  DamageEnemy,
  DefeatEnemy,
  DisengageEnemy,
  EndScenario,
  ExhaustEnemy,
  HealEnemy,
  MoveCard,
  ReadyEnemy,
  RevealLocation,
  SpawnEnemy,
  RequestDecision,
  MoveTokens,
  TokenHolder,
  TokenMoveAmount,
  TakeDamageAndHorror,
} from '../commands';
import type { TraumaKind } from '../campaign/campaign_log';
import {
  codexEntry,
  type CardCode,
  type DecisionId,
  type InstanceId,
  type InvestigatorId,
  type MapId,
  type ResolutionId,
} from '../ids';
import type { GridCell } from '../map';
import type { UsageLimit } from '../usage_limits';
import type { EnemyFilter } from '../enemies';
import type { CardFilter } from '../lookup';
import type { KeywordAttackKind } from '../forced_attacks';
import type { AddMapStep } from '../setup';
import type {
  AnsweredAmount,
  ChaosBagChangeLasts,
  ChaosToken,
  DecisionOption,
  InvestigatorStat,
  Phase,
  SkillTestOutcome,
  SkillName,
  TokenKind,
  WoundKind,
  TestedAction,
} from '../state';
import {
  attachedTo,
  beneath,
  encounterDeck,
  encounterDiscard,
  playAreaOf,
  scenarioDeck,
  setAside,
  threatAreaOf,
  type ScenarioDeck,
  type Zone,
} from '../zone';
import type {
  Ability,
  AbilityChoice,
  AbilityCondition,
  AbilityEffect,
  AskedCount,
  DifficultyChange,
  EachEnemyFilter,
  EachInPlayRef,
  EndingPhase,
  LocationFilter,
  PickedRef,
  Quantity,
  RelativeCard,
  RelativeInvestigator,
  RepeatedRef,
  StatRange,
  Templated,
} from './types';

/**
 * "[reaction] After you discover 1 or more clues at this location: Draw 1 card. (Limit once per
 * round.)": `ability`, whose window names the investigator it offers itself to, as a reaction
 * they may use or pass (`Ability.reaction`), written
 * `reaction(afterDiscoveringClues(drawCards(1)), { per: 'round' })`.
 */
export function reaction(ability: Ability, limit?: UsageLimit): Ability {
  return { ...ability, reaction: limit === undefined ? {} : { limit } };
}
/**
 * A forced ability that fires when the card is revealed: its revelation for
 * an encounter card. The most common ability, written `whenRevealed(takeHorror(1))`.
 */
export function whenRevealed(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'revealed' }, effects };
}

/**
 * A forced ability "at the end of your turn" of a card in a threat area,
 * written `atEndOfTurn(skillTest('willpower', 3, { onPass: [discardSelf()] }))`, or "when you end
 * your turn at this location" of a location, for the investigator ending it there:
 * `atEndOfTurn(takeHorror(1))` (Flooded Crypt).
 */
export function atEndOfTurn(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'turnEnds' }, effects };
}

/**
 * A forced ability "after you enter" a location, for the investigator who
 * entered, written `afterEntering(takeHorror(1))` (the Attic).
 */
export function afterEntering(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'entered' }, effects };
}

/**
 * A forced ability "at the end of each investigator's turn" of a card in play,
 * written `atEndOfEachTurn(readySelf())` (Umôrdhoth).
 */
export function atEndOfEachTurn(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'turnEnds', of: 'inPlay' }, effects };
}

/** A forced ability "when your turn begins" of a card in a threat area. */
export function whenTurnBegins(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'turnBegins' }, effects };
}

/**
 * A forced ability "at the end of the mythos phase" (or the investigation or
 * enemy phase), written `atEndOfPhase('mythos', placeDoomOnSelf(1))` (Wizard of the Order).
 */
export function atEndOfPhase(phase: EndingPhase, ...effects: AbilityEffect[]): Ability {
  return { window: { on: 'phaseEnds', phase }, effects };
}

/**
 * A forced ability after a basic action's test against the card or its
 * host: "After attached location is successfully investigated: Discard
 * Obscuring Fog" is `afterTest('investigate', 'pass', discardSelf())`.
 */
export function afterTest(
  action: TestedAction,
  outcome: SkillTestOutcome,
  ...effects: AbilityEffect[]
): Ability {
  return { window: { on: 'tested', action, outcome }, effects };
}

/** A forced ability "after [this enemy] engages you", written `afterEngaging(takeHorror(1))`. */
export function afterEngaging(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'engaged' }, effects };
}

/** A forced ability "when [this enemy] is defeated", written `whenDefeated(takeHorror(1, eachInvestigator({ at: itsLocation() })))`. */
export function whenDefeated(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'defeated' }, effects };
}

/** A forced ability "after [this enemy] attacks you", written `afterAttacking(takeHorror(1))`. */
export function afterAttacking(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'attacked' }, effects };
}

/** A forced ability "after [this enemy] is evaded", written `afterEvaded(move(self(), victoryDisplay))`. */
export function afterEvaded(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'evaded' }, effects };
}

/**
 * "After you successfully evade [this enemy]", written
 * `reaction(afterEvadingSuccessfully(readySelf(), codex(2)))` (Cornelia Akely): only after a passed
 * evasion test, not an automatic evade.
 */
export function afterEvadingSuccessfully(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'evaded', successful: true }, effects };
}

/**
 * "After you succeed at a skill test [by N or more] at [this card]'s location" (Margaret Liu,
 * `afterSucceedingHere({ by: 2 }, …)`), or "after you successfully investigate [its] location"
 * (David Renfield, `afterSucceedingHere({ action: 'investigate' }, …)`): the `succeeded` window,
 * with a `margin` condition for `by`.
 */
export function afterSucceedingHere(
  { action, by }: { action?: TestedAction; by?: number },
  ...effects: AbilityEffect[]
): Ability {
  return {
    window: action === undefined ? { on: 'succeeded' } : { on: 'succeeded', action },
    effects,
    ...(by === undefined ? {} : { condition: { kind: 'margin', min: by } }),
  };
}

/** A forced ability "after you discover clues at [this location]", written `afterDiscoveringClues(placeDoomOnSelf(1))`. */
export function afterDiscoveringClues(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'cluesDiscovered' }, effects };
}

/** A forced ability "at the end of the round", written `atEndOfRound(discardSelf())`. */
export function atEndOfRound(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'roundEnds' }, effects };
}

/**
 * An objective of an agenda or act that its current card fulfils when an
 * enemy of code `enemy` is defeated: "If the Ghoul Priest is defeated,
 * advance", written `whenEnemyDefeated(codes.ghoulPriest, advanceAct())`.
 */
export function whenEnemyDefeated(enemy: CardCode, ...effects: AbilityEffect[]): Ability {
  return { window: { on: 'defeated', of: 'currentActOrAgenda', filter: { code: enemy } }, effects };
}

/**
 * An objective of an agenda or act that its current card fulfils when an investigator enters a
 * location of code `location`: "If an investigator enters the Ritual Site, advance", written
 * `whenAnInvestigatorEnters(codes.ritualSite, advanceAct())`.
 */
export function whenAnInvestigatorEnters(location: CardCode, ...effects: AbilityEffect[]): Ability {
  return {
    window: { on: 'entered', of: 'currentActOrAgenda', filter: { code: location } },
    effects,
  };
}

/**
 * An objective of an agenda or act on the victory display: `effects` resolve once a card entering
 * it (or beneath the act) brings the cards `cards` names to `atLeast`. "If there are 6 unique
 * [[Cultist]] enemies in the victory display, advance" is
 * `whenVictoryDisplayHolds(eachInZone(victoryDisplay, { trait: trait('Cultist'), unique: true }), 6, advanceAct())`.
 */
export function whenVictoryDisplayHolds(
  cards: Extract<RelativeCard, { ref: 'eachInZone' }>,
  atLeast: number,
  ...effects: AbilityEffect[]
): Ability {
  return {
    window: { on: 'addedToVictoryDisplay' },
    condition: { kind: 'countOf', of: cards, min: atLeast },
    effects,
  };
}

/**
 * A forced ability "after [tokens] are placed on [this card]", written
 * `afterTokensPlaced('doom', drawFromEncounterDiscard({ name: 'Fire!' }, lead()))` (Wild Flames:
 * "after doom is placed on the agenda"). Opened by each placement (`tokensPlaced`), not by
 * corrections made by hand.
 */
export function afterTokensPlaced(token: TokenKind, ...effects: AbilityEffect[]): Ability {
  return { window: { on: 'tokensPlaced', token }, effects };
}

/**
 * "Objective – If there are 2 clues per investigator on this Act, advance": `effects` resolve
 * once tokens placed on the card bring it to `atLeast` tokens of `token`, written
 * `whenTokensOnSelf('clue', perInvestigator(2), advanceAct())`. Checked as tokens arrive
 * (`tokensPlaced`), so it fires on the placement that reaches the count; once, as advancing
 * clears the act's tokens and every token-placing command emits one `TokensChanged` per card.
 */
export function whenTokensOnSelf(
  token: TokenKind,
  atLeast: ScaledValue,
  ...effects: AbilityEffect[]
): Ability {
  return {
    window: { on: 'tokensPlaced', token },
    condition: {
      kind: 'valueOf',
      value: { kind: 'tokens', token, on: { ref: 'self' } },
      min: atLeast,
    },
    effects,
  };
}

/**
 * The reverse side of an agenda or act, written
 * `whenAdvanced(revealLocation(onlyCopy(codes.parlor)))`.
 */
export function whenAdvanced(...effects: AbilityEffect[]): Ability {
  return { window: { on: 'advanced' }, effects };
}

/**
 * "Test [skill] (difficulty)" for the investigator the window names, about
 * the card with the ability; `onPass` and `onFail` follow the answer. An
 * outcome that depends on how much the test passed or failed by holds a
 * `forEachPoint` or `byMargin` entry: "for each point you fail by, take 1
 * damage" is `{ onFail: [forEachPoint(takeDamage(1))] }`.
 */
export function skillTest(
  skill: SkillName,
  difficulty: number,
  outcomes: TestOutcomes = {},
): AbilityEffect {
  return testOf(skill, difficulty, outcomes);
}

/** What a `skillTest` does once answered, and what the table adds to its difficulty. */
export interface TestOutcomes {
  onPass?: AbilityEffect[];
  onFail?: AbilityEffect[];
  difficultyChanges?: DifficultyChange[];
}

function testOf(
  skill: SkillName,
  difficulty: number | AnsweredAmount,
  outcomes: TestOutcomes,
): AbilityEffect {
  return {
    type: 'TestSkill',
    investigatorId: { ref: 'windowInvestigator' },
    cardId: { ref: 'self' },
    test: { skill, difficulty },
    ...(outcomes.difficultyChanges === undefined
      ? {}
      : { difficultyChanges: outcomes.difficultyChanges }),
    onPass: outcomes.onPass ?? [],
    onFail: outcomes.onFail ?? [],
  };
}

/**
 * "+1 difficulty for each damage on you" (`DifficultyChange.per`), a change of a `skillTest`'s
 * difficulty: `by` for each point of `quantity`.
 */
export function plusDifficultyPer(quantity: Quantity, by = 1): DifficultyChange {
  return { per: quantity, by };
}

/**
 * "+2 difficulty if there is an enemy at your location" (`DifficultyChange.when`), a change of a
 * `skillTest`'s difficulty: `by` if `condition` holds as the test is asked for (see
 * `withDifficultyChanges` on when the table is read).
 */
export function plusDifficultyIf(condition: AbilityCondition, by: number): DifficultyChange {
  return { when: condition, by };
}

/**
 * "For each point you succeed / fail by, …" (`ForEachPoint`), an entry of a
 * test's `onPass` or `onFail`: `effects` once per point, an amount multiplied
 * by it.
 */
export function forEachPoint(...effects: AbilityEffect[]): AbilityEffect {
  return { type: 'ForEachPoint', commands: effects };
}

/**
 * "…. If you fail by 2 or more, … instead" (`ByMargin`), an entry of a test's
 * `onPass` or `onFail`: by the least margin each tier needs, its effects, of
 * which the highest tier reached runs. Blood and Rust's fail is
 * `byMargin({ 0: [takeDamage(1)], 2: [takeDamage(2)] })`.
 */
export function byMargin(tiers: Readonly<Record<number, AbilityEffect[]>>): AbilityEffect {
  return {
    type: 'ByMargin',
    tiers: Object.entries(tiers).map(([atLeast, commands]) => ({
      atLeast: Number(atLeast),
      commands,
    })),
  };
}

/**
 * "Test [willpower] (3) or [agility] (3)": the investigator the window names picks one of
 * `skills` (decision `id`), then tests it like `skillTest`, with the same outcomes either way.
 * A difficulty the app cannot read ("X, where X is the number of cards in your hand",
 * `cardsInYourHand`) is an `AskedCount`: the investigator enters it as they pick the skill.
 */
export function skillTestOfEither(
  id: DecisionId,
  skills: readonly [SkillName, SkillName],
  difficulty: number,
  outcomes?: TestOutcomes,
): AbilityEffect;
/** No card changes a count the decider enters, so such a test lists no `difficultyChanges`. */
export function skillTestOfEither(
  id: DecisionId,
  skills: readonly [SkillName, SkillName],
  difficulty: AskedCount,
  outcomes?: Omit<TestOutcomes, 'difficultyChanges'>,
): AbilityEffect;
export function skillTestOfEither(
  id: DecisionId,
  skills: readonly [SkillName, SkillName],
  difficulty: number | AskedCount,
  outcomes: TestOutcomes = {},
): AbilityEffect {
  const asked = typeof difficulty === 'number' ? undefined : difficulty;
  const tested = typeof difficulty === 'number' ? difficulty : { answer: difficulty.ask };
  return youMustEither(
    id,
    'decision.chooseSkill',
    skills.map((skill) => ({
      id: skill,
      label: `skill.${skill}`,
      ...(asked ? { amounts: { [asked.ask]: asked.range } } : {}),
      effects: [testOf(skill, tested, outcomes)],
    })),
  );
}

/**
 * "Put it into play in your threat area": the card with the ability moves to
 * the threat area of the investigator the window names (the drawer).
 */
export function putIntoThreatArea(): AbilityEffect {
  return move(self(), threatAreaOf(you()));
}

/**
 * "Take control of Lita Chantler": the card with the ability moves to the play area of the
 * investigator the window names (the one who took the action), out of reach of everyone else's
 * actions (`offersActionsTo`). Player cards aren't modelled, so this is for story assets.
 */
export function takeControl(): AbilityEffect {
  return move(self(), playAreaOf(you()));
}

/**
 * "Attach it to the location with the most clues": the card with the ability attaches to
 * `location`, written `attachTo(locationWithMost('clue'))` (Locked Door).
 */
export function attachTo(location: RelativeCard): AbilityEffect {
  return move(self(), attachedTo(location));
}

/** A card a `Selector` picks, as card effects name one. */
type PickedCard = Extract<RelativeCard, { ref: 'pick' }>;

/** The candidates nearest to the investigator the window names (`PickMeasure`). */
const NEAREST = { measure: { kind: 'distance' }, extreme: 'fewest' } as const;

/**
 * "The location with the most clues and without a copy of [this card] attached": the lead
 * investigator picks among those with as many (`Selector`).
 */
export function locationWithMost(token: TokenKind): PickedCard {
  return {
    ref: 'pick',
    among: eachInPlay({ typeCode: 'location' }),
    attachable: true,
    best: { measure: { kind: 'tokens', token }, extreme: 'most' },
    chooser: 'lead',
  };
}

/**
 * "The nearest location without a copy of [this card] attached": the lead investigator picks
 * among those equally near (`Selector`), written `attachTo(nearestLocation())` (Fire!).
 */
export function nearestLocation(): PickedCard {
  return {
    ref: 'pick',
    among: eachInPlay({ typeCode: 'location' }),
    attachable: true,
    best: NEAREST,
    chooser: 'lead',
  };
}

/**
 * "This location" on a card attached to a location (`selfLocation`): "each investigator at this
 * location", written `takeDamage(1, eachInvestigator({ at: thisLocation() }))` (Fire!).
 */
export function thisLocation(): RelativeCard {
  return { ref: 'selfLocation' };
}

/**
 * "If there is no such location, …": `ability` fires only while `ref` stands for
 * nothing as its window opens, written
 * `ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge()))` (Locked Door).
 */
export function ifNoCandidate(ref: PickedRef, ability: Ability): Ability {
  return { ...ability, condition: { kind: 'countOf', of: ref, max: 0 } };
}

/**
 * "Attach it to your location": the card with the ability attaches to the
 * location of the investigator the window names, within its limit per
 * location (`{ ref: 'windowLocation' }`).
 */
export function attachToLocation(): AbilityEffect {
  return move(self(), attachedTo(yourLocation()));
}

/** "Discard it": the card with the ability, onto the top of the encounter discard (`discard`). */
export function discardSelf(): AbilityEffect {
  return discard({ ref: 'self' });
}

/**
 * "Discard [card]": a `MoveCard` onto the top of the encounter discard, where "topmost" effects
 * look for it. A card leaving play leaves its tokens and attachments behind, and a player card
 * goes back to its owner instead (`handleMoveCard`).
 */
export function discard(card: RelativeCard): AbilityEffect {
  return move(card, encounterDiscard, 'top');
}

/**
 * "Take N damage": the investigator the window names takes `amount` damage,
 * or `who` does ("each investigator at its location takes 1 damage"). A `TakeDamageAndHorror`
 * with no horror; for an investigator's ID it is a plain command (`takeDamage(2, alice)`).
 */
export function takeDamage(amount: number, who: InvestigatorId): TakeDamageAndHorror;
export function takeDamage(amount: number, who?: RelativeInvestigator): AbilityEffect;
export function takeDamage(
  amount: number,
  who: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): Wounds {
  return wounds({ damage: amount, horror: 0 }, who);
}

/**
 * "Place N of your clues on your location" (False Lead): a `MoveTokens` from the investigator to
 * the location they are at, as many as they have; none without a location.
 */
export function placeYourClues(amount: number, who: InvestigatorId): MoveTokens;
export function placeYourClues(amount: number, who?: RelativeInvestigator): AbilityEffect;
export function placeYourClues(
  amount: number,
  who: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): TokenMove {
  return tokenMove('clue', amount, { investigator: who }, { locationOf: who });
}

/**
 * `command` with `source`, and so each command in the options of a choice it asks, so the notice
 * of a deferred one names the card that asked and one the players also send does what it can
 * instead of refusing (`AskedByCard`).
 */
export function withSource<C extends { readonly type: string }>(
  command: C,
  source: CommandSource,
): C {
  if (command.type !== 'RequestDecision') return { ...command, source };
  // Narrowing on `type` doesn't reach a generic `C`; the type says it is a `RequestDecision`.
  const { decision } = command as unknown as RequestDecision;
  const options = decision.options.map((option) => ({
    ...option,
    commands: option.commands.map((inner) => withSource(inner, source)),
  }));
  return { ...command, source, decision: { ...decision, options } };
}

/**
 * "Take 1 horror and 1 damage": both at once (`TakeDamageAndHorror`), so a
 * defeat by one does not lose the other, written
 * `takeDamageAndHorror({ damage: 1, horror: 1 })` (On Wings of Darkness); for an
 * investigator's ID it is a plain command.
 */
export function takeDamageAndHorror(
  amounts: WoundAmounts,
  who: InvestigatorId,
): TakeDamageAndHorror;
export function takeDamageAndHorror(
  amounts: WoundAmounts,
  who?: RelativeInvestigator,
): AbilityEffect;
export function takeDamageAndHorror(
  amounts: WoundAmounts,
  who: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): Wounds {
  return wounds(amounts, who);
}

/** The damage and horror one effect deals: `TakeDamageAndHorror`'s amounts. */
type WoundAmounts = Pick<TakeDamageAndHorror, 'damage' | 'horror'>;

/**
 * What the wound factories return: a `TakeDamageAndHorror` for an investigator's ID, an
 * `AbilityEffect` for a reference; their overloads give callers the one they asked for.
 */
type Wounds = TakeDamageAndHorror & AbilityEffect;

/** The one command for an investigator's wounds (ME.9d): plain damage or horror is the other at 0. */
function wounds(amounts: WoundAmounts, who: InvestigatorId | RelativeInvestigator): Wounds {
  // One literal for both shapes, as in `tokenMove`.
  return { type: 'TakeDamageAndHorror', investigatorId: who, ...amounts } as Wounds;
}

/** "Heal N damage" or "heal N horror" (St. Mary's Hospital, Arkham Asylum): as much as there is. */
export function heal(
  stat: WoundKind,
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'HealInvestigator', investigatorId: who, stat, amount };
}

/** "Draw the top card of the Cultist deck" (Uncovering the Conspiracy). */
export function drawFromScenarioDeck(
  deck: ScenarioDeck,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DrawCard', investigatorId: who, from: scenarioDeck(deck) };
}

/**
 * "Draw the facedown card beneath your location" (Augurs of Flame): Smoke and Mirrors deals only
 * facedown cards beneath its locations, so the top one is the facedown card.
 */
export function drawBeneathYourLocation(
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DrawCard', investigatorId: who, from: beneath(yourLocation()) };
}

/** "Draw N cards" (Your House, Southside's Historical Society). */
export function drawCards(
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DrawCards', investigatorId: who, amount };
}

/**
 * "Discard N cards at random from your hand", of `who` ("each investigator discards 1 card at
 * random", What's Going On?!).
 */
export function discardAtRandom(
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DiscardFromHand', investigatorId: who, amount, atRandom: true };
}

/**
 * "Choose and discard N cards from your hand", of `who` (Science Hall): the player picks which, so
 * it is left to the players like `DrawCards`.
 */
export function discardFromHand(
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DiscardFromHand', investigatorId: who, amount };
}

/** "Choose and discard 1 asset you control" (Crypt Chill). */
export function discardAsset(
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DiscardAsset', investigatorId: who };
}

/**
 * A search of the investigator's deck for a card with one of `traits`, taken into hand before the
 * deck is shuffled (Ma's Boarding House, Miskatonic University), of only the `top` cards when the
 * card says so.
 */
export function searchDeck(
  traits: readonly Trait[],
  { top, play }: { top?: number; play?: true } = {},
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return {
    type: 'SearchDeck',
    investigatorId: who,
    traits,
    ...(top === undefined ? {} : { top }),
    ...(play === undefined ? {} : { play }),
  };
}

/**
 * "([codex] N)": the investigator the window names reads entry `entry` of the scenario's codex in
 * the campaign guide (`ReadCodexEntry`), left to the players.
 */
export function codex(
  entry: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'ReadCodexEntry', investigatorId: who, entry: codexEntry(entry) };
}

/**
 * "Heal N horror from an [[Ally]] asset at this location" (`HealAsset`), left to the players:
 * `healAsset('horror', 1, trait('Ally'))`.
 */
export function healAsset(
  stat: WoundKind,
  amount: number,
  assetTrait: Trait,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'HealAsset', investigatorId: who, stat, amount, trait: assetTrait };
}

/** "Gain N clues from the token pool" (Northside): a `MoveTokens` from the pool. */
export function gainClues(amount: number, who: InvestigatorId): MoveTokens;
export function gainClues(amount: number, who?: RelativeInvestigator): AbilityEffect;
export function gainClues(
  amount: number,
  who: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): TokenMove {
  return tokenMove('clue', amount, 'pool', { investigator: who });
}

/**
 * "Discover 1 clue at your location" (`DiscoverClues`: the window's location, else the location of
 * the investigator it names), or at another location ("discover 1 clue
 * at a [[Central]] location", `discoverClues(1, locationWith({ trait: trait('Central') }))`): as many as the
 * location has, none for an investigator who may not discover clues, unlike `gainClues`, which
 * takes them from the token pool.
 */
export function discoverClues(
  amount: number,
  location: RelativeCard = { ref: 'windowLocation' },
): AbilityEffect {
  return {
    type: 'DiscoverClues',
    investigatorId: { ref: 'windowInvestigator' },
    locationId: location,
    amount,
  };
}

/**
 * "Lose 1 action" or "lose all remaining actions" (`AdjustActions`): no more than remain, none
 * once they are gone; outside the turn they come off this round's actions.
 */
export function loseActions(amount: number | 'all'): AbilityEffect {
  return {
    type: 'AdjustActions',
    investigatorId: { ref: 'windowInvestigator' },
    delta: amount === 'all' ? 'allRemaining' : -amount,
  };
}

/** "End your turn" (`EndTurn`): does nothing outside the turn of the investigator the window names. */
export function endYourTurn(): AbilityEffect {
  return { type: 'EndTurn', investigatorId: { ref: 'windowInvestigator' } };
}

/**
 * "Gain N resources" (First Bank of Arkham): a `MoveTokens` from the pool. The basic resource
 * action is `GainResources`, which provokes attacks of opportunity.
 */
export function gainResources(amount: number, who: InvestigatorId): MoveTokens;
export function gainResources(amount: number, who?: RelativeInvestigator): AbilityEffect;
export function gainResources(
  amount: number,
  who: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): TokenMove {
  return tokenMove('resource', amount, 'pool', { investigator: who });
}

/** "Take N horror", like `takeDamage` (no damage; an ID gives a plain command): Goat Spawn is `whenDefeated(takeHorror(1, eachInvestigator({ at: itsLocation() })))`. */
export function takeHorror(amount: number, who: InvestigatorId): TakeDamageAndHorror;
export function takeHorror(amount: number, who?: RelativeInvestigator): AbilityEffect;
export function takeHorror(
  amount: number,
  who: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): Wounds {
  return wounds({ damage: 0, horror: amount }, who);
}

/**
 * "Each [unengaged] [[trait]] enemy [at a location] [engaged with you]" (`eachEnemy`), which
 * repeats the effect for each, written `eachEnemy({ trait: trait('Ghoul'), unengaged: true })`,
 * `eachEnemy({ at: itsLocation() })` or `eachEnemy({ engagedWith: you() })`.
 */
export function eachEnemy(
  filter: EachEnemyFilter = {},
): Extract<RelativeCard, { ref: 'eachEnemy' }> {
  return { ref: 'eachEnemy', ...filter };
}

/** "The lead investigator" (`lead`). */
export function lead(): RelativeInvestigator {
  return { ref: 'lead' };
}

/** "This card", "it": the card that has the ability (`self`). */
export function self(): RelativeCard {
  return { ref: 'self' };
}

/**
 * "It", "that enemy": the card this repetition of a `forEach` ability is for (`thatCard`), written
 * `forEachEnemy({}, atEndOfRound(placeDoomOn(thatCard(), 1)))` for "for each enemy, place 1 doom on it".
 */
export function thatCard(): RelativeCard {
  return { ref: 'thatCard' };
}

/**
 * Each card in play `filter` matches (`eachInPlay`), only those at the locations `at` names when
 * given: `eachInPlay({ code: codes.litaChantler, at: yourLocation() })`.
 */
export function eachInPlay(filter: Omit<EachInPlayRef, 'ref'> = {}): EachInPlayRef {
  return { ref: 'eachInPlay', ...filter };
}

/** "You": the investigator the window names (`windowInvestigator`), such as the drawer. */
export function you(): RelativeInvestigator {
  return { ref: 'windowInvestigator' };
}

/** "Your location": the location the window names, or the one of the investigator it names (`windowLocation`). */
export function yourLocation(): RelativeCard {
  return { ref: 'windowLocation' };
}

/**
 * "Disengage from each non-[[Nightgaunt]] enemy engaged with you": each enemy
 * `filter` matches that is engaged with the investigator the window names
 * disengages (`DisengageEnemy`), written
 * `disengageFromEachEnemy({ withoutTrait: trait('Nightgaunt') })`.
 */
export function disengageFromEachEnemy(filter: EnemyFilter = {}): AbilityEffect {
  return { type: 'DisengageEnemy', enemyId: eachEnemy({ ...filter, engagedWith: you() }) };
}

/**
 * The rule that a ready, unengaged enemy at an investigator's location engages
 * them (`EngageReadyEnemies`), checked once the effects before it are done:
 * an enemy On Wings of Darkness disengages engages whoever is still there
 * after the drawer moved away.
 */
export function engageReadyEnemies(): AbilityEffect {
  return { type: 'EngageReadyEnemies' };
}

/**
 * "A [[Central]] location" other than your location, as moving there would be no move: the
 * investigator the window names picks one (`Selector`), written
 * `moveTo(locationWith({ trait: trait('Central') }))`.
 */
export function locationWith({ connected, ...filter }: LocationFilter = {}): PickedCard {
  const connecting = connected === undefined ? {} : { connectedTo: yourLocation() };
  return {
    ref: 'pick',
    among: eachInPlay({ ...filter, typeCode: 'location', ...connecting }),
    except: yourLocation(),
    chooser: 'you',
  };
}

/**
 * "Move to a connecting location": the investigator the window names moves to a location
 * connecting to theirs, picking one when there are several (`locationWith({ connected: true })`).
 */
export function moveToConnectingLocation(): AbilityEffect {
  return moveTo(locationWith({ connected: true }));
}

/**
 * "An enemy at your location", "a [[Cultist]] enemy with no doom on it" (`anEnemy`), picked by
 * the investigator the window names when several match:
 * `dealDamageTo(anEnemy({ at: yourLocation() }), perInvestigator(1))` (Blaze of Glory),
 * `placeDoomOn(anEnemy({ trait: trait('Cultist'), withoutToken: 'doom' }), 1)` (Blasphemous
 * Invocation).
 */
export function anEnemy(filter: { at?: RelativeCard } & EnemyFilter = {}): PickedCard {
  return { ref: 'pick', among: eachEnemy(filter), chooser: 'you' };
}

/**
 * "[Enemy] moves 1 location towards [location]" (`MoveEnemyTowards`), written
 * `moveEnemyTowards(eachEnemy({ trait: trait('Ghoul'), unengaged: true }), onlyCopy(codes.parlor))`.
 * With `forced`, an engaged enemy disengages and moves too ("Forced – When the round ends: each
 * [[Cultist]] enemy moves once toward Underground Cistern"); with `attacksIfItEngages`, an enemy
 * that engages an investigator where it arrives attacks them (Aerial Pursuit).
 */
export function moveEnemyTowards(
  enemy: RelativeCard,
  location: RelativeCard,
  options: { forced?: true; attacksIfItEngages?: true } = {},
): AbilityEffect {
  return {
    type: 'MoveEnemyTowards',
    enemyId: enemy,
    towards: location,
    ...(options.forced === true ? { forced: true } : {}),
    ...(options.attacksIfItEngages === true ? { attacksIfItEngages: true } : {}),
  };
}

/** "Lose N resources": a `MoveTokens` back to the pool (Rogue Gangster). */
export function loseResources(
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return tokenMove('resource', amount, { investigator: who }, 'pool');
}

/**
 * "Each investigator [at a location]" (`eachInvestigator`), which repeats the effect for each, in
 * player order: `takeHorror(1, eachInvestigator({ at: itsLocation() }))`.
 */
export function eachInvestigator(
  filter: { at?: RelativeCard } = {},
): Extract<RelativeInvestigator, { ref: 'eachInvestigator' }> {
  return { ref: 'eachInvestigator', ...filter };
}

/**
 * "An investigator [at a location]" (`anInvestigator`), picked by the investigator the window
 * names when several stand there: `heal('horror', 1, anInvestigator({ at: thisLocation() }))`.
 */
export function anInvestigator(
  filter: { at?: RelativeCard } = {},
): Extract<RelativeInvestigator, { ref: 'pick' }> {
  return { ref: 'pick', among: eachInvestigator(filter), chooser: 'you' };
}

/** "Its location": the location the window names (`windowLocation`), such as where a defeated enemy was. */
export function itsLocation(): RelativeCard {
  return { ref: 'windowLocation' };
}

/** "Spend N clues": the investigator the window names returns `amount` clues to the token bank. */
export function spendClues(amount: number): AbilityEffect {
  return {
    type: 'AdjustInvestigator',
    investigatorId: { ref: 'windowInvestigator' },
    stat: 'clues',
    delta: -amount,
  };
}

/** "Move to Rivertown": the investigator the window names goes straight there, as card effects move. */
export function moveTo(location: RelativeCard): AbilityEffect {
  return {
    type: 'MoveInvestigator',
    investigatorId: { ref: 'windowInvestigator' },
    to: location,
    ignoreConnections: true,
  };
}

/**
 * "Add 1 [token] token to the chaos bag": until the end of the scenario, or for the rest of the
 * campaign ("permanently", `lasts: 'campaign'`).
 */
export function addChaosToken(
  token: ChaosToken,
  lasts: ChaosBagChangeLasts,
): ChangeChaosBag & AbilityEffect {
  return { type: 'ChangeChaosBag', token, change: 'add', lasts };
}

/** "Remove 1 [token] token from the chaos bag", for the scenario or for the rest of the campaign. */
export function removeChaosToken(
  token: ChaosToken,
  lasts: ChaosBagChangeLasts,
): ChangeChaosBag & AbilityEffect {
  return { type: 'ChangeChaosBag', token, change: 'remove', lasts };
}

/**
 * "Investigators in the Hallway may, as a group, spend the requisite number of clues" (The
 * Barrier): those at `location` pay `amount` together, written
 * `spendCluesAsGroup(perInvestigator(3), onlyCopy(codes.hallway))`; without a location, the
 * investigators anywhere do.
 */
function spendCluesAsGroup(amount: ScaledValue, location?: RelativeCard): AbilityEffect {
  return { type: 'SpendCluesAsGroup', amount, ...(location && { locationId: location }) };
}

/**
 * "When the round ends, investigators in the Hallway may, as a group, spend the requisite number
 * of clues to advance" (The Barrier): at the end of each round, once those at `location` hold
 * `clues`, the lead decides for the group (`decision`) whether they spend them and advance the act.
 * Without a location ("Where There's Smoke…") every investigator's clues count.
 */
export function advanceBySpendingCluesAtRoundEnd(
  decision: DecisionId,
  clues: ScaledValue,
  location?: CardCode,
): Ability {
  return {
    window: { on: 'roundEnds' },
    condition: { kind: 'valueOf', value: { kind: 'groupClues', location }, min: clues },
    effects: [
      leadDecides(decision, 'decision.spendCluesAtRoundEnd', [
        {
          id: 'spend',
          label: 'decision.spendClues',
          effects: [spendCluesAsGroup(clues, location && onlyCopy(location)), advanceAct()],
        },
        { id: 'keep', label: 'decision.keepClues', effects: [] },
      ]),
    ],
  };
}

/**
 * A token move that is a plain command and card data at once: the token factories below build
 * both, a plain `MoveTokens` from instances (the UI, tests) and an `AbilityEffect` from
 * references (card data), and their overloads say which comes back for which arguments.
 */
type TokenMove = MoveTokens & AbilityEffect;

/** A `TokenHolder` as a plain command or card data names it: by instance or by reference. */
type AnyTokenHolder =
  | Exclude<TokenHolder, object>
  | { card: InstanceId | RelativeCard }
  | { investigator: InvestigatorId | RelativeInvestigator }
  | { locationOf: InvestigatorId | RelativeInvestigator };

function tokenMove(
  token: TokenKind,
  amount: TokenMoveAmount,
  from: AnyTokenHolder,
  to: AnyTokenHolder,
): TokenMove {
  // One literal for both shapes; each factory's overloads give the caller its precise type.
  return { type: 'MoveTokens', token, amount, from, to } as TokenMove;
}

/** "Place N doom on the current agenda": doom from the token pool (`MoveTokens`). */
export function placeDoomOnAgenda(amount: number): TokenMove {
  return tokenMove('doom', amount, 'pool', 'currentAgenda');
}

/**
 * "This effect can cause the current agenda to advance" (Ancient Evils): checks the doom
 * threshold right away, as the mythos phase does in step 1.3, after the doom an effect placed.
 */
export function checkDoomThreshold(): AbilityEffect {
  return { type: 'CheckDoomThreshold' };
}

/** "Place N doom on [card]", such as `placeDoomOn(nearestEnemy({ trait: trait('Cultist') }), 2)`. */
export function placeDoomOn(card: InstanceId, amount: number): MoveTokens;
export function placeDoomOn(card: RelativeCard, amount: number): AbilityEffect;
export function placeDoomOn(card: InstanceId | RelativeCard, amount: number): TokenMove {
  return tokenMove('doom', amount, 'pool', { card });
}

/**
 * "The nearest [[trait]] enemy": the lead investigator picks among those equally near
 * (`Selector`), written `nearestEnemy({ trait: trait('Cultist') })`.
 */
export function nearestEnemy(filter: EnemyFilter = {}): PickedCard {
  return { ref: 'pick', among: eachEnemy(filter), best: NEAREST, chooser: 'lead' };
}

/**
 * Each card in `zone` (or in each of a list of zones) that `filter` matches (`eachInZone`), which
 * repeats the effect for each: `eachInZone(setAside, { trait, typeCode: 'enemy' })` for
 * "each set-aside [[trait]] enemy", `eachInZone(encounterDeck, { top: 3 })` for "the top 3 cards
 * of the encounter deck".
 */
export function eachInZone(
  zone: Templated<Zone> | readonly Templated<Zone>[],
  filter: CardFilter & { top?: number; first?: ScaledValue } = {},
): Extract<RelativeCard, { ref: 'eachInZone' }> {
  return { ref: 'eachInZone', zone, ...filter };
}

/**
 * "Place N doom on an asset you control" (Unnatural Decay): the game holds no player cards, so the
 * doom goes on the investigator the window names as doom on their player cards
 * (`doomOnPlayerCards`), which counts toward the doom threshold; which asset holds it is theirs.
 */
export function placeDoomOnYourAsset(amount: number): AbilityEffect {
  return {
    type: 'AdjustInvestigator',
    investigatorId: { ref: 'windowInvestigator' },
    stat: 'doomOnPlayerCards',
    delta: amount,
  };
}

/** "Place N doom on it": doom on the card with the ability. */
export function placeDoomOnSelf(amount: number): AbilityEffect {
  return placeDoomOn({ ref: 'self' }, amount);
}

/**
 * "Remove N doom from the current agenda", or `'all'` of it, back to the token pool
 * (`MoveTokens`); as much as there is.
 */
export function removeDoomFromAgenda(amount: number | 'all'): TokenMove {
  return tokenMove('doom', amount, 'currentAgenda', 'pool');
}

/**
 * "Remove all doom from it" or "remove 1 doom from each [[Cultist]] enemy" (`MoveTokens`
 * to the pool): `removeDoomFrom(eachEnemy({ trait: trait('Cultist') }), 1)`, as much as each card
 * holds.
 */
export function removeDoomFrom(card: InstanceId, amount: number | 'all'): MoveTokens;
export function removeDoomFrom(card: RelativeCard, amount: number | 'all'): AbilityEffect;
export function removeDoomFrom(card: InstanceId | RelativeCard, amount: number | 'all'): TokenMove {
  return tokenMove('doom', amount, { card }, 'pool');
}

/**
 * "Move all doom from each [[Cultist]] enemy to the current agenda" or "move all damage on that
 * enemy to Mother" (`MoveTokens`): `amount` tokens, or `'all'`, from `from` to `to`, by default
 * the current agenda, as many as each card holds:
 * `moveTokens('doom', 'all', eachEnemy({ trait: trait('Cultist') }))`.
 */
export function moveTokens(
  token: TokenKind,
  amount: number | 'all',
  from: InstanceId,
  to?: InstanceId,
): MoveTokens;
export function moveTokens(
  token: TokenKind,
  amount: number | 'all',
  from: RelativeCard,
  to?: RelativeCard,
): AbilityEffect;
export function moveTokens(
  token: TokenKind,
  amount: number | 'all',
  from: InstanceId | RelativeCard,
  to?: InstanceId | RelativeCard,
): TokenMove {
  return tokenMove(
    token,
    amount,
    { card: from },
    to === undefined ? 'currentAgenda' : { card: to },
  );
}

/**
 * "Take control of 1 of the clues on Constance Dumaine" (`MoveTokens`): clues from `from` to
 * `investigator`, by default the one the window names; as many as the card holds.
 */
export function takeCluesFrom(
  from: InstanceId,
  amount: number | 'all',
  investigator: InvestigatorId,
): MoveTokens;
export function takeCluesFrom(
  from: RelativeCard,
  amount: number | 'all',
  investigator?: RelativeInvestigator,
): AbilityEffect;
export function takeCluesFrom(
  from: InstanceId | RelativeCard,
  amount: number | 'all',
  investigator: InvestigatorId | RelativeInvestigator = { ref: 'windowInvestigator' },
): TokenMove {
  return tokenMove('clue', amount, { card: from }, { investigator });
}

/** "Place N clues on this act": clues from the token pool on the card with the ability. */
export function placeCluesOnSelf(amount: TokenAmount): AbilityEffect {
  return placeCluesOn({ ref: 'self' }, amount);
}

/**
 * "Add clues to it until it has 2 clues per investigator on it": clues from the token pool on the
 * card with the ability, up to `upTo`, written `placeCluesOnSelfUpTo(perInvestigator(2))` (Ritual
 * Site); none when it has as many already, which is also its "if there are fewer than".
 */
export function placeCluesOnSelfUpTo(upTo: TokenAmount): AbilityEffect {
  return placeCluesOn({ ref: 'self' }, { upTo });
}

/**
 * "Place 3 [per_investigator] clues on Miskatonic Quad": clues from the token pool on `card`, or
 * as many as bring it up to a count (`{ upTo }`).
 */
export function placeCluesOn(
  card: InstanceId,
  amount: TokenAmount | { upTo: TokenAmount },
): MoveTokens;
export function placeCluesOn(
  card: RelativeCard,
  amount: TokenAmount | { upTo: TokenAmount },
): AbilityEffect;
export function placeCluesOn(
  card: InstanceId | RelativeCard,
  amount: TokenAmount | { upTo: TokenAmount },
): TokenMove {
  return tokenMove('clue', amount, 'pool', { card });
}

/** Heals up to `amount` damage from the enemy that has the ability ("heal 2 damage from it"). */
export function healSelf(amount: number): AbilityEffect {
  return { type: 'HealEnemy', enemyId: { ref: 'self' }, amount };
}

/** Readies the enemy that has the ability ("ready Umôrdhoth"). */
export function readySelf(): AbilityEffect {
  return readyEnemy({ ref: 'self' });
}

/**
 * "Deal 1 damage to it / to each [[Monster]] enemy" (`DamageEnemy`): an enemy
 * the damage brings to its health is defeated in the same step, so its
 * `defeated` abilities fire. Written `dealDamageTo(eachEnemy({ trait: trait('Monster') }), 1)`.
 */
export function dealDamageTo(enemy: InstanceId, amount: TokenAmount): DamageEnemy;
export function dealDamageTo(enemy: RelativeCard, amount: TokenAmount): AbilityEffect;
export function dealDamageTo(
  enemy: InstanceId | RelativeCard,
  amount: TokenAmount,
): DamageEnemy & AbilityEffect {
  return { type: 'DamageEnemy', enemyId: enemy, amount } as DamageEnemy & AbilityEffect;
}

/** "Heal N damage from it" (`HealEnemy`): as much as it has. */
export function healEnemy(enemy: InstanceId, amount: number): HealEnemy;
export function healEnemy(enemy: RelativeCard, amount: number): AbilityEffect;
export function healEnemy(
  enemy: InstanceId | RelativeCard,
  amount: number,
): HealEnemy & AbilityEffect {
  return { type: 'HealEnemy', enemyId: enemy, amount } as HealEnemy & AbilityEffect;
}

/** "Ready it" (`ReadyEnemy`); an enemy that is ready already stays as it is. */
export function readyEnemy(enemy: InstanceId): ReadyEnemy;
export function readyEnemy(enemy: RelativeCard): AbilityEffect;
export function readyEnemy(enemy: InstanceId | RelativeCard): ReadyEnemy & AbilityEffect {
  return { type: 'ReadyEnemy', enemyId: enemy } as ReadyEnemy & AbilityEffect;
}

/** "Disengage it" (`DisengageEnemy`): it stays where it is, unengaged. */
export function disengageEnemy(enemy: InstanceId): DisengageEnemy;
export function disengageEnemy(enemy: RelativeCard): AbilityEffect;
export function disengageEnemy(enemy: InstanceId | RelativeCard): DisengageEnemy & AbilityEffect {
  return { type: 'DisengageEnemy', enemyId: enemy } as DisengageEnemy & AbilityEffect;
}

/**
 * The elusive retreat (`RetreatEnemy`): disengage, move to a connecting location (one without
 * investigators if able) and exhaust.
 */
export function retreatEnemy(enemy: RelativeCard): AbilityEffect {
  return { type: 'RetreatEnemy', enemyId: enemy };
}

/**
 * "Exhaust it / each enemy at your location" (`ExhaustEnemy`); an enemy that
 * is exhausted already stays as it is.
 */
export function exhaustEnemy(enemy: InstanceId): ExhaustEnemy;
export function exhaustEnemy(enemy: RelativeCard): AbilityEffect;
export function exhaustEnemy(enemy: InstanceId | RelativeCard): ExhaustEnemy & AbilityEffect {
  return { type: 'ExhaustEnemy', enemyId: enemy } as ExhaustEnemy & AbilityEffect;
}

/**
 * "Defeat it" or "it is automatically defeated" (`DefeatEnemy`): defeated
 * without damage, to the victory display or the encounter discard as usual.
 */
export function defeatEnemy(enemy: InstanceId): DefeatEnemy;
export function defeatEnemy(enemy: RelativeCard): AbilityEffect;
export function defeatEnemy(enemy: InstanceId | RelativeCard): DefeatEnemy & AbilityEffect {
  return { type: 'DefeatEnemy', enemyId: enemy } as DefeatEnemy & AbilityEffect;
}

/**
 * "It engages you" (`EngageEnemy`): from any location, into the investigator's threat area; a
 * massive enemy or one engaged with them already stays as it is.
 */
export function engagesYou(
  enemy: RelativeCard = { ref: 'self' },
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'EngageEnemy', enemyId: enemy, investigatorId: who };
}

/**
 * "It attacks you" (`EnemyAttacks`): the players confirm the printed damage and horror, less what
 * their assets soak, or cancel the attack. "Readies and attacks each investigator at its location"
 * is `readySelf()` followed by `enemyAttacks({ ref: 'self' }, eachInvestigator({ at: itsLocation() }))`.
 */
export function enemyAttacks(
  enemy: RelativeCard = { ref: 'self' },
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
  kind?: KeywordAttackKind,
): AbilityEffect {
  return { type: 'EnemyAttacks', enemyId: enemy, investigatorId: who, ...(kind && { kind }) };
}

/** The one copy of `code` in the game, for a scenario's unique cards (`{ ref: 'onlyCopy' }`). */
export function onlyCopy(code: CardCode): RelativeCard {
  return { ref: 'onlyCopy', code };
}

/**
 * "Put the house into play": the map `step` declares, as setup would, with
 * each of its locations the only copy of its code (typically set aside),
 * then a reveal for each face-up one, since revealing places its clues.
 * Spread it into the ability: `whenAdvanced(...putMapIntoPlay(house), …)`.
 */
export function putMapIntoPlay(step: AddMapStep): AbilityEffect[] {
  const addMap: AbilityEffect = {
    type: 'AddMap',
    mapId: step.mapId,
    map: {
      name: step.name,
      visible: step.visible ?? true,
      connections: (step.connections ?? []).map(({ from, to, oneWay }) => ({
        from: onlyCopy(from),
        to: onlyCopy(to),
        oneWay: oneWay ?? false,
      })),
    },
    locations: step.locations.map(({ code, at }) => ({ id: onlyCopy(code), at })),
  };
  const reveals = step.locations
    .filter(({ faceUp }) => faceUp === true)
    .map(({ code }) => revealLocation(onlyCopy(code)));
  return [addMap, ...reveals];
}

/** "Each investigator moves to the Hallway", ignoring connections as card effects do. */
export function moveEachInvestigatorTo(location: RelativeCard): AbilityEffect {
  return {
    type: 'MoveInvestigator',
    investigatorId: { ref: 'eachInvestigator' },
    to: location,
    ignoreConnections: true,
  };
}

/** "Discard each enemy in the Study", engaged ones included (`discard` each). */
export function discardEachEnemyAt(location: RelativeCard): AbilityEffect {
  return discardEachEnemy({ at: location });
}

/**
 * "Discard each enemy in play", engaged ones included (`discard` each), or each one `filter`
 * matches: `discardEachEnemy({ ready: true, trait: trait('Cultist'), at: thisLocation() })`.
 */
export function discardEachEnemy(filter: EachEnemyFilter = {}): AbilityEffect {
  return discard(eachEnemy(filter));
}

/** "Advance": the current act advances without spending clues, as an objective does. */
export function advanceAct(): Advance & AbilityEffect {
  return { type: 'Advance', deck: 'act' };
}

/**
 * "Advance the current agenda" (`Advance`), as its doom threshold would: its doom and all
 * other doom in play are removed and its reverse side resolves.
 */
export function advanceAgenda(): AbilityEffect {
  return { type: 'Advance', deck: 'agenda' };
}

/**
 * "[Location] is no longer connected to [location]" (`RemoveConnection`): removes the connection
 * the map declares or cuts the one the cards print, written
 * `removeConnection(onlyCopy(codes.hallway), onlyCopy(codes.parlor))`.
 */
export function removeConnection(from: RelativeCard, to: RelativeCard): AbilityEffect {
  return { type: 'RemoveConnection', from, to };
}

/** "Replace the current act and agenda with this card", on an agenda's reverse side (Vengeance Awaits). */
export function becomeActAndAgenda(): AbilityEffect {
  return { type: 'BecomeActAndAgenda' };
}

/**
 * "The next agenda replaces the current act and agenda", on an agenda's reverse side (Queen of
 * Ash, agenda 2): the agenda that follows becomes the act as well.
 */
export function nextAgendaBecomesActAndAgenda(): AbilityEffect {
  return { type: 'BecomeActAndAgenda', next: true };
}

/**
 * "Discard the top `count` cards of the encounter deck" (Out of This World): each is discarded
 * like any encounter card (`discard`), fewer when the deck holds fewer. The deck is not
 * refilled while the effect resolves (Smite the Wicked ruling): once its card is placed
 * (`placeDrawnCard`), or at the next draw, the empty deck takes the discard back.
 */
export function discardEncounterTop(count: number): AbilityEffect {
  return discard(eachInZone(encounterDeck, { top: count }));
}

/** "Shuffle the encounter discard pile into the encounter deck". */
export function shuffleEncounterDiscard(): AbilityEffect {
  return { type: 'ShuffleEncounterDiscard' };
}

/**
 * "Discard cards from the top of the encounter deck until a card that fits
 * `match` is discarded; the lead investigator draws it" (Rise of the Ghouls:
 * a Ghoul enemy). Nothing happens when no card in the deck fits, which is
 * what the table ends with when the discard was just shuffled into the deck,
 * as every such card does first.
 */
export function leadDrawsDiscardingUntil(match: CardFilter): AbilityEffect {
  return drawDiscardingUntil(match, { ref: 'lead' });
}

/**
 * "Discard cards from the top of the encounter deck until an enemy is discarded and draw it",
 * drawn by the investigator the window names, or `who`, as `leadDrawsDiscardingUntil` (Infested
 * Pipes: the investigator who entered).
 */
export function drawDiscardingUntil(
  match: CardFilter,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return {
    type: 'DrawCard',
    investigatorId: who,
    from: encounterDeck,
    pick: { match, discardSkipped: true },
  };
}

/**
 * "If it is act 3, …": `ability` fires only while the current act is one of
 * `acts`, written `duringAct([codes.whatHaveYouDone], whenAdvanced(…))`.
 */
export function duringAct(acts: readonly CardCode[], ability: Ability): Ability {
  return { ...ability, condition: { kind: 'currentCard', deck: 'act', codes: acts } };
}

/** "If it is agenda 2, …": `ability` fires only while the current agenda is one of `agendas`, like `duringAct`. */
export function duringAgenda(agendas: readonly CardCode[], ability: Ability): Ability {
  return { ...ability, condition: { kind: 'currentCard', deck: 'agenda', codes: agendas } };
}

/**
 * "… during the enemy phase": `ability` fires only while the game is in `phase`, written
 * `duringPhase('enemy', afterAttacking(discardAsset()))` (Hellhound). Like the other condition
 * wrappers it replaces a condition `ability` already has, so they don't nest.
 */
export function duringPhase(phase: Phase, ability: Ability): Ability {
  return { ...ability, condition: { kind: 'phase', phase } };
}

/**
 * "If you have no clues, …": `ability` fires only while the investigator its
 * window names has `stat` within `range`, written
 * `ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge()))` (False Lead).
 */
export function ifYouHave(stat: InvestigatorStat, range: StatRange, ability: Ability): Ability {
  return ifValue(statOf(you(), stat), range, ability);
}

/**
 * "If the lead investigator has no clues, …", "if there are no clues on it, …": `ability` fires
 * only while `value` is within `range`, written `ifValue(statOf(lead(), 'clues'), { max: 0 }, …)`
 * or `ifValue(tokensOn(self(), 'clue'), { max: 0 }, …)`. A stat of several investigators
 * (`eachInvestigator()`) holds only when each of them is in range; "any investigator" is a
 * `countOf` over `eachInvestigator` instead.
 */
export function ifValue(value: Quantity, range: StatRange, ability: Ability): Ability {
  return { ...ability, condition: { kind: 'valueOf', value, ...range } };
}

/**
 * "Whichever you have more of": `value` is at least `than`, written
 * `atLeast(statOf(you(), 'damage'), statOf(you(), 'horror'))` for a choice option's `when`
 * (Ashen Rebirth), so a tie offers both.
 */
export function atLeast(value: Quantity, than: Quantity): AbilityCondition {
  return { kind: 'atLeast', value, than };
}

/** A stat of the investigator or investigators `who` names, for `ifValue`. */
export function statOf(who: RelativeInvestigator, stat: InvestigatorStat): Quantity {
  return { kind: 'stat', stat, who };
}

/** The `token`s on the card or cards `on` names, for `ifValue`. */
export function tokensOn(on: RelativeCard, token: TokenKind): Quantity {
  return { kind: 'tokens', token, on };
}

/**
 * "If there is an enemy at your location, …", "if no enemy is engaged with you, …": `ability`
 * fires only while the number of cards or investigators the `each…` reference `of` names is
 * within `range`, written `ifThereAre(eachEnemy({ at: yourLocation() }), { min: 1 }, …)` or
 * `ifThereAre(eachEnemy({ engagedWith: you() }), { max: 0 }, …)`.
 */
export function ifThereAre(of: RepeatedRef, range: StatRange, ability: Ability): Ability {
  return { ...ability, condition: thereAre(of, range) };
}

/**
 * "There are N of these": the number of things `of` names is within `range` (`countOf`), as
 * `ifThereAre` puts it on an ability, or on its own for a resolution's question about the ended
 * game: `thereAre(eachInZone(victoryDisplay, { code }), { min: 1 })` for "if Herman Collins is in
 * the victory display".
 */
export function thereAre(of: RepeatedRef, range: StatRange): AbilityCondition {
  return { kind: 'countOf', of, ...range };
}

/**
 * "For each [[Ghoul]] enemy in the Hallway or Parlor, …": `ability`'s effects
 * resolve once per enemy `filter` matches as its window opens, written
 * `forEachEnemy({ trait: trait('Ghoul'), at: [codes.hallway, codes.parlor] }, atEndOfRound(placeDoomOnSelf(1)))`
 * (They're Getting Out!).
 */
export function forEachEnemy(filter: EachEnemyFilter, ability: Ability): Ability {
  return { ...ability, forEach: eachEnemy(filter) };
}

/**
 * "Each investigator must test [willpower] (4). Each investigator who fails takes 1 direct
 * horror": `ability`'s effects resolve once for each active investigator, naming them, written
 * `forEachInvestigator(whenAdvanced(skillTest('willpower', 4, { onFail: [takeHorror(1)] })))`.
 */
export function forEachInvestigator(ability: Ability): Ability {
  return { ...ability, forEach: eachInvestigator() };
}

/**
 * "Draws the topmost copy of Fire! in the encounter discard pile": `who` draws the first card of
 * the discard, top down, that fits `match` (`DrawCard` from the discard); nothing when none does.
 */
export function drawFromEncounterDiscard(
  match: CardFilter,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'DrawCard', investigatorId: who, from: encounterDiscard, pick: { match } };
}

/**
 * "The lead investigator must search the encounter deck and discard pile for 1 [per_investigator]
 * copies of Fire! and draw them" (Searching for Dr. Armitage): one search finds up to `copies`
 * cards with `code`, deck first, and `who` draws each of them in turn (`DrawCard` with a `card`
 * pick), so a copy found once is drawn once even if its revelation sends it back to the
 * discard. "Shuffle the encounter deck" afterwards is a `shuffleEncounterDeck()` of its own,
 * which runs after the draws: the same as the rules' shuffle "upon completion of the search" while
 * the drawn cards draw nothing more from the deck (no surge). The lead would pick the copies; the
 * engine takes the first ones, deck first (#346).
 */
export function searchAndDrawCopies(
  code: CardCode,
  copies: ScaledValue,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return {
    type: 'DrawCard',
    investigatorId: who,
    from: [encounterDeck, encounterDiscard],
    pick: { card: eachInZone([encounterDeck, encounterDiscard], { code, first: copies }) },
  };
}

/**
 * "Search the encounter deck and discard pile for a [[Cultist]] enemy and
 * draw it": the investigator the window names draws the first card that
 * matches, deck first (`DrawCard` with `match`); nothing when none does.
 * The players would pick among the matches; the engine does not ask yet (#346).
 */
export function searchAndDraw(match: CardFilter): AbilityEffect {
  return {
    type: 'DrawCard',
    investigatorId: you(),
    from: [encounterDeck, encounterDiscard],
    pick: { match },
  };
}

/**
 * "Shuffle the set-aside [card] into the encounter deck": one set-aside copy of each code, a code
 * listed twice taking two, then the deck is shuffled once. The shuffle is a step of its own, so the
 * deck is shuffled even when no copy was left to add (`docs/rules/encounter-draws.md`).
 */
export function shuffleSetAsideIntoEncounterDeck(codes: readonly CardCode[]): AbilityEffect[] {
  return [...fromSetAside(codes, encounterDeck), shuffleEncounterDeck()];
}

/**
 * "Shuffle it into the encounter deck": the card with the ability goes into the deck, which is
 * then shuffled. A drawn card moved there while it resolves is not placed afterwards.
 */
export function shuffleSelfIntoEncounterDeck(): AbilityEffect[] {
  return [move(self(), encounterDeck), shuffleEncounterDeck()];
}

/** "Shuffle the encounter deck." */
export function shuffleEncounterDeck(): AbilityEffect {
  return { type: 'ShuffleEncounterDeck' };
}

/** "[This card] gains surge": the drawn card with the ability draws again once placed. */
export function gainSurge(): AbilityEffect {
  return { type: 'GainSurge', cardId: { ref: 'self' } };
}

/** "(→R3)": the scenario ends with that resolution. */
export function endScenario(resolution: ResolutionId): EndScenario & AbilityEffect {
  return { type: 'EndScenario', resolution };
}

/**
 * "Each investigator who has not resigned is defeated": all at once, so a
 * new lead is asked for only if somebody is left (`newLeadInvestigator`).
 * With `trauma`, "… and suffers 1 physical trauma": the campaign log gets it
 * with the resolution (`campaign.proposeResolution`).
 */
export function defeatEachInvestigator({ trauma }: { trauma?: TraumaKind } = {}): AbilityEffect {
  return {
    type: 'DefeatInvestigator',
    investigatorId: { ref: 'eachInvestigator' },
    ...(trauma === undefined ? {} : { trauma }),
  };
}

/** "Each investigator immediately resigns" (Emergent Evils' reverse side), in any phase. */
export function eachInvestigatorResigns(): AbilityEffect {
  return { type: 'Resign', investigatorId: { ref: 'eachInvestigator' }, immediately: true };
}

/** One answer of a choice in card data: its label and what it does once picked. */
export interface ChoiceOption {
  id: string;
  /** i18n key. A part the engine does not track (player cards) is in the label only, for the players. */
  label: string;
  /** The counts the decider enters as they pick it, which its effects read (`AskedCount`). */
  amounts?: DecisionOption['amounts'];
  /**
   * "Whichever you have more of": the option is offered only while this holds, read as the choice
   * is raised (after the test it follows). An option left alone applies without asking.
   */
  when?: AbilityCondition;
  effects: AbilityEffect[];
}

/**
 * "The lead investigator must decide (choose one)": a choice for the lead
 * with one option per answer, each running its effects once picked, written
 * `leadDecides(id, prompt, [{ id: 'burn', label, effects: [endScenario('R1')] }, …])`.
 */
export function leadDecides(
  id: DecisionId,
  prompt: string,
  options: readonly ChoiceOption[],
): AbilityEffect {
  return choice(id, prompt, { kind: 'lead' }, options);
}

/**
 * "You must either …": the same choice for the investigator the window names
 * (the drawer of a revelation), written
 * `youMustEither(id, prompt, [{ id: 'horror', label, effects: [takeHorror(2)] }, …])`.
 * A command on player cards in an option ("discard an asset", `discardAsset`) is
 * deferred to the players (`CommandDeferred`) once the option is picked.
 */
export function youMustEither(
  id: DecisionId,
  prompt: string,
  options: readonly ChoiceOption[],
): AbilityEffect {
  return choice(
    id,
    prompt,
    { kind: 'investigator', investigatorId: { ref: 'windowInvestigator' } },
    options,
  );
}

function choice(
  id: DecisionId,
  prompt: string,
  decider: Templated<AbilityChoice['decision']['decider']>,
  options: readonly ChoiceOption[],
): AbilityEffect {
  return {
    type: 'RequestDecision',
    decision: {
      id,
      kind: 'chooseOption',
      prompt,
      decider,
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.amounts ? { amounts: option.amounts } : {}),
        ...(option.when ? { when: option.when } : {}),
        commands: option.effects,
      })),
    },
  };
}

/** "Reveal the Parlor". */
export function revealLocation(location: InstanceId): RevealLocation;
export function revealLocation(location: RelativeCard): AbilityEffect;
export function revealLocation(
  location: InstanceId | RelativeCard,
): RevealLocation & AbilityEffect {
  return { type: 'RevealLocation', locationId: location } as RevealLocation & AbilityEffect;
}

/**
 * "Put the set-aside Ritual Site into play": the only copy of `code` joins the
 * map `mapId` already on the board, in layout cell `at`, connected to the only
 * copy of each of `connectedTo` (only for a connection no card prints; the
 * printed ones follow from the symbols). Spread it into the ability:
 * `whenAdvanced(...putLocationIntoPlay(ritualSite, woods, { at }))`.
 */
export function putLocationIntoPlay(
  code: CardCode,
  mapId: MapId,
  { at, connectedTo = [] }: { at?: GridCell; connectedTo?: readonly CardCode[] } = {},
): AbilityEffect[] {
  const location = onlyCopy(code);
  return [
    { type: 'PutLocationIntoPlay', locationId: location, mapId, ...(at && { at }) },
    ...connectedTo.map((other): AbilityEffect => ({
      type: 'AddConnection',
      mapId,
      from: onlyCopy(other),
      to: location,
    })),
  ];
}

/**
 * "Spawn each set-aside [[Cultist]] enemy at the Main Path": each set-aside
 * card with `trait` spawns at `location` (`SpawnEnemy`); nothing when none is
 * set aside.
 */
export function spawnEachSetAsideAt(trait: Trait, location: RelativeCard): AbilityEffect {
  return {
    type: 'SpawnEnemy',
    enemyId: eachInZone(setAside, { trait, typeCode: 'enemy' }),
    at: location,
  };
}

/**
 * "Attach 1 set-aside copy of Fire! to Your Friend's Room": one set-aside copy of each of `codes`
 * (a code listed twice takes two) moves to `to`, written
 * `...fromSetAside([codes.fire], attachedTo(onlyCopy(codes.yourFriendsRoom)))`.
 * One `MoveCard` per code, each resolving after the one before, so each takes a copy still set
 * aside; a code with none left moves nothing.
 */
export function fromSetAside(codes: readonly CardCode[], to: Templated<Zone>): AbilityEffect[] {
  return codes.map((code) => ({ type: 'MoveCard', cardId: setAsideCopy(code), to }));
}

/** A set-aside copy of `code` (`RelativeCard` `setAsideCopy`). */
export function setAsideCopy(code: CardCode): Extract<RelativeCard, { ref: 'setAsideCopy' }> {
  return { ref: 'setAsideCopy', code };
}

/**
 * "Spawn the Ghoul Priest in the Hallway": the enemy spawns at the location
 * named, engaging like any spawn (`SpawnEnemy`).
 */
export function spawnEnemyAt(enemy: InstanceId, location: InstanceId): SpawnEnemy;
export function spawnEnemyAt(enemy: RelativeCard, location: RelativeCard): AbilityEffect;
export function spawnEnemyAt(
  enemy: InstanceId | RelativeCard,
  location: InstanceId | RelativeCard,
): SpawnEnemy & AbilityEffect {
  return { type: 'SpawnEnemy', enemyId: enemy, at: location } as SpawnEnemy & AbilityEffect;
}

/**
 * Moves `card` (`MoveCard`) to the bottom of `to` or, with `'top'`, onto its top. Card data names
 * the zone with the zone helpers: "Remove the Study from the game" is
 * `move(onlyCopy(codes.study), outOfGame)`, "Add it to the victory display"
 * `move(self(), victoryDisplay)`, "Put the set-aside Lita Chantler into play at the Parlor"
 * `move(setAsideCopy(codes.litaChantler), atLocation(onlyCopy(codes.parlor)))`, "on top of the
 * encounter deck" `move(self(), encounterDeck, 'top')`. Only moves a rule gives a meaning of its
 * own keep a factory (`discard`, `putIntoThreatArea`, `attachTo`, `takeControl`, `fromSetAside`).
 */
export function move(card: InstanceId, to: Zone, end?: 'top' | 'bottom'): MoveCard;
export function move(
  card: RelativeCard,
  to: Templated<Zone>,
  end?: 'top' | 'bottom',
): AbilityEffect;
export function move(
  card: InstanceId | RelativeCard,
  to: Zone | Templated<Zone>,
  end: 'top' | 'bottom' = 'bottom',
): MoveCard & AbilityEffect {
  return {
    type: 'MoveCard',
    cardId: card,
    to,
    ...(end === 'top' && { index: 0 }),
  } as MoveCard & AbilityEffect;
}
