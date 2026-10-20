import { cardStats, type EngineContext } from './cards';
import type { Command } from './commands';
import type { Event } from './events';
import type { InstanceId, InvestigatorId } from './ids';
import type { GameState, InvestigatorStat } from './state';
import type { Zone } from './zone';

/**
 * The moment a card ability fires (architecture "Triggers and card
 * effects"). `windowsOpenedBy` is the one place that turns events into
 * windows; a new window is a new case here and there.
 */
export type TimingWindow =
  /** The card is turned face up: a location revealed, or a drawn encounter card (its revelation). */
  { kind: 'revealed' };

/**
 * A zone named by its kind alone, without a location, investigator or host
 * (the encounter discard, out of the game, set aside, …): the only zones
 * card data can name, since it holds no instance IDs.
 */
export type UnplacedZone = Exclude<
  Zone,
  { mapId: unknown } | { locationId: unknown } | { investigatorId: unknown } | { hostId: unknown }
>;

/**
 * One building block of what an ability does, as data. Each mirrors the
 * command it becomes, with a target named relative to the ability (the card
 * itself, the investigator the window names, the current agenda) instead of
 * an instance ID, which card data shared by every copy cannot hold.
 * `abilityCommands` resolves the target and builds the command.
 */
export type AbilityEffect =
  /**
   * `AdjustInvestigator` on the investigator the window names ("Revelation –
   * Take 1 horror"). Nothing happens in a window that names nobody, such as
   * a location revealed by a card effect.
   */
  | { kind: 'adjustInvestigator'; stat: InvestigatorStat; delta: number }
  /**
   * `PlaceDoom` on the card itself or the current agenda ("Place 1 doom on
   * the current agenda"). Kept apart from investigator stats because doom
   * carries agenda rules of its own: placing it never advances the agenda
   * (that waits for the mythos phase's threshold check), and a card that
   * says otherwise would add its flag here.
   */
  | { kind: 'placeDoom'; on: 'self' | 'currentAgenda'; amount: number }
  /** `MoveCard` of the card itself ("Remove it from the game", "Shuffle it back into the encounter deck"). */
  | { kind: 'moveSelf'; to: UnplacedZone };

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
    case 'adjustInvestigator':
      return opened.investigatorId === undefined
        ? []
        : [
            {
              type: 'AdjustInvestigator',
              investigatorId: opened.investigatorId,
              stat: effect.stat,
              delta: effect.delta,
            },
          ];
    case 'placeDoom':
      return [
        {
          type: 'PlaceDoom',
          amount: effect.amount,
          ...(effect.on === 'self' && { cardId: opened.cardId }),
        },
      ];
    case 'moveSelf':
      return [{ type: 'MoveCard', cardId: opened.cardId, to: effect.to }];
  }
}
