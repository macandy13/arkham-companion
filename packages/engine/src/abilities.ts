import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import type { Command, TestSkill } from './commands';
import { isInPlay } from './doom';
import type { Event } from './events';
import type { CardCode, InstanceId, InvestigatorId } from './ids';
import { locationAttachments } from './board';
import { isActiveInvestigator, requireInvestigator } from './investigators';
import { cardsInZone, requireCard } from './lookup';
import type { GameState, Investigator, QueuedStep, SkillName } from './state';
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
  /** "At the end of the round", upkeep step 4.6, for every card in play; names no investigator. */
  | { kind: 'roundEnds' }
  /**
   * The agenda or act advanced: its reverse side, opened by `AgendaAdvanced`
   * or `ActAdvanced` for that card while it is still current (`completeAdvance`
   * replaces it afterwards); names no investigator.
   */
  | { kind: 'advanced' };

/**
 * A card an ability names without an instance ID: the card that has the
 * ability, one its window names, or a scenario's unique card by code.
 */
export type RelativeCard =
  | { ref: 'self' }
  /**
   * The location of the investigator the window names (the drawer's
   * location), unless the card's limit of one per location is reached there
   * (`LocationAttachment.onePerLocation`): then none, so a revelation that
   * would attach it there does nothing.
   */
  | { ref: 'windowLocation' }
  /**
   * The one copy of `code` in the game, in whatever zone: for a scenario's
   * unique cards ("the Parlor", "the Ghoul Priest"); none while the game holds
   * no copy or several, and the effect is skipped with `AbilityEffectSkipped`.
   */
  | { ref: 'onlyCopy'; code: CardCode };

/** An investigator an ability names relative to its window: the one the window names (the drawer). */
export interface RelativeInvestigator {
  ref: 'windowInvestigator';
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
          | 'SpawnEnemy';
      }
    >
  | AbilityTest;

/**
 * `TestSkill` with outcomes that are ability commands too, so a test in card
 * data can only lead to what card data may do.
 */
export type AbilityTest = Omit<TestSkill, 'onPass' | 'onFail'> & {
  onPass: readonly AbilityCommand[];
  onFail: readonly AbilityCommand[];
};

/**
 * One step of what an ability does: an allowed command written with
 * relative references instead of IDs ("Revelation – Take 1 horror" is
 * `AdjustInvestigator` on `{ ref: 'windowInvestigator' }`). Reusing the
 * command types keeps one vocabulary: a new kind of effect is a command
 * added to `AbilityCommand`, not a new effect type.
 */
export type AbilityEffect = Templated<AbilityCommand>;

/**
 * A forced card ability: what it does when its window opens. Card data
 * holds a list of them (`CardStats.abilities`); several abilities of one card
 * in one window resolve in the order they are listed.
 */
export interface Ability {
  window: TimingWindow;
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
    case 'TurnEnded': {
      const { investigatorId } = event;
      return cardsInZone(state, { kind: 'threatArea', investigatorId }).map((cardId) => ({
        window: { kind: 'turnEnds' },
        cardId,
        investigatorId,
      }));
    }
    case 'RoundEnded':
      return Object.values(state.cards)
        .filter((card) => isInPlay(state, card))
        .map((card) => ({ window: { kind: 'roundEnds' }, cardId: card.id }));
    case 'AgendaAdvanced':
    case 'ActAdvanced':
      return [{ window: { kind: 'advanced' }, cardId: event.cardId }];
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
    .filter((ability) => ability.window.kind === opened.window.kind)
    .flatMap((ability) => ability.effects)
    .map((effect) => ({ kind: 'ability', effect, opened, origin: effect.type }));
}

/** An effect waiting to resolve: the queue step `abilitySteps` produces. */
export type AbilityStep = Extract<QueuedStep, { kind: 'ability' }>;

