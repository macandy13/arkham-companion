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

/**
 * One building block of what an ability does, as data. `abilityCommands`
 * turns it into the commands that resolve it, so card data never holds code
 * or instance IDs.
 */
export type AbilityEffect =
  /**
   * The investigator the window names takes damage or horror ("Revelation –
   * Take 1 horror"). Nothing happens in a window that names nobody, such as
   * a location revealed by a card effect.
   */
  | { kind: 'hurt'; stat: 'damage' | 'horror'; amount: number }
  /** Doom on the current agenda ("Place 1 doom on the current agenda"). */
  | { kind: 'placeDoomOnAgenda'; amount: number }
  /** The card with the ability is removed from the game. */
  | { kind: 'removeFromGame' };

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

function effectCommands(effect: AbilityEffect, opened: OpenedWindow): Command[] {
  switch (effect.kind) {
    case 'hurt':
      return opened.investigatorId === undefined
        ? []
        : [
            {
              type: 'AdjustInvestigator',
              investigatorId: opened.investigatorId,
              stat: effect.stat,
              delta: effect.amount,
            },
          ];
    case 'placeDoomOnAgenda':
      return [{ type: 'PlaceDoom', amount: effect.amount }];
    case 'removeFromGame':
      return [{ type: 'MoveCard', cardId: opened.cardId, to: { kind: 'outOfGame' } }];
  }
}
