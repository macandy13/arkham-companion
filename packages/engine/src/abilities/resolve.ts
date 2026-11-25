import { assertNever, shallowEqual, sum, withoutKey } from '@arkham/util';
import { cardStats, resolveAmount, type EngineContext } from '../cards';
import type { Command, ResolveEffect, TestSkill } from '../commands';
import { cardsInPlay } from '../doom';
import { cardOptionLabels } from '../decisions';
import { decisionId, type CardCode, type InstanceId, type InvestigatorId } from '../ids';
import { distance, neighbours } from '../board';
import { limitReached } from '../placement';
import { reactionWithinLimit } from '../reactions';
import { enemiesAt, enemiesMatching } from '../enemies';
import {
  isActiveInvestigator,
  playerOrder,
  requireInvestigator,
  statValue,
} from '../investigators';
import {
  cardsInZones,
  currentCard,
  locationOfCard,
  matchesCard,
  requireCard,
  setAsideCopyOf,
  theOnlyCopy,
} from '../lookup';
import { cardHasKeyword } from '../card_keywords';
import type { KeywordName } from '../keywords';
import type {
  CardInstance,
  Decision,
  GameState,
  Investigator,
  SkillTestOutcome,
  QueuedStep,
} from '../state';
import type { Zone } from '../zone';
import {
  type Ability,
  type AbilityChoice,
  type AbilityCondition,
  type AbilityEffect,
  type DifficultyChange,
  type PickedRef,
  type PickMeasure,
  type Quantity,
  type RelativeCard,
  type RelativeInvestigator,
  type RepeatedRef,
  type TestedAction,
  type TimingWindow,
  type WindowEvent,
  defaultScope,
  inRange,
} from './types';
import type { OpenedWindow } from './windows';
import { cluesHeldForObjective } from './objectives';
import { afterAttacking, enemyAttacks, retreatEnemy, self, withSource, you } from './dsl';

/**
 * The effects of the abilities the card `opened` names has in its window, as
 * steps that resolve one at a time (`resolveEffect`); none for a card without
 * one. Read from its card data in `state`.
 */
export function abilitySteps(
  ctx: EngineContext,
  state: GameState,
  opened: OpenedWindow,
): AbilityStep[] {
  const card = state.cards[opened.cardId];
  if (!card) return [];
  const stats = cardStats(ctx.cards, card.code);
  return [...(stats.abilities ?? []), ...keywordAbilities(ctx, state, card)]
    .map((ability, index) => ({ ability, index }))
    .filter(({ ability }) => hears(ctx, state, ability.window, opened))
    .filter(
      ({ ability }) =>
        ability.condition === undefined || conditionHolds(ctx, state, ability.condition, opened),
    )
    .flatMap(({ ability, index }) =>
      ability.reaction
        ? reactionOffer(state, card, ability, index, opened)
        : repetitionsOf(ctx, state, ability, opened).flatMap((each) =>
            ability.effects.map((effect) => ({ effect, opened: each })),
          ),
    )
    .map(({ effect, opened: each }) => ({
      kind: 'ability',
      effect,
      opened: each,
      origin: effect.type,
    }));
}

/**
 * Whether an ability waiting for `window` fires in `opened`: the same event, heard in the
 * ability's scope (`TimingWindow.of`, else `defaultScope`), about a card its `filter` matches.
 */
function hears(
  ctx: EngineContext,
  state: GameState,
  window: TimingWindow,
  opened: OpenedWindow,
): boolean {
  const { of, filter, ...event } = window;
  if (!shallowEqual<WindowEvent>(event as WindowEvent, opened.window)) return false;
  if ((of ?? defaultScope(window.on)) !== opened.scope) return false;
  if (filter === undefined) return true;
  const subject = opened.subjectId === undefined ? undefined : state.cards[opened.subjectId];
  return subject !== undefined && matchesCard(ctx, subject, filter);
}

/**
 * A reaction's question as its window opens (`Ability.reaction`): the investigator the window
 * names uses it, which records the use (`UseReaction`) and resolves its effects, or passes. None
 * when the window names no active investigator, one away from the card's location, or one whose
 * limit for the reaction is used up.
 */
