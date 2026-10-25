import { assertNever, range, shallowEqual } from '@arkham/util';
import { cardStats, type EngineContext, type Trait } from './cards';
import type { Command, EncounterMatch, ResolveEffect, TestSkill } from './commands';
import { cardsInPlay } from './doom';
import type { Event } from './events';
import type { TraumaKind } from './campaign/campaign_log';
import {
  decisionId,
  type CardCode,
  type DecisionId,
  type InstanceId,
  type InvestigatorId,
  type ResolutionId,
} from './ids';
import { locationAttachments, locationsInPlay } from './board';
import {
  enemiesAt,
  enemiesMatching,
  enemiesOnTable,
  nearestEnemies,
  type EnemyFilter,
} from './enemies';
import { isActiveInvestigator, playerOrder, requireInvestigator, statValue } from './investigators';
import { cardsInZone, currentCard, requireCard } from './lookup';
import type { AddMapStep } from './setup';
import type {
  CardInstance,
  Decision,
  DecisionOption,
  GameState,
  Investigator,
  InvestigatorStat,
  PerPointFailed,
  Phase,
  SkillTestKind,
  SkillTestOutcome,
  QueuedStep,
  SkillName,
} from './state';
import type { Zone } from './zone';

/**
 * The moment a card ability fires (architecture "Triggers and card
 * effects"). `windowsOpenedBy` is the one place that turns events into
 * windows; a new window is a new case here and there.
 */
export type TimingWindow =
  /** The card is turned face up: a location revealed, or a drawn encounter card (its revelation). */
  | { kind: 'revealed' }
  /**
   * "At the end of your turn" for a card in an investigator's threat area:
   * the end of that investigator's turn (`EndTurn`), naming them. A turn cut
   * short by resignation or defeat opens nothing, as the investigator has
   * left with the card's reason to fire.
   */
  | { kind: 'turnEnds' }
  /**
   * "At the end of each investigator's turn" for a card in play (Umôrdhoth):
   * the end of any investigator's turn (`EndTurn`), naming them. Like
   * `turnEnds`, a turn cut short by resignation or defeat opens nothing.
   */
  | { kind: 'eachTurnEnds' }
  /**
   * "When your turn begins" for a card in an investigator's threat area: the
   * start of that investigator's turn (`StartTurn`), naming them.
   */
  | { kind: 'turnBegins' }
  /**
   * "At the end of the [mythos / investigation / enemy] phase", for every card
   * in play, naming no investigator: opened by the `PhaseChanged` that leaves
   * the phase. The upkeep phase ends with the round, so its end is `roundEnds`.
   */
  | { kind: 'phaseEnds'; phase: EndingPhase }
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
  | { kind: 'tested'; action: TestedAction; outcome: SkillTestOutcome }
  /**
   * "After [this enemy] engages you": the enemy became engaged with an
   * investigator (`EnemyEngaged`), whether it engaged them or they engaged
   * it, as the rules treat both alike. Opened for the enemy, naming the
   * investigator.
   */
  | { kind: 'engaged' }
  /**
   * "After [this enemy] attacks you": opened by `EnemyAttacked` for the enemy,
   * naming the investigator, after the attack's damage and horror. An attack
   * of opportunity opens it too, being an attack; an investigator the attack
   * defeated is nobody by then.
   */
  | { kind: 'attacked' }
  /**
   * "After you discover clues at [this location]": opened by
   * `CluesDiscovered` for the location, naming the investigator.
   */
  | { kind: 'cluesDiscovered' }
  /**
   * "After you enter [this location]": an investigator moved into the
   * location (`InvestigatorMoved`), naming them. When the move turned it
   * face up, it fires before the reveal's abilities: a fixed stand-in, as
   * the rules let the lead order simultaneous forced effects (M1V). Being
   * placed there, at setup or on the map by an investigator without a
   * location, is no move, so it opens nothing.
   */
  | { kind: 'entered' }
  /** "At the end of the round", upkeep step 4.6, for every card in play; names no investigator. */
  | { kind: 'roundEnds' }
  /**
   * The agenda or act advanced: its reverse side, opened by `AgendaAdvanced`
   * or `ActAdvanced` for that card while it is still current (`completeAdvance`
   * replaces it afterwards); names no investigator.
   */
  | { kind: 'advanced' }
  /**
   * An enemy of code `enemy` was defeated (`EnemyDefeated`): an objective
   * of the current agenda or act ("if the Ghoul Priest is defeated,
   * advance"), opened for both, naming no investigator. Only the current
   * ones, so a used-up act or agenda never fires again.
   */
  | { kind: 'enemyDefeated'; enemy: CardCode }
  /**
   * "When [this enemy] is defeated": opened by `EnemyDefeated` for the enemy,
   * naming the location it was at and no investigator. It resolves once the
   * enemy has left play, a stand-in for "when" (before the defeat) that
   * changes nothing while the effect only needs "its location", which the
   * event records.
   */
  | { kind: 'defeated' };

/** The basic actions whose test opens `tested`: investigate, fight and evade. */
export type TestedAction = SkillTestKind['kind'];

