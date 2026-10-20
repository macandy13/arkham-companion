import { assertNever } from '@arkham/util';
import { cardStats, type EngineContext } from './cards';
import type { Command } from './commands';
import type { Event } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import type { GameState } from './state';

/**
 * The moment a card ability fires (architecture "Triggers and card
 * effects"). `windowsOpenedBy` is the one place that turns events into
 * windows; a new window is a new case here and there.
 */
export type TimingWindow =
  /** The card is turned face up: a location revealed, or a drawn encounter card (its revelation). */
  { kind: 'revealed' };

/** A card an ability names relative to itself: the card that has the ability. */
export interface RelativeCard {
  ref: 'self';
}

/** An investigator an ability names relative to its window: the one the window names (the drawer). */
export interface RelativeInvestigator {
  ref: 'windowInvestigator';
}

/**
 * `T` with every instance and investigator ID replaced by a relative
 * reference, recursively. Card data is shared by every copy of a card, so it
 * can name no instance; `abilityCommands` fills the IDs in when the ability
 * fires. Map IDs stay as they are: a scenario's maps are fixed by its setup,
 * so card data may name one. No `AbilityCommand` holds a list yet; one that
 * does needs a list case in `resolveRefs`.
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
export type AbilityCommand = Extract<
  Command,
  { type: 'AdjustInvestigator' | 'PlaceDoom' | 'MoveCard' }
>;

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
 * The windows `event` opens. `events` is the whole batch it belongs to: a
 * drawn card is turned face up in the same batch as its `EncounterCardDrawn`,
 * which is the only record of who drew it.
 */
export function windowsOpenedBy(event: Event, events: readonly Event[]): OpenedWindow[] {
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
    default:
      return [];
  }
}

/**
 * The commands that resolve the abilities of the card `opened` names in its
 * window, read from its card data in `state`; none for a card without one.
 */
export function abilityCommands(
  ctx: EngineContext,
  state: GameState,
  opened: OpenedWindow,
): Command[] {
  const card = state.cards[opened.cardId];
  if (!card) return [];
  return (cardStats(ctx.cards, card.code).abilities ?? [])
    .filter((ability) => ability.window.kind === opened.window.kind)
    .flatMap((ability) => ability.effects.flatMap((effect) => effectCommands(effect, opened)));
}

/**
 * The command `effect` stands for, with its references resolved for
 * `opened`; none when one names nobody, such as `windowInvestigator` in a
 * window that names no investigator (a location revealed by a card effect).
 */
function effectCommands(effect: AbilityEffect, opened: OpenedWindow): Command[] {
  const resolved = resolveRefs(effect, opened);
  // The walk keeps every field but the references, which become the IDs the
  // command type expects, so the result is an `AbilityCommand`.
  return resolved === undefined ? [] : [resolved as AbilityCommand];
}

function resolveRefs(value: unknown, opened: OpenedWindow): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (isRelative(value)) {
    switch (value.ref) {
      case 'self':
        return opened.cardId;
      case 'windowInvestigator':
        return opened.investigatorId;
      default:
        return assertNever(value);
    }
  }
  const entries = Object.entries(value).map(([key, field]) => [key, resolveRefs(field, opened)]);
  return entries.some(([, field]) => field === undefined) ? undefined : Object.fromEntries(entries);
}

function isRelative(value: object): value is RelativeCard | RelativeInvestigator {
  return 'ref' in value;
}