function reactionOffer(
  state: GameState,
  card: CardInstance,
  ability: Ability,
  index: number,
  opened: OpenedWindow,
): { effect: AbilityEffect; opened: OpenedWindow }[] {
  const { investigatorId } = opened;
  if (investigatorId === undefined || !isActiveInvestigator(state, investigatorId)) return [];
  // Rules Reference, "Triggered Abilities": a scenario card's ability is theirs only at its location.
  const at = locationOfCard(state, card);
  if (at !== undefined && requireInvestigator(state, investigatorId).locationId !== at) return [];
  if (!reactionWithinLimit(state, card, index, ability.reaction?.limit, investigatorId)) return [];
  const use: AbilityEffect = {
    type: 'UseReaction',
    cardId: { ref: 'self' },
    investigatorId: { ref: 'windowInvestigator' },
    ability: index,
  };
  const question: AbilityEffect = {
    type: 'RequestDecision',
    decision: {
      id: decisionId(`${REACTION_ID_PREFIX}${card.id}:${index}`),
      kind: 'chooseOption',
      prompt: REACTION_PROMPT,
      subject: { ref: 'self' },
      decider: { kind: 'investigator', investigatorId: { ref: 'windowInvestigator' } },
      options: [
        { id: 'use', label: 'decision.useReaction', commands: [use, ...ability.effects] },
        { id: 'pass', label: 'decision.passReaction', commands: [] },
      ],
    },
  };
  return [{ effect: question, opened }];
}

/** What the id of every reaction's question (`reactionOffer`) starts with. */
const REACTION_ID_PREFIX = 'reaction:';

/** The prompt of every reaction's question (`reactionOffer`), which also tells it from others. */
const REACTION_PROMPT = 'decision.reaction';

/** Whether `step` is a reaction's question (`reactionOffer`), which waits for the forced steps. */
export function isReactionOffer(step: { kind: string; effect?: AbilityEffect }): boolean {
  const { effect } = step;
  return (
    step.kind === 'ability' &&
    effect?.type === 'RequestDecision' &&
    effect.decision.prompt === REACTION_PROMPT
  );
}

/**
 * The windows `ability` resolves in: `opened` itself, or with `forEach` one copy for each
 * investigator or card it names, naming that investigator or binding that card as `thatCard`.
 */
function repetitionsOf(
  ctx: EngineContext,
  state: GameState,
  ability: Ability,
  opened: OpenedWindow,
): OpenedWindow[] {
  const each = ability.forEach;
  if (each === undefined) return [opened];
  const ids = eachId(ctx, state, each, windowRefs(ctx, state, opened));
  // `eachId` returns investigator ids for an investigator reference and card ids otherwise.
  return ids.map((id): OpenedWindow => {
    switch (each.ref) {
      case 'eachInvestigator':
        return { ...opened, investigatorId: id as InvestigatorId };
      case 'eachEnemy':
      case 'eachInZone':
      case 'eachInPlay':
        return { ...opened, thatCardId: id as InstanceId };
      default:
        return assertNever(each);
    }
  });
}

/**
 * The forced abilities a keyword gives a card on top of its printed ones (Rules Reference):
 * a retaliate enemy attacks whoever failed to fight it, an alert one whoever failed to evade it
 * (only when ready, `EnemyAttacks.kind`), and an elusive enemy retreats after it attacks or is
 * attacked, hit or miss. Retaliate comes before elusive, so the enemy retreats after its retaliate
 * attack (`attacked`); its own retreat then finds it exhausted and does nothing, unless the players
 * cancelled the attack.
 */
function keywordAbilities(ctx: EngineContext, state: GameState, card: CardInstance): Ability[] {
  const has = (name: KeywordName) => cardHasKeyword(ctx, state, card, name);
  const retreat = retreatEnemy(self());
  return [
    ...(has('retaliate')
      ? [afterTestEnds('fight', 'fail', enemyAttacks(self(), you(), 'retaliate'))]
      : []),
    ...(has('alert') ? [afterTestEnds('evade', 'fail', enemyAttacks(self(), you(), 'alert'))] : []),
    ...(has('elusive')
      ? [
          afterAttacking(retreat),
          afterTestEnds('fight', 'pass', retreat),
          afterTestEnds('fight', 'fail', retreat),
        ]
      : []),
  ];
}

/** A forced ability once a basic action's test against the card has ended, its results applied. */
function afterTestEnds(
  action: TestedAction,
  outcome: SkillTestOutcome,
  ...effects: AbilityEffect[]
): Ability {
  return { window: { on: 'testEnded', action, outcome }, effects };
}

/**
 * Whether `condition` holds in the window `opened` (see `AbilityCondition`). Without a window (a
 * resolution's question about the ended game, `gameHolds`) a reference to the window's card,
 * investigator or location names nothing, and a picked reference has no candidates.
 */