/** The phases whose end opens `phaseEnds`: all but setup and upkeep. */
export type EndingPhase = Exclude<Phase, 'setup' | 'upkeep'>;

function isEndingPhase(phase: Phase): phase is EndingPhase {
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
   * location is reached there (`LocationAttachment.onePerLocation`), so a
   * revelation that would attach it there does nothing.
   */
  | { ref: 'windowLocation' }
  /**
   * The one copy of `code` in the game, in whatever zone: for a scenario's
   * unique cards ("the Parlor", "the Ghoul Priest"); none while the game holds
   * no copy or several, and the effect is skipped with `AbilityEffectSkipped`.
   */
  | { ref: 'onlyCopy'; code: CardCode }
  /**
   * Each enemy at the location named, engaged ones included (they are at
   * their investigator's location): the command repeats once per enemy, in
   * card order, and none when there is no enemy there.
   */
  | { ref: 'eachEnemyAt'; location: RelativeCard }
  /**
   * Each enemy on the table `filter` matches ("each unengaged [[Ghoul]]
   * enemy", `enemiesMatching`), and only those engaged with `engagedWith`
   * when it is given ("each enemy engaged with you"; none when it names
   * nobody): the command repeats once per enemy, in card order. Unlike
   * hunters, nobody picks the order: one enemy's step towards a fixed
   * location changes no other enemy's path.
   */
  | ({ ref: 'eachEnemy'; engagedWith?: RelativeInvestigator } & EnemyFilter)
  /**
   * The enemy with `trait` (any enemy without one) nearest to the location of
   * the investigator the window names ("the nearest [[Cultist]] enemy",
   * `nearestEnemies`); none when there is no such enemy. When several are
   * equally near, the lead investigator picks one (Rules Reference, "Choices"):
   * the effect becomes a decision with an option per enemy.
   */
  | { ref: 'nearestEnemy'; trait?: Trait }
  /**
   * A location in play with `trait` ("move to a [[Central]] location"), other
   * than the one the investigator the window names is at, since moving there
   * would be no move; none when there is no other. When there are several,
   * that investigator picks one: the effect becomes a decision with an option
   * per location.
   */
  | { ref: 'locationWith'; trait: Trait };

/**
 * An investigator an ability names relative to its window: the one the
 * window names (the drawer), the lead investigator, or each investigator
 * still in the scenario, in player order (the lead first), which repeats the
 * command once per investigator.
 */
export type RelativeInvestigator =
  | { ref: 'windowInvestigator' }
  | { ref: 'lead' }
  | { ref: 'eachInvestigator' }
  /** Each investigator still in the scenario at the location named, in player order. */
  | { ref: 'eachInvestigatorAt'; location: RelativeCard };

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
 * The commands card data may use. A command joins when the first card
 * needs it; setup, corrections and phase flow (`StartScenario`,
 * `ManualAdjust`, `NextPhase`, …) never do, as no card performs them.
 */
export type AbilityCommand =
  | Extract<
      Command,
      {
        type:
          | 'AdjustInvestigator'
          | 'PlaceDoom'
          | 'MoveCard'
          | 'DiscardCard'
          | 'RevealLocation'
          | 'FromSetAside'
          | 'SpawnEnemy'
          | 'HealEnemy'
          | 'MoveEnemyTowards'
          | 'DisengageEnemy'
          | 'EngageReadyEnemies'
          | 'ReadyEnemy'
          | 'GainSurge'
          | 'MoveInvestigator'
          | 'AddMap'
          | 'AdvanceAct'
          | 'ShuffleEncounterDiscard'
          | 'ShuffleEncounterDeck'
          | 'DrawEncounter'
          | 'DefeatInvestigator'
          | 'EndScenario';
      }
    >
  | AbilityTest
  | AbilityChoice;

/**
 * `TestSkill` with outcomes that are ability commands too, so a test in card
 * data can only lead to what card data may do. The outcomes stay templated
 * until the answer: each resolves in its own turn then (`ResolveEffect`), so
 * it sees what the effects before it did, an `each…` reference in one
 * repeats only that effect, and one that names nobody is dropped alone.
 */
export type AbilityTest = Omit<TestSkill, 'onPass' | 'onFail'> & {
  onPass: readonly AbilityCommand[];
  onFail: readonly AbilityCommand[];
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
  decision: Pick<Decision, 'id' | 'prompt' | 'decider'> & {
    kind: 'chooseOption';
    options: AbilityOption[];
  };
}

/** One answer of an `AbilityChoice`: an option whose commands are ability commands. */
export type AbilityOption = Pick<DecisionOption, 'id' | 'label'> & { commands: AbilityCommand[] };

/**
 * One step of what an ability does: an allowed command written with
 * relative references instead of IDs ("Revelation – Take 1 horror" is
 * `AdjustInvestigator` on `{ ref: 'windowInvestigator' }`). Reusing the
 * command types keeps one vocabulary: a new kind of effect is a command
 * added to `AbilityCommand`, not a new effect type.
 */
export type AbilityEffect = Templated<AbilityCommand>;

/**
 * What must hold when the window opens for an ability to fire ("If it is act
 * 3, …"). Checked once, as the window opens; the effects then resolve
 * whatever they change. A new kind of condition is a new case here and in
 * `conditionHolds`.
 */
export type AbilityCondition =
  /** The current act is one of `acts`, by code. */
  | { kind: 'currentAct'; acts: readonly CardCode[] }
  /**
   * The investigator the window names has between `min` and `max` of
   * `stat`, both included where given ("if you have no clues"). False in a
   * window that names nobody.
   */
  | ({ kind: 'investigatorHas'; stat: InvestigatorStat } & StatRange)
  /**
   * The number of enemies with `trait` on the table is within the range
   * ("If there are no [[Cultist]] enemies in play", `enemiesOnTable`).
   */
  | ({ kind: 'enemiesInPlay'; trait: Trait } & StatRange);

/** Bounds on a value, both included; at least one is given, so the range always says something. */
export type StatRange = { min: number; max?: number } | { min?: number; max: number };

function inRange(value: number, range: StatRange): boolean {
  return value >= (range.min ?? 0) && value <= (range.max ?? Infinity);
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
   * "For each [[Ghoul]] enemy in the Hallway or Parlor": the effects resolve
   * once per enemy `perEnemy` matches, counted as the window opens like the
   * condition; not at all when none does.
   */
  perEnemy?: EnemyFilter;
  effects: readonly AbilityEffect[];
}

/**
 * A window an event opened for one card: the card whose abilities it fires,
 * and the investigator it names, if any (the drawer of an encounter card).
 */
export interface OpenedWindow {
  window: TimingWindow;
  cardId: InstanceId;
  investigatorId?: InvestigatorId;
  /** The location it names itself, if any (where a defeated enemy was); see `windowLocation`. */
  locationId?: InstanceId;
}

/**
 * The windows `event` opens; `state` is the state right after it. `events`
 * is the whole batch it belongs to: a drawn card is turned face up in the
 * same batch as its `EncounterCardDrawn`, which is the only record of who
 * drew it.
 */
export function windowsOpenedBy(
  state: GameState,
  event: Event,
  events: readonly Event[],
): OpenedWindow[] {
  switch (event.type) {
    case 'CardFlipped': {
      if (!event.faceUp) return [];
      const drawn = events.find(
        (e) => e.type === 'EncounterCardDrawn' && e.cardId === event.cardId,
      );
      const investigatorId =
        drawn?.type === 'EncounterCardDrawn' ? drawn.investigatorId : undefined;
      return [
        {
          window: { kind: 'revealed' },
          cardId: event.cardId,
          ...(investigatorId && { investigatorId }),
        },
      ];
    }
    case 'InvestigatorMoved':
      if (event.from === undefined) return [];
      return [
        { window: { kind: 'entered' }, cardId: event.to, investigatorId: event.investigatorId },
      ];
    case 'TurnEnded': {
      const { investigatorId } = event;
      return [
        ...cardsInZone(state, { kind: 'threatArea', investigatorId }).map((cardId) => ({
          window: { kind: 'turnEnds' } as const,
          cardId,
          investigatorId,
        })),
        ...cardsInPlay(state).map((card) => ({
          window: { kind: 'eachTurnEnds' } as const,
          cardId: card.id,
          investigatorId,
        })),
      ];
    }
    case 'TurnStarted': {
      const { investigatorId } = event;
      return cardsInZone(state, { kind: 'threatArea', investigatorId }).map((cardId) => ({
        window: { kind: 'turnBegins' },
        cardId,
        investigatorId,
      }));
    }
    case 'PhaseChanged': {
      const phase = event.ended;
      if (!isEndingPhase(phase)) return [];
      return cardsInPlay(state).map((card) => ({
        window: { kind: 'phaseEnds', phase },
        cardId: card.id,
      }));
    }
    case 'EnemyEngaged':
      return [
        {
          window: { kind: 'engaged' },
          cardId: event.enemyId,
          investigatorId: event.investigatorId,
        },
      ];
    case 'EnemyAttacked':
      return [
        {
          window: { kind: 'attacked' },
          cardId: event.enemyId,
          investigatorId: event.investigatorId,
        },
      ];
    case 'CluesDiscovered':
      return [
        {
          window: { kind: 'cluesDiscovered' },
          cardId: event.locationId,
          investigatorId: event.investigatorId,
        },
      ];
    case 'SkillTestResolved': {
      const { action, subject, outcome, investigatorId } = event;
      if (action === undefined || subject === undefined) return [];
      const window: TimingWindow = { kind: 'tested', action, outcome };
      return [subject, ...cardsInZone(state, { kind: 'attachedTo', hostId: subject })].map(
        (cardId) => ({ window, cardId, ...(investigatorId && { investigatorId }) }),
      );
    }
    case 'RoundEnded':
      return cardsInPlay(state).map((card) => ({ window: { kind: 'roundEnds' }, cardId: card.id }));
    case 'AgendaAdvanced':
    case 'ActAdvanced':
      return [{ window: { kind: 'advanced' }, cardId: event.cardId }];
    case 'EnemyDefeated': {
      const enemy = requireCard(state.cards, event.enemyId).code;
      const self: OpenedWindow = {
        window: { kind: 'defeated' },
        cardId: event.enemyId,
        locationId: event.locationId,
      };
      // The enemy's own ability, then agenda before act: a fixed stand-in, as the rules let the
      // lead order simultaneous forced effects (M1V).
      return [
        self,
        ...[state.agenda.current, state.act.current].flatMap((cardId) =>
          cardId === undefined
            ? []
            : [{ window: { kind: 'enemyDefeated' as const, enemy }, cardId }],
        ),
      ];
    }
    default:
      return [];
  }
}

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
  return (cardStats(ctx.cards, card.code).abilities ?? [])
    .filter((ability) => shallowEqual<TimingWindow>(ability.window, opened.window))
    .filter(
      (ability) =>
        ability.condition === undefined || conditionHolds(ctx, state, ability.condition, opened),
    )
    .flatMap((ability) => range(timesFor(ctx, state, ability)).flatMap(() => ability.effects))
    .map((effect) => ({ kind: 'ability', effect, opened, origin: effect.type }));
}