/**
 * The command `effect` stands for in `state`, with its references resolved
 * for `opened`; none when one names nobody, such as `windowInvestigator` in
 * a window that names no investigator (a location revealed by a card
 * effect), or one who has left the scenario meanwhile (defeated by an
 * earlier effect of the same revelation), whose threat area and tests are
 * gone with them.
 */
export function resolveEffect(
  ctx: EngineContext,
  state: GameState,
  effect: AbilityEffect,
  opened: OpenedWindow,
): Command | undefined {
  const { investigatorId } = opened;
  const investigator =
    investigatorId !== undefined && isActiveInvestigator(state, investigatorId)
      ? requireInvestigator(state, investigatorId)
      : undefined;
  const resolved = resolveRefs(effect, {
    self: opened.cardId,
    windowInvestigator: investigator?.id,
    windowLocation: investigator && attachableLocation(ctx, state, opened.cardId, investigator),
    onlyCopy: (code) => theOnlyCopy(state, code),
  });
  // The walk keeps every field but the references, which become the IDs the
  // command type expects, so the result is an `AbilityCommand`.
  return resolved === undefined ? undefined : (resolved as AbilityCommand);
}

/** What each relative reference stands for when an effect resolves; absent when it names nobody. */
interface ResolvedRefs {
  self: InstanceId;
  windowInvestigator: InvestigatorId | undefined;
  windowLocation: InstanceId | undefined;
  onlyCopy: (code: CardCode) => InstanceId | undefined;
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
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    // An outcome that names nobody drops the whole test: half a test's consequences would misstate the card.
    const items = value.map((item: unknown) => resolveRefs(item, refs));
    return items.includes(undefined) ? undefined : items;
  }
  if (isRelative(value)) {
    switch (value.ref) {
      case 'self':
        return refs.self;
      case 'windowInvestigator':
        return refs.windowInvestigator;
      case 'windowLocation':
        return refs.windowLocation;
      case 'onlyCopy':
        return refs.onlyCopy(value.code);
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

/** A forced ability "at the end of the round", written `atEndOfRound(discardSelf())`. */
export function atEndOfRound(...effects: AbilityEffect[]): Ability {
  return { window: { kind: 'roundEnds' }, effects };
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
 * the card with the ability; `onPass` and `onFail` follow the answer.
 */
export function skillTest(
  skill: SkillName,
  difficulty: number,
  outcomes: { onPass?: AbilityEffect[]; onFail?: AbilityEffect[] } = {},
): AbilityEffect {
  return {
    type: 'TestSkill',
    investigatorId: { ref: 'windowInvestigator' },
    cardId: { ref: 'self' },
    test: { skill, difficulty },
    onPass: outcomes.onPass ?? [],
    onFail: outcomes.onFail ?? [],
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

/** "Take N damage": the investigator the window names takes `amount` damage. */
export function takeDamage(amount: number): AbilityEffect {
  return adjustWindowInvestigator('damage', amount);
}

/** "Take N horror": the investigator the window names takes `amount` horror. */
export function takeHorror(amount: number): AbilityEffect {
  return adjustWindowInvestigator('horror', amount);
}

/** "Place N doom on the current agenda". */
export function placeDoomOnAgenda(amount: number): AbilityEffect {
  return { type: 'PlaceDoom', amount };
}

/** "Place N doom on it": doom on the card with the ability. */
export function placeDoomOnSelf(amount: number): AbilityEffect {
  return { type: 'PlaceDoom', cardId: { ref: 'self' }, amount };
}

/** The one copy of `code` in the game, for a scenario's unique cards (`{ ref: 'onlyCopy' }`). */
export function onlyCopy(code: CardCode): RelativeCard {
  return { ref: 'onlyCopy', code };
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

function adjustWindowInvestigator(stat: 'damage' | 'horror', delta: number): AbilityEffect {
  return { type: 'AdjustInvestigator', investigatorId: { ref: 'windowInvestigator' }, stat, delta };
}