export function conditionHolds(
  ctx: EngineContext,
  state: GameState,
  condition: AbilityCondition,
  opened: OpenedWindow | undefined,
): boolean {
  const { playerCount } = state.meta;
  switch (condition.kind) {
    case 'currentCard': {
      const current = currentCard(state, condition.deck);
      return current !== undefined && condition.codes.includes(current.code);
    }
    case 'countOf':
      return inRange(countOf(ctx, state, condition.of, opened), condition, playerCount);
    case 'valueOf': {
      const values = quantities(ctx, state, condition.value, opened);
      return values.length > 0 && values.every((value) => inRange(value, condition, playerCount));
    }
    case 'atLeast': {
      const value = quantities(ctx, state, condition.value, opened);
      const than = quantities(ctx, state, condition.than, opened);
      return value.length > 0 && than.length > 0 && sum(value) >= sum(than);
    }
    case 'phase':
      return state.meta.phase === condition.phase;
    case 'margin':
      return opened?.margin !== undefined && opened.margin >= condition.min;
    case 'turn': {
      const turn = state.meta.turn;
      if (turn === undefined) return false;
      if (condition.of === undefined) return true;
      const refs = windowRefs(ctx, state, opened);
      return namedIds(ctx, state, condition.of, refs).includes(turn.investigatorId);
    }
    case 'allOf':
      return condition.conditions.every((each) => conditionHolds(ctx, state, each, opened));
    case 'anyOf':
      return condition.conditions.some((each) => conditionHolds(ctx, state, each, opened));
    case 'not':
      return !conditionHolds(ctx, state, condition.condition, opened);
    default:
      return assertNever(condition);
  }
}

/** How many things `of` names outside any window ("for each enemy beneath the act"). */
export function countOnTable(ctx: EngineContext, state: GameState, of: RepeatedRef): number {
  return countOf(ctx, state, of, undefined);
}

/** How many things `of` names as `opened` opens (see `AbilityCondition.countOf`). */
function countOf(
  ctx: EngineContext,
  state: GameState,
  of: RepeatedRef | PickedRef,
  opened: OpenedWindow | undefined,
): number {
  const refs = windowRefs(ctx, state, opened);
  if (isRepeatedRef(of)) return eachId(ctx, state, of, refs).length;
  if (opened === undefined) return 0;
  return candidatesFor(ctx, state, of, opened.cardId, refs).length;
}

/** The values `quantity` reads as `opened` opens, one per investigator or card it names. */
function quantities(
  ctx: EngineContext,
  state: GameState,
  quantity: Quantity,
  opened: OpenedWindow | undefined,
): number[] {
  const refs = windowRefs(ctx, state, opened);
  switch (quantity.kind) {
    case 'stat':
      return namedIds(ctx, state, quantity.who, refs).map((id) =>
        statValue(requireInvestigator(state, id as InvestigatorId), quantity.stat),
      );
    case 'tokens':
      return namedIds(ctx, state, quantity.on, refs).map(
        (id) => state.cards[id as InstanceId]?.tokens[quantity.token] ?? 0,
      );
    case 'groupClues':
      return [cluesHeldForObjective(ctx, state, quantity.location)];
    default:
      return assertNever(quantity);
  }
}

/** The investigators or cards `ref` names: each one of an `each…` reference, else the one it stands for, if any. */
function namedIds(
  ctx: EngineContext,
  state: GameState,
  ref: RelativeCard | RelativeInvestigator,
  refs: ResolvedRefs,
): (InstanceId | InvestigatorId)[] {
  if (isRepeatedRef(ref)) return eachId(ctx, state, ref, refs);
  const id = resolveRefs(ref, refs) as InstanceId | InvestigatorId | undefined;
  return id === undefined ? [] : [id];
}

/** An effect waiting to resolve: the queue step `abilitySteps` produces. */
export type AbilityStep = Extract<QueuedStep, { kind: 'ability' }>;

/**
 * The commands `effect` stands for in `state`, with its references resolved
 * for `opened`. Usually one; one per investigator or enemy for an effect on
 * each of them (`eachInvestigator`, `eachEnemy`). None when a reference names nobody, such as
 * `windowInvestigator` in a window that names no investigator (a location
 * revealed by a card effect), or one who has left the scenario meanwhile
 * (defeated by an earlier effect of the same revelation), whose threat area
 * and tests are gone with them; and none when a card it names by code is not
 * there exactly once (`missingCopies`).
 */