/** How often `ability`'s effects resolve: once, or once per enemy its `perEnemy` matches. */
function timesFor(ctx: EngineContext, state: GameState, ability: Ability): number {
  return ability.perEnemy === undefined ? 1 : enemiesMatching(ctx, state, ability.perEnemy).length;
}

function conditionHolds(
  ctx: EngineContext,
  state: GameState,
  condition: AbilityCondition,
  opened: OpenedWindow,
): boolean {
  switch (condition.kind) {
    case 'currentAct': {
      const act = currentCard(state, 'act');
      return act !== undefined && condition.acts.includes(act.code);
    }
    case 'investigatorHas': {
      const { investigatorId } = opened;
      if (investigatorId === undefined || !isActiveInvestigator(state, investigatorId))
        return false;
      const value = statValue(requireInvestigator(state, investigatorId), condition.stat);
      return inRange(value, condition);
    }
    case 'enemiesInPlay':
      return inRange(enemiesOnTable(ctx, state, condition.trait).length, condition);
    default:
      return assertNever(condition);
  }
}

/** An effect waiting to resolve: the queue step `abilitySteps` produces. */
export type AbilityStep = Extract<QueuedStep, { kind: 'ability' }>;

/**
 * The commands `effect` stands for in `state`, with its references resolved
 * for `opened`. Usually one; one per investigator or enemy for an effect on
 * each of them (`eachInvestigator`, `eachEnemyAt`). None when a reference names nobody, such as
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
  const { investigatorId } = opened;
  const investigator =
    investigatorId !== undefined && isActiveInvestigator(state, investigatorId)
      ? requireInvestigator(state, investigatorId)
      : undefined;
  const refs: ResolvedRefs = {
    self: opened.cardId,
    windowInvestigator: investigator?.id,
    lead: activeLead(state),
    windowLocation:
      opened.locationId ??
      (investigator && attachableLocation(ctx, state, opened.cardId, investigator)),
    onlyCopy: (code) => theOnlyCopy(state, code),
  };
  const deferred = withDeferredOutcomes(effect, opened);
  const each = repeatedRef(deferred);
  const ids = each === undefined ? [undefined] : eachId(ctx, state, each, refs);
  const commandsFor = (picked?: InstanceId): AbilityCommand[] =>
    ids.flatMap((id) => {
      const resolved = resolveRefs(deferred, { ...refs, each: id, picked });
      // The walk keeps every field but the references, which become the IDs the
      // command type expects, so the result is an `AbilityCommand`.
      return resolved === undefined ? [] : [resolved as AbilityCommand];
    });
  const picked = pickedRef(deferred);
  if (picked === undefined) return commandsFor();
  if (investigator?.locationId === undefined) return [];
  const candidates = candidatesFor(ctx, state, picked, investigator.locationId);
  const [first, ...others] = candidates;
  if (first === undefined) return [];
  if (others.length === 0) return commandsFor(first.id);
  return [pickDecision(ctx, opened.cardId, picked, investigator.id, candidates, commandsFor)];
}

/**
 * `effect` with a test's outcomes as `ResolveEffect` commands, so each
 * outcome effect resolves after the answer against the state then, in turn:
 * a drawer the fail's damage defeated names nobody for the rest. The walks
 * over references (`findRef`, `resolveRefs`) leave them as they are.
 */
function withDeferredOutcomes(effect: AbilityEffect, opened: OpenedWindow): unknown {
  if (effect.type !== 'TestSkill') return effect;
  const defer = (effects: readonly AbilityEffect[]): ResolveEffect[] =>
    effects.map((outcome) => ({ type: 'ResolveEffect', effect: outcome, opened }));
  return { ...effect, onPass: defer(effect.onPass), onFail: defer(effect.onFail) };
}

/** Who picks a candidate for `picked`, and how the decision asks. */
function pickQuestion(
  picked: PickedRef,
  investigatorId: InvestigatorId,
): Pick<Decision, 'kind' | 'prompt' | 'decider'> & { key: string } {
  switch (picked.ref) {
    case 'nearestEnemy':
      return {
        key: 'nearest',
        kind: 'chooseCard',
        prompt: 'decision.chooseNearestEnemy',
        decider: { kind: 'lead' },
      };
    case 'locationWith':
      return {
        key: 'location',
        kind: 'chooseLocation',
        prompt: 'decision.chooseLocationToMove',
        decider: { kind: 'investigator', investigatorId },
      };
    default:
      return assertNever(picked);
  }
}

/** A reference that stands for one of several candidates, which someone may have to pick. */
type PickedRef = Extract<RelativeCard, { ref: 'nearestEnemy' | 'locationWith' }>;