export function resolveEffect(
  ctx: EngineContext,
  state: GameState,
  effect: AbilityEffect,
  opened: OpenedWindow,
): Command[] {
  const offered = withOfferedOptions(ctx, state, effect, opened);
  if (Array.isArray(offered))
    return offered.flatMap((inner) => resolveEffect(ctx, state, inner, opened));
  const refs = windowRefs(ctx, state, opened);
  const deferred = withDeferredOutcomes(withDifficultyChanges(ctx, state, offered, opened), opened);
  const each = repeatedRef(deferred);
  const ids = each === undefined ? [undefined] : eachId(ctx, state, each, refs);
  const commandsFor = (picked?: InstanceId | InvestigatorId): Command[] =>
    ids.flatMap((id, repetition) => {
      const setAsideCopy = (code: CardCode) => setAsideCopyOf(state, code, repetition);
      const resolved = resolveRefs(deferred, { ...refs, each: id, picked, setAsideCopy });
      // The walk keeps every field but the references, which become the IDs the command type
      // expects, so the result is a command. A difficulty the decider enters (`AskedCount`) sits
      // only in a choice's option, which holds `AnswerableCommand`s: the answer fills it in.
      return resolved === undefined
        ? []
        : [
            withSource(resolved as Command, {
              cardId: opened.cardId,
              window: opened.window.on,
            }),
          ];
    });
  const picked = pickedRef(deferred);
  if (picked === undefined) return commandsFor();
  const you = refs.windowInvestigator;
  if (you === undefined) return [];
  const candidates = candidatesFor(ctx, state, picked, opened.cardId, refs);
  const [first, ...others] = candidates;
  if (first === undefined) return [];
  if (others.length === 0) return commandsFor(first);
  return [pickDecision(ctx, state, opened.cardId, offered, picked, you, candidates, commandsFor)];
}

/**
 * A choice with only the options whose `when` holds as `opened` resolves, before its references
 * become IDs (they would turn the condition's `you()` into an ID too); the effects of the one
 * option left, as there is nothing to ask; none when no option is left. Any other effect as it is.
 */
function withOfferedOptions(
  ctx: EngineContext,
  state: GameState,
  effect: AbilityEffect,
  opened: OpenedWindow,
): AbilityEffect | AbilityEffect[] {
  if (effect.type !== 'RequestDecision') return effect;
  // Read as card data writes it: `Templated` would map the references inside the conditions too.
  const choice = effect as unknown as AbilityChoice;
  if (choice.decision.options.every((option) => option.when === undefined)) return effect;
  const options = choice.decision.options
    .filter(({ when }) => when === undefined || conditionHolds(ctx, state, when, opened))
    .map((option) => withoutKey(option, 'when'));
  const [only, ...others] = options;
  if (only === undefined) return [];
  if (others.length === 0 && only.amounts === undefined)
    return only.commands as unknown as AbilityEffect[];
  return { ...choice, decision: { ...choice.decision, options } } as unknown as AbilityEffect;
}

/**
 * `effect` with the `difficultyChanges` of each test in it read from the table as `opened`
 * resolves and folded into its difficulty, which never drops below 0. Done before anything
 * else, so a reference in a change (`eachEnemy` in "if there is an enemy at your location")
 * isn't taken for one the effect repeats over. A test's outcomes are left alone: they resolve
 * later (`withDeferredOutcomes`), and a test among them reads the table then.
 *
 * The rules fix a variable difficulty only at ST.6, but the engine has no ST.6: it asks for the
 * test once and the players answer pass or fail. So the difficulty is read as the test is asked,
 * and a change in the commit window (a player card, played by hand) is the players' to count in
 * their answer, as everything else they commit is.
 */
function withDifficultyChanges(
  ctx: EngineContext,
  state: GameState,
  effect: AbilityEffect,
  opened: OpenedWindow,
): AbilityEffect {
  const change = (entry: DifficultyChange): number =>
    'per' in entry
      ? entry.by * sum(quantities(ctx, state, entry.per, opened))
      : conditionHolds(ctx, state, entry.when, opened)
        ? entry.by
        : 0;
  const fold = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(fold);
    if (typeof value !== 'object' || value === null) return value;
    if ('type' in value && value.type === 'TestSkill') {
      // Read as the command type: `Templated` would map the card codes inside the changes too.
      const { difficultyChanges = [], ...test } = value as unknown as TestSkill;
      // A difficulty the decider enters (`AskedCount`) takes no changes (`skillTestOfEither`).
      if (difficultyChanges.length === 0) return test;
      const added = sum(difficultyChanges.map(change));
      return {
        ...test,
        test: { ...test.test, difficulty: Math.max(0, test.test.difficulty + added) },
      };
    }
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, fold(inner)]));
  };
  // The walk keeps every field but the changes, so the result is still an `AbilityEffect`.
  return fold(effect) as AbilityEffect;
}