/** The first reference in `effect` with candidates (`nearestEnemy`, `locationWith`), if it holds one. */
function pickedRef(effect: unknown): PickedRef | undefined {
  return findRef(effect, (ref) =>
    ref.ref === 'nearestEnemy' || ref.ref === 'locationWith' ? ref : undefined,
  );
}

/** The cards `picked` may stand for, counted from `from`, the location of the investigator the window names. */
function candidatesFor(
  ctx: EngineContext,
  state: GameState,
  picked: PickedRef,
  from: InstanceId,
): CardInstance[] {
  switch (picked.ref) {
    case 'nearestEnemy':
      return nearestEnemies(ctx, state, from, picked.trait);
    case 'locationWith':
      return locationsInPlay(ctx, state).filter(
        (location) =>
          location.id !== from && cardStats(ctx.cards, location.code).traits.includes(picked.trait),
      );
    default:
      return assertNever(picked);
  }
}

/**
 * Several candidates for `picked`: equally near enemies are the lead
 * investigator's pick (Rules Reference, "Choices"), a location to move to is
 * the moving investigator's own. Each option runs the effect for its card.
 */
function pickDecision(
  ctx: EngineContext,
  cardId: InstanceId,
  picked: PickedRef,
  investigatorId: InvestigatorId,
  candidates: readonly CardInstance[],
  commandsFor: (pickedId: InstanceId) => AbilityCommand[],
): Command {
  const { key, ...asked } = pickQuestion(picked, investigatorId);
  return {
    type: 'RequestDecision',
    decision: {
      ...asked,
      id: decisionId(`${key}:${cardId}`),
      subject: cardId,
      options: candidates.map((card) => ({
        id: card.id,
        label: cardStats(ctx.cards, card.code).name,
        target: card.id,
        commands: commandsFor(card.id),
      })),
    },
  };
}

/** What each relative reference stands for when an effect resolves; absent when it names nobody. */
interface ResolvedRefs {
  self: InstanceId;
  windowInvestigator: InvestigatorId | undefined;
  lead: InvestigatorId | undefined;
  windowLocation: InstanceId | undefined;
  onlyCopy: (code: CardCode) => InstanceId | undefined;
  /** The investigator or enemy of this repetition of an effect on each of them. */
  each?: InstanceId | InvestigatorId;
  /**
   * The card a reference with candidates stands for (`pickedRef`): the only
   * candidate, or the one picked among them.
   */
  picked?: InstanceId;
}

/** A reference that repeats the command, as `eachInvestigator` does. */
type RepeatedRef = Extract<RelativeCard | RelativeInvestigator, { ref: `each${string}` }>;

/**
 * The first reference in `effect` that repeats it. An effect holds at most
 * one, and a choice's options none: one there would repeat the whole choice.
 * A test's outcomes are deferred (`withDeferredOutcomes`), so one there
 * repeats only its own outcome effect.
 */
function repeatedRef(effect: unknown): RepeatedRef | undefined {
  return findRef(effect, (ref) =>
    ref.ref === 'eachInvestigator' ||
    ref.ref === 'eachInvestigatorAt' ||
    ref.ref === 'eachEnemyAt' ||
    ref.ref === 'eachEnemy'
      ? ref
      : undefined,
  );
}

/** The first reference in `effect`, depth first, that `pick` returns something for. */
function findRef<R>(
  effect: unknown,
  pick: (ref: RelativeCard | RelativeInvestigator) => R | undefined,
): R | undefined {
  if (typeof effect !== 'object' || effect === null || isDeferred(effect)) return undefined;
  if (isRelative(effect)) {
    const picked = pick(effect);
    if (picked !== undefined) return picked;
  }
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
    case 'eachInvestigator':
      return playerOrder(state).map((inv) => inv.id);
    case 'eachInvestigatorAt': {
      const location = resolveRefs(each.location, refs) as InstanceId | undefined;
      if (location === undefined) return [];
      return playerOrder(state)
        .filter((inv) => inv.locationId === location)
        .map((inv) => inv.id);
    }
    case 'eachEnemyAt': {
      const location = resolveRefs(each.location, refs) as InstanceId | undefined;
      if (location === undefined) return [];
      return enemiesAt(state, location)
        .filter((card) => cardStats(ctx.cards, card.code).typeCode === 'enemy')
        .map((card) => card.id);
    }
    case 'eachEnemy': {
      const engagedWith =
        each.engagedWith === undefined ? undefined : resolveRefs(each.engagedWith, refs);
      if (each.engagedWith !== undefined && engagedWith === undefined) return [];
      return enemiesMatching(ctx, state, each)
        .filter(
          (card) =>
            engagedWith === undefined ||
            (card.zone.kind === 'engaged' && card.zone.investigatorId === engagedWith),
        )
        .map((card) => card.id);
    }
    default:
      return assertNever(each);
  }
}

/** The lead investigator, while they are still in the scenario. */
function activeLead(state: GameState): InvestigatorId | undefined {
  const lead = state.meta.leadInvestigator;
  return lead !== undefined && isActiveInvestigator(state, lead) ? lead : undefined;
}

function theOnlyCopy(state: GameState, code: CardCode): InstanceId | undefined {
  const copies = Object.values(state.cards).filter((card) => card.code === code);
  return copies.length === 1 ? copies[0]?.id : undefined;
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
  const stats = cardStats(ctx.cards, requireCard(state.cards, cardId).code);
  const limitReached =
    stats.locationAttachment?.onePerLocation === true &&
    locationAttachments(ctx, state, location).some(
      ({ card }) => cardStats(ctx.cards, card.code).name === stats.name,
    );
  return limitReached ? undefined : location.id;
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
      case 'onlyCopy':
        return refs.onlyCopy(value.code);
      case 'eachInvestigator':
      case 'eachInvestigatorAt':
      case 'eachEnemyAt':
      case 'eachEnemy':
        return refs.each;
      case 'nearestEnemy':
      case 'locationWith':
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
      if (value.ref === 'eachEnemyAt' || value.ref === 'eachInvestigatorAt') walk(value.location);
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

/**
 * A forced ability that fires when the card is revealed: its revelation for
 * an encounter card. The most common ability, written `whenRevealed(takeHorror(1))`.
 */
export function whenRevealed(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'revealed' }, effects };
}

/**
 * A forced ability "at the end of your turn" of a card in a threat area,
 * written `atEndOfTurn(skillTest('willpower', 3, { onPass: [discardSelf()] }))`.
 */
export function atEndOfTurn(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'turnEnds' }, effects };
}

/**
 * A forced ability "after you enter" a location, for the investigator who
 * entered, written `afterEntering(takeHorror(1))` (the Attic).
 */
export function afterEntering(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'entered' }, effects };
}

/**
 * A forced ability "at the end of each investigator's turn" of a card in play,
 * written `atEndOfEachTurn(readySelf())` (Umôrdhoth).
 */
export function atEndOfEachTurn(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'eachTurnEnds' }, effects };
}

/** A forced ability "when your turn begins" of a card in a threat area. */
export function whenTurnBegins(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'turnBegins' }, effects };
}

/**
 * A forced ability "at the end of the mythos phase" (or the investigation or
 * enemy phase), written `atEndOfPhase('mythos', placeDoomOnSelf(1))` (Wizard of the Order).
 */
export function atEndOfPhase(phase: EndingPhase, ...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'phaseEnds', phase }, effects };
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
  return { window: { kind: 'tested', action, outcome }, effects };
}

/** A forced ability "after [this enemy] engages you", written `afterEngaging(takeHorror(1))`. */
export function afterEngaging(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'engaged' }, effects };
}

/** A forced ability "when [this enemy] is defeated", written `whenDefeated(takeHorror(1, eachInvestigatorAt(itsLocation())))`. */
export function whenDefeated(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'defeated' }, effects };
}

/** A forced ability "after [this enemy] attacks you", written `afterAttacking(takeHorror(1))`. */
export function afterAttacking(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'attacked' }, effects };
}

/** A forced ability "after you discover clues at [this location]", written `afterDiscoveringClues(placeDoomOnSelf(1))`. */
export function afterDiscoveringClues(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'cluesDiscovered' }, effects };
}

/** A forced ability "at the end of the round", written `atEndOfRound(discardSelf())`. */
export function atEndOfRound(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'roundEnds' }, effects };
}

/**
 * An objective of an agenda or act that its current card fulfils when an
 * enemy of code `enemy` is defeated: "If the Ghoul Priest is defeated,
 * advance", written `whenEnemyDefeated(codes.ghoulPriest, advanceAct())`.
 */
export function whenEnemyDefeated(enemy: CardCode, ...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'enemyDefeated', enemy }, effects };
}

/**
 * The reverse side of an agenda or act, written
 * `whenAdvanced(revealLocation(onlyCopy(codes.parlor)))`.
 */
export function whenAdvanced(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'advanced' }, effects };
}

/**
 * "Test [skill] (difficulty)" for the investigator the window names, about
 * the card with the ability; `onPass` and `onFail` follow the answer. With
 * `perPointFailed`, the tester takes 1 damage or horror, or places 1 of their
 * clues on their location, for each point the test fails by, as the players
 * confirm it (`TestSkill.perPointFailed`).
 */