/**
 * `effect` with a test's outcomes as `ResolveEffect` commands, so each
 * outcome effect resolves after the answer against the state then, in turn:
 * a drawer the fail's damage defeated names nobody for the rest. The walks
 * over references (`findRef`, `resolveRefs`) leave them as they are. A
 * choice's option effect on each of several (`eachInvestigator`, "each
 * investigator discards 1 card at random") is deferred the same way, so it
 * repeats itself after the answer instead of repeating the whole choice.
 */
function withDeferredOutcomes(effect: AbilityEffect, opened: OpenedWindow): unknown {
  const defer = (effects: readonly AbilityEffect[]): ResolveEffect[] =>
    effects.map((outcome) => ({
      type: 'ResolveEffect',
      effect: outcome,
      opened,
      ...(pickedRef(outcome) === undefined ? {} : { picks: true }),
    }));
  // A margin entry stays itself for `answerCommands` to expand: what it holds is deferred.
  const deferOutcomes = (effects: readonly AbilityEffect[]): unknown[] =>
    effects.map((outcome) => {
      if (outcome.type === 'ForEachPoint')
        return { ...outcome, commands: deferOutcomes(outcome.commands) };
      if (outcome.type === 'ByMargin') {
        const tiers = outcome.tiers.map((tier) => ({
          ...tier,
          commands: deferOutcomes(tier.commands),
        }));
        return { ...outcome, tiers };
      }
      return defer([outcome])[0];
    });
  if (effect.type === 'RequestDecision') {
    const options = effect.decision.options.map((option) => ({
      ...option,
      commands: option.commands.map((inner) => {
        // A test the option asks for ("test [willpower] or [intellect]") defers its own outcomes.
        if (inner.type === 'TestSkill') return withDeferredOutcomes(inner, opened);
        return repeatedRef(inner) === undefined && pickedRef(inner) === undefined
          ? inner
          : defer([inner])[0];
      }),
    }));
    return { ...effect, decision: { ...effect.decision, options } };
  }
  if (effect.type !== 'TestSkill') return effect;
  return {
    ...effect,
    onPass: deferOutcomes(effect.onPass),
    onFail: deferOutcomes(effect.onFail),
  };
}

/** The first reference in `effect` with candidates (`Selector`), if it holds one. */
function pickedRef(effect: unknown): PickedRef | undefined {
  return findRef(effect, (ref) => (ref.ref === 'pick' ? ref : undefined));
}

/**
 * The cards or investigators `picked` may stand for when `cardId`'s ability resolves: those its
 * `among` names, left out what `except` names and, with `attachable`, the locations `cardId` may
 * not attach to; with `best`, only those that measure the most or fewest (`measureOf`).
 */
function candidatesFor(
  ctx: EngineContext,
  state: GameState,
  picked: PickedRef,
  cardId: InstanceId,
  refs: ResolvedRefs,
): (InstanceId | InvestigatorId)[] {
  const except = picked.except === undefined ? undefined : resolveRefs(picked.except, refs);
  const open = eachId(ctx, state, picked.among, refs).filter(
    (id) =>
      id !== except &&
      (picked.attachable === undefined ||
        mayAttach(ctx, state, cardId, requireCard(state.cards, id as InstanceId))),
  );
  const { best } = picked;
  if (best === undefined) return open;
  const measured = open.flatMap((id) => {
    const value = measureOf(ctx, state, best.measure, id, refs);
    return value === undefined ? [] : [{ id, value }];
  });
  const values = measured.map(({ value }) => value);
  const extreme = best.extreme === 'most' ? Math.max(...values) : Math.min(...values);
  return measured.filter(({ value }) => value === extreme).map(({ id }) => id);
}