export function skillTest(
  skill: SkillName,
  difficulty: number,
  outcomes: {
    onPass?: AbilityEffect[];
    onFail?: AbilityEffect[];
    perPointFailed?: PerPointFailed;
  } = {},
): AbilityEffect {
  return {
    type: 'TestSkill',
    investigatorId: { ref: 'windowInvestigator' },
    cardId: { ref: 'self' },
    test: { skill, difficulty },
    onPass: outcomes.onPass ?? [],
    onFail: outcomes.onFail ?? [],
    ...(outcomes.perPointFailed ? { perPointFailed: outcomes.perPointFailed } : {}),
  };
}

/**
 * "Put it into play in your threat area": the card with the ability moves to
 * the threat area of the investigator the window names (the drawer).
 */
export function putIntoThreatArea(): AbilityEffect {
  return moveSelf({ kind: 'threatArea', investigatorId: { ref: 'windowInvestigator' } });
}

/**
 * "Attach it to your location": the card with the ability attaches to the
 * location of the investigator the window names, within its limit per
 * location (`{ ref: 'windowLocation' }`).
 */
export function attachToLocation(): AbilityEffect {
  return moveSelf({ kind: 'attachedTo', hostId: { ref: 'windowLocation' } });
}

/** "Discard it": the card with the ability, onto the top of the encounter discard (`DiscardCard`). */
export function discardSelf(): AbilityEffect {
  return { type: 'DiscardCard', cardId: { ref: 'self' } };
}

/**
 * "Take N damage": the investigator the window names takes `amount` damage,
 * or `who` does ("each investigator at its location takes 1 damage").
 */
export function takeDamage(
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'AdjustInvestigator', investigatorId: who, stat: 'damage', delta: amount };
}

/** "Take N horror", like `takeDamage`: Goat Spawn is `whenDefeated(takeHorror(1, eachInvestigatorAt(itsLocation())))`. */
export function takeHorror(
  amount: number,
  who: RelativeInvestigator = { ref: 'windowInvestigator' },
): AbilityEffect {
  return { type: 'AdjustInvestigator', investigatorId: who, stat: 'horror', delta: amount };
}

/**
 * "Each [unengaged] [[trait]] enemy" (`eachEnemy`), which repeats the effect
 * for each, written `eachEnemy({ trait: trait('Ghoul'), unengaged: true })`.
 */
export function eachEnemy(filter: EnemyFilter = {}): RelativeCard {
  return { ref: 'eachEnemy', ...filter };
}

/**
 * "Disengage from each non-[[Nightgaunt]] enemy engaged with you": each enemy
 * `filter` matches that is engaged with the investigator the window names
 * disengages (`DisengageEnemy`), written
 * `disengageFromEachEnemy({ withoutTrait: trait('Nightgaunt') })`.
 */
export function disengageFromEachEnemy(filter: EnemyFilter = {}): AbilityEffect {
  return {
    type: 'DisengageEnemy',
    enemyId: { ref: 'eachEnemy', ...filter, engagedWith: { ref: 'windowInvestigator' } },
  };
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

/** "A [[Central]] location" (`locationWith`), picked by the investigator the window names: `moveTo(locationWith(trait('Central')))`. */
export function locationWith(trait: Trait): RelativeCard {
  return { ref: 'locationWith', trait };
}

/**
 * "[Enemy] moves 1 location towards [location]" (`MoveEnemyTowards`), written
 * `moveEnemyTowards(eachEnemy({ trait: trait('Ghoul'), unengaged: true }), onlyCopy(codes.parlor))`.
 */
export function moveEnemyTowards(enemy: RelativeCard, location: RelativeCard): AbilityEffect {
  return { type: 'MoveEnemyTowards', enemyId: enemy, towards: location };
}

/** "Each investigator at [location]" (`eachInvestigatorAt`), which repeats the effect for each. */
export function eachInvestigatorAt(location: RelativeCard): RelativeInvestigator {
  return { ref: 'eachInvestigatorAt', location };
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

/** "Place N doom on the current agenda". */
export function placeDoomOnAgenda(amount: number): AbilityEffect {
  return { type: 'PlaceDoom', amount };
}

/** "Place N doom on [card]", such as `placeDoomOn(nearestEnemy(trait('Cultist')), 2)`. */
export function placeDoomOn(card: RelativeCard, amount: number): AbilityEffect {
  return { type: 'PlaceDoom', cardId: card, amount };
}

/** "The nearest [[trait]] enemy", or the nearest enemy without a trait (`{ ref: 'nearestEnemy' }`). */
export function nearestEnemy(trait?: Trait): RelativeCard {
  return trait === undefined ? { ref: 'nearestEnemy' } : { ref: 'nearestEnemy', trait };
}

/** "Place N doom on it": doom on the card with the ability. */
export function placeDoomOnSelf(amount: number): AbilityEffect {
  return { type: 'PlaceDoom', cardId: { ref: 'self' }, amount };
}

/** Heals up to `amount` damage from the enemy that has the ability ("heal 2 damage from it"). */
export function healSelf(amount: number): AbilityEffect {
  return { type: 'HealEnemy', enemyId: { ref: 'self' }, amount };
}

/** Readies the enemy that has the ability ("ready Umôrdhoth"). */
export function readySelf(): AbilityEffect {
  return { type: 'ReadyEnemy', enemyId: { ref: 'self' } };
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

/** "Discard each enemy in the Study", engaged ones included (`DiscardCard` each). */
export function discardEachEnemyAt(location: RelativeCard): AbilityEffect {
  return { type: 'DiscardCard', cardId: { ref: 'eachEnemyAt', location } };
}

/** "Remove the Study from the game". */
export function removeFromGame(card: RelativeCard): AbilityEffect {
  return { type: 'MoveCard', cardId: card, to: { kind: 'outOfGame' } };
}

/** "Advance": the current act advances without spending clues, as an objective does. */
export function advanceAct(): AbilityEffect {
  return { type: 'AdvanceAct' };
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
export function leadDrawsDiscardingUntil(match: EncounterMatch): AbilityEffect {
  return { type: 'DrawEncounter', investigatorId: { ref: 'lead' }, match, discardSkipped: true };
}

/**
 * "If it is act 3, …": `ability` fires only while the current act is one of
 * `acts`, written `duringAct([codes.whatHaveYouDone], whenAdvanced(…))`.
 */
export function duringAct(acts: readonly CardCode[], ability: Ability): Ability {
  return { ...ability, condition: { kind: 'currentAct', acts } };
}

/**
 * "If you have no clues, …": `ability` fires only while the investigator its
 * window names has `stat` within `range`, written
 * `ifYouHave('clues', { max: 0 }, whenRevealed(gainSurge()))` (False Lead).
 */
export function ifYouHave(stat: InvestigatorStat, range: StatRange, ability: Ability): Ability {
  return { ...ability, condition: { kind: 'investigatorHas', stat, ...range } };
}

/**
 * "If there are no [[Cultist]] enemies in play, …": `ability` fires only while
 * the number of enemies with `trait` on the table is within `range`, written
 * `ifEnemiesInPlay(trait('Cultist'), { max: 0 }, whenRevealed(…))` (Mysterious Chanting).
 */
export function ifEnemiesInPlay(trait: Trait, range: StatRange, ability: Ability): Ability {
  return { ...ability, condition: { kind: 'enemiesInPlay', trait, ...range } };
}

/**
 * "For each [[Ghoul]] enemy in the Hallway or Parlor, …": `ability`'s effects
 * resolve once per enemy `filter` matches as its window opens, written
 * `forEachEnemy({ trait: trait('Ghoul'), at: [codes.hallway, codes.parlor] }, atEndOfRound(placeDoomOnSelf(1)))`
 * (They're Getting Out!).
 */
export function forEachEnemy(filter: EnemyFilter, ability: Ability): Ability {
  return { ...ability, perEnemy: filter };
}

/**
 * "Search the encounter deck and discard pile for a [[Cultist]] enemy and
 * draw it": the investigator the window names draws the first card that
 * matches, deck first (`DrawEncounter` with `match`); nothing when none does.
 * The players would pick among the matches; the engine does not ask yet (#346).
 */
export function searchAndDraw(match: EncounterMatch): AbilityEffect {
  return {
    type: 'DrawEncounter',
    investigatorId: { ref: 'windowInvestigator' },
    from: 'deckOrDiscard',
    match,
  };
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
export function endScenario(resolution: ResolutionId): AbilityEffect {
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

/** One answer of a choice in card data: its label and what it does once picked. */
export interface ChoiceOption {
  id: string;
  /** i18n key. A part the engine does not track (player cards) is in the label only, for the players. */
  label: string;
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
 * An option that hits player cards ("draw 2 cards") runs only the rest of its
 * effects; the players do the player-card part at the table, as its label says.
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
        commands: option.effects,
      })),
    },
  };
}

/** "Reveal the Parlor". */
export function revealLocation(location: RelativeCard): AbilityEffect {
  return { type: 'RevealLocation', locationId: location };
}

/** "Put the set-aside Lita Chantler into play at the Parlor". */
export function putSetAsideIntoPlay(code: CardCode, location: RelativeCard): AbilityEffect {
  return { type: 'FromSetAside', codes: [code], to: { kind: 'atLocation', locationId: location } };
}

/**
 * "Spawn the Ghoul Priest in the Hallway": the enemy spawns at the location
 * named, engaging like any spawn (`SpawnEnemy`).
 */
export function spawnEnemyAt(enemy: RelativeCard, location: RelativeCard): AbilityEffect {
  return { type: 'SpawnEnemy', enemyId: enemy, at: location };
}

/** Moves the card with the ability ("Remove it from the game", "Put it into play in your threat area"). */
export function moveSelf(to: Templated<Zone>): AbilityEffect {
  return { type: 'MoveCard', cardId: { ref: 'self' }, to };
}