/** What `id` measures for a `Selector`'s `best` (`PickMeasure`); none for a distance from nowhere. */
function measureOf(
  ctx: EngineContext,
  state: GameState,
  measure: PickMeasure,
  id: InstanceId | InvestigatorId,
  refs: ResolvedRefs,
): number | undefined {
  const card = state.cards[id as InstanceId];
  switch (measure.kind) {
    case 'tokens':
      return card?.tokens[measure.token] ?? 0;
    case 'distance': {
      const from =
        refs.windowInvestigator === undefined
          ? undefined
          : requireInvestigator(state, refs.windowInvestigator).locationId;
      if (from === undefined) return undefined;
      const to = card === undefined ? undefined : locationOfCard(state, card);
      return to === undefined ? Infinity : distance(ctx, state, from, to);
    }
    default:
      return assertNever(measure);
  }
}

/**
 * Several candidates for `picked`: its `chooser` picks one, the lead investigator or `you`, the
 * investigator the window names. The decision asks for an investigator, an enemy or a location by
 * what `among` names, and for a location by what `effect` does with it. Each option runs the
 * effect for its card or investigator.
 */
function pickDecision(
  ctx: EngineContext,
  state: GameState,
  cardId: InstanceId,
  effect: AbilityEffect,
  picked: PickedRef,
  investigatorId: InvestigatorId,
  candidates: readonly (InstanceId | InvestigatorId)[],
  commandsFor: (pickedId: InstanceId | InvestigatorId) => Command[],
): Command {
  const investigators = picked.among.ref === 'eachInvestigator';
  const labels = investigators
    ? candidates.map((id) => requireInvestigator(state, id as InvestigatorId).name)
    : cardOptionLabels(ctx, state, candidates as InstanceId[]);
  return {
    type: 'RequestDecision',
    decision: {
      ...pickQuestion(picked, effect),
      id: decisionId(`pick:${cardId}`),
      subject: cardId,
      decider:
        picked.chooser === 'lead' ? { kind: 'lead' } : { kind: 'investigator', investigatorId },
      options: candidates.map((id, i) => ({
        id,
        label: labels[i] ?? id,
        target: id,
        commands: commandsFor(id),
      })),
    },
  };
}

/**
 * How a decision for `picked` asks: by what `among` names, and for a location by what `effect`
 * does there, moving the investigator or the card.
 */
function pickQuestion(picked: PickedRef, effect: AbilityEffect): Pick<Decision, 'kind' | 'prompt'> {
  const { among } = picked;
  if (among.ref === 'eachInvestigator')
    return { kind: 'chooseInvestigator', prompt: 'decision.chooseInvestigatorFor' };
  if (among.ref === 'eachEnemy') return { kind: 'chooseCard', prompt: 'decision.chooseEnemyFor' };
  if (among.typeCode !== 'location')
    return { kind: 'chooseCard', prompt: 'decision.chooseCardFor' };
  switch (effect.type) {
    case 'MoveInvestigator':
      return { kind: 'chooseLocation', prompt: 'decision.chooseLocationToMove' };
    case 'MoveCard':
      return { kind: 'chooseLocation', prompt: 'decision.chooseLocationToAttach' };
    default:
      return { kind: 'chooseLocation', prompt: 'decision.chooseLocationFor' };
  }
}

/** What each relative reference stands for when an effect resolves; absent when it names nobody. */
interface ResolvedRefs {
  /** The card with the ability; none outside a window. */
  self: InstanceId | undefined;
  windowInvestigator: InvestigatorId | undefined;
  lead: InvestigatorId | undefined;
  windowLocation: InstanceId | undefined;
  /** Where the card with the ability is (`selfLocation`). */
  selfLocation: InstanceId | undefined;
  /** The card of this repetition of a `forEach` ability (`thatCard`). */
  thatCard: InstanceId | undefined;
  onlyCopy: (code: CardCode) => InstanceId | undefined;
  /**
   * The set-aside copy of `code` this repetition takes (`setAsideCopy`), the first one when the
   * effect repeats for nobody else.
   */
  setAsideCopy: (code: CardCode) => InstanceId | undefined;
  /** The investigator or enemy of this repetition of an effect on each of them. */
  each?: InstanceId | InvestigatorId;
  /**
   * The card or investigator a reference with candidates stands for (`pickedRef`): the only
   * candidate, or the one picked among them.
   */
  picked?: InstanceId | InvestigatorId;
}

/**
 * The first reference in `effect` that repeats it. An effect holds at most
 * one. A test's outcomes and a choice's option effects that hold one are
 * deferred (`withDeferredOutcomes`), so one there repeats only its own effect.
 */
function repeatedRef(effect: unknown): RepeatedRef | undefined {
  return findRef(effect, (ref) => (isRepeatedRef(ref) ? ref : undefined));
}

function isRepeatedRef(ref: RelativeCard | RelativeInvestigator): ref is RepeatedRef {
  return ref.ref.startsWith('each');
}

/** The first reference in `effect`, depth first, that `pick` returns something for. */
function findRef<R>(
  effect: unknown,
  pick: (ref: RelativeCard | RelativeInvestigator) => R | undefined,
): R | undefined {
  if (typeof effect !== 'object' || effect === null || isDeferred(effect)) return undefined;
  // A reference's own fields (a `Selector`'s `among`) belong to it, not to the effect.
  if (isRelative(effect)) return pick(effect);
  for (const field of Object.values(effect)) {
    const found = findRef(field, pick);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The investigators or enemies `each` repeats the command for. */
function eachId(
  ctx: EngineContext,
  state: GameState,
  each: RepeatedRef,
  refs: ResolvedRefs,
): (InstanceId | InvestigatorId)[] {
  switch (each.ref) {
    case 'eachInvestigator': {
      const at = each.at === undefined ? undefined : resolveRefs(each.at, refs);
      if (each.at !== undefined && at === undefined) return [];
      return playerOrder(state)
        .filter((inv) => at === undefined || inv.locationId === at)
        .map((inv) => inv.id);
    }
    case 'eachEnemy': {
      const engagedWith =
        each.engagedWith === undefined ? undefined : resolveRefs(each.engagedWith, refs);
      if (each.engagedWith !== undefined && engagedWith === undefined) return [];
      const there =
        each.at === undefined
          ? undefined
          : new Set(
              [each.at]
                .flat()
                .map((location) => resolveRefs(location, refs) as InstanceId | undefined)
                .flatMap((location) =>
                  location === undefined ? [] : enemiesAt(ctx, state, location),
                )
                .map((card) => card.id),
            );
      return enemiesMatching(ctx, state, each)
        .filter((card) => there === undefined || there.has(card.id))
        .filter(
          (card) =>
            engagedWith === undefined ||
            (card.zone.kind === 'engaged' && card.zone.investigatorId === engagedWith),
        )
        .map((card) => card.id);
    }
    case 'eachInZone': {
      const zones = [each.zone].flat().flatMap((zone) => {
        const resolved = resolveRefs(zone, refs) as Zone | undefined;
        return resolved === undefined ? [] : [resolved];
      });
      const found = cardsInZones(ctx, state, zones, each, each.top).map((card) => card.id);
      return each.first === undefined
        ? found
        : found.slice(0, resolveAmount(each.first, state.meta.playerCount));
    }
    case 'eachInPlay': {
      const there =
        each.at === undefined
          ? undefined
          : [each.at]
              .flat()
              .map((location) => resolveRefs(location, refs) as InstanceId | undefined);
      const connecting =
        each.connectedTo === undefined
          ? undefined
          : connectingTo(ctx, state, resolveRefs(each.connectedTo, refs) as InstanceId | undefined);
      return cardsInPlay(state)
        .filter((card) => matchesCard(ctx, card, each))
        .filter((card) => {
          const location = locationOfCard(state, card);
          return (
            (there === undefined || (location !== undefined && there.includes(location))) &&
            (connecting === undefined || (location !== undefined && connecting.includes(location)))
          );
        })
        .map((card) => card.id);
    }
    default:
      return assertNever(each);
  }
}

/** The locations connecting to `location` (`neighbours`); none while it names none. */
function connectingTo(
  ctx: EngineContext,
  state: GameState,
  location: InstanceId | undefined,
): InstanceId[] {
  return location === undefined ? [] : neighbours(ctx, state, location);
}

/**
 * What the references of an ability whose window `opened` stand for, before any repetition;
 * without a window only those the table answers by itself (the lead, the only copy of a card).
 */
function windowRefs(
  ctx: EngineContext,
  state: GameState,
  opened: OpenedWindow | undefined,
): ResolvedRefs {
  if (opened === undefined) {
    return {
      self: undefined,
      windowInvestigator: undefined,
      lead: activeLead(state),
      windowLocation: undefined,
      selfLocation: undefined,
      thatCard: undefined,
      onlyCopy: (code) => theOnlyCopy(state, code),
      setAsideCopy: (code) => setAsideCopyOf(state, code, 0),
    };
  }
  const { investigatorId } = opened;
  const investigator =
    investigatorId !== undefined && isActiveInvestigator(state, investigatorId)
      ? requireInvestigator(state, investigatorId)
      : undefined;
  return {
    self: opened.cardId,
    windowInvestigator: investigator?.id,
    lead: activeLead(state),
    windowLocation:
      opened.locationId ??
      (investigator && attachableLocation(ctx, state, opened.cardId, investigator)),
    selfLocation: locationOfCard(state, requireCard(state.cards, opened.cardId)),
    thatCard: opened.thatCardId,
    onlyCopy: (code) => theOnlyCopy(state, code),
    setAsideCopy: (code) => setAsideCopyOf(state, code, 0),
  };
}

/** The lead investigator, while they are still in the scenario. */
function activeLead(state: GameState): InvestigatorId | undefined {
  const lead = state.meta.leadInvestigator;
  return lead !== undefined && isActiveInvestigator(state, lead) ? lead : undefined;
}

/**
 * The location `investigator` is at, unless `cardId`'s limit of one per
 * location is reached there: a card of the same title is attached already
 * (counted by title, so a reprint with another code counts too).
 */
function attachableLocation(
  ctx: EngineContext,
  state: GameState,
  cardId: InstanceId,
  investigator: Investigator,
): InstanceId | undefined {
  const location =
    investigator.locationId === undefined ? undefined : state.cards[investigator.locationId];
  if (!location) return undefined;
  return mayAttach(ctx, state, cardId, location) ? location.id : undefined;
}

/** Whether `cardId` may attach to `location`: not while its limit is reached there (`limitReached`). */
function mayAttach(
  ctx: EngineContext,
  state: GameState,
  cardId: InstanceId,
  location: CardInstance,
): boolean {
  return !limitReached(ctx, state, cardId, { kind: 'attachedTo', hostId: location.id });
}

function resolveRefs(value: unknown, refs: ResolvedRefs): unknown {
  if (typeof value !== 'object' || value === null || isDeferred(value)) return value;
  if (Array.isArray(value)) {
    // An option that names nobody drops the whole choice: half its consequences would misstate the card.
    const items = value.map((item: unknown) => resolveRefs(item, refs));
    return items.includes(undefined) ? undefined : items;
  }
  if (isRelative(value)) {
    switch (value.ref) {
      case 'self':
        return refs.self;
      case 'windowInvestigator':
        return refs.windowInvestigator;
      case 'lead':
        return refs.lead;
      case 'windowLocation':
        return refs.windowLocation;
      case 'selfLocation':
        return refs.selfLocation;
      case 'thatCard':
        return refs.thatCard;
      case 'onlyCopy':
        return refs.onlyCopy(value.code);
      case 'eachInvestigator':
      case 'eachEnemy':
      case 'eachInZone':
      case 'eachInPlay':
        return refs.each;
      case 'setAsideCopy':
        return refs.setAsideCopy(value.code);
      case 'pick':
        return refs.picked;
      default:
        return assertNever(value);
    }
  }
  const entries = Object.entries(value).map(([key, field]) => [key, resolveRefs(field, refs)]);
  return entries.some(([, field]) => field === undefined) ? undefined : Object.fromEntries(entries);
}

/**
 * The codes `effect` names with `{ ref: 'onlyCopy' }` that are not in the
 * game exactly once in `state`, each once, in the order it first names them;
 * the reason an `AbilityEffectSkipped` gives.
 */
export function missingCopies(state: GameState, effect: AbilityEffect): CardCode[] {
  const missing: CardCode[] = [];
  const walk = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (isRelative(value)) {
      // A location of a list ("in the Hallway or Parlor") may be out of play without skipping the effect.
      if (
        (value.ref === 'eachEnemy' ||
          value.ref === 'eachInvestigator' ||
          value.ref === 'eachInPlay') &&
        !Array.isArray(value.at)
      )
        walk(value.at);
      if (value.ref !== 'onlyCopy' || missing.includes(value.code)) return;
      if (theOnlyCopy(state, value.code) === undefined) missing.push(value.code);
    } else {
      Object.values(value).forEach(walk);
    }
  };
  walk(effect);
  return missing;
}

function isRelative(value: object): value is RelativeCard | RelativeInvestigator {
  return 'ref' in value;
}

/** A test outcome left for later (`withDeferredOutcomes`), whose references resolve in its own turn. */
function isDeferred(value: object): value is ResolveEffect {
  return 'type' in value && value.type === 'ResolveEffect';
}
