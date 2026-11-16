import type { RelativeCard, RelativeInvestigator } from './abilities';
import type { InstanceId, InvestigatorId, MapId } from './ids';

/** Where a card instance currently is (architecture "Game state"). */
export type Zone =
  | { kind: 'encounterDeck' }
  | { kind: 'encounterDiscard' }
  | { kind: 'setAside' }
  /** A deck of the scenario's own, apart from the encounter deck (The Midnight Masks' Cultist deck). */
  | { kind: 'scenarioDeck'; deck: ScenarioDeck }
  | { kind: 'victoryDisplay' }
  | { kind: 'outOfGame' }
  /**
   * A drawn encounter card whose revelation is still being resolved (its
   * revelation test is pending). Rules Reference, "Revelation": the card is
   * discarded only once the revelation has resolved, so it waits here.
   */
  | { kind: 'resolving' }
  | { kind: 'agendaDeck' }
  | { kind: 'actDeck' }
  /** Location card on a map. */
  | { kind: 'location'; mapId: MapId }
  /** Unengaged enemy (or other card) at a location. */
  | { kind: 'atLocation'; locationId: InstanceId }
  /**
   * Enemy engaged with an investigator. By the rules this is part of their
   * threat area; it is a separate zone so the engine knows about engagement
   * without looking up card types (state only stores card codes).
   */
  | { kind: 'engaged'; investigatorId: InvestigatorId }
  /** Non-enemy cards in an investigator's threat area (treacheries, …). */
  | { kind: 'threatArea'; investigatorId: InvestigatorId }
  /**
   * A card an investigator controls in their play area: a story asset they took control of
   * (Lita Chantler). Player cards are not modelled, so only encounter cards come here.
   */
  | { kind: 'playArea'; investigatorId: InvestigatorId }
  /** Attachment to a location, enemy, agenda, … */
  | { kind: 'attachedTo'; hostId: InstanceId }
  /**
   * Beneath another card, out of play: our reading of RR "In Play and Out of Play" (only cards in a
   * threat area or at a location are in play), as the Smoke and Mirrors guide separates "in play"
   * from "beneath a location". It holds the facedown suspects
   * Smoke and Mirrors deals beneath its locations, the interviewed ones placed beneath the act.
   * `CardInstance.faceUp` says whether the players may look at it; the act's action draws a
   * facedown one (`DrawBeneath`).
   */
  | { kind: 'beneath'; hostId: InstanceId };

/**
 * The scenario decks a setup can build (`ScenarioDeckStep`), one name per deck a scenario
 * prints. Cards are drawn from the top with `DrawFromScenarioDeck`.
 */
export type ScenarioDeck = 'cultist';

/** Discriminator of `Zone`. */
export type ZoneKind = Zone['kind'];

/** The zone of one kind, so a helper's result fits both a `Zone` and card data's `Templated<Zone>`. */
export type ZoneOf<K extends ZoneKind> = Extract<Zone, { kind: K }>;

/** Stable string key of a zone, used to index `GameState.order`. */
export type ZoneKey = string & { readonly __brand: 'ZoneKey' };

/** Maps a zone to its key; zones with the same kind and reference share a key. */
export function zoneKey(zone: Zone): ZoneKey {
  switch (zone.kind) {
    case 'location':
      return `location:${zone.mapId}` as ZoneKey;
    case 'atLocation':
      return `atLocation:${zone.locationId}` as ZoneKey;
    case 'engaged':
    case 'threatArea':
    case 'playArea':
      return `${zone.kind}:${zone.investigatorId}` as ZoneKey;
    case 'attachedTo':
    case 'beneath':
      return `${zone.kind}:${zone.hostId}` as ZoneKey;
    case 'scenarioDeck':
      return `scenarioDeck:${zone.deck}` as ZoneKey;
    default:
      return zone.kind as ZoneKey;
  }
}

/** True if both zones are the same place (same `zoneKey`). */
export function sameZone(a: Zone, b: Zone): boolean {
  return zoneKey(a) === zoneKey(b);
}

/** The encounter deck, shared by all investigators; its order is top first. */
export const encounterDeck: ZoneOf<'encounterDeck'> = { kind: 'encounterDeck' };

/** The encounter discard pile; its order is top first. */
export const encounterDiscard: ZoneOf<'encounterDiscard'> = { kind: 'encounterDiscard' };

/** Cards the scenario set aside, out of play until a card or setup brings them in. */
export const setAside: ZoneOf<'setAside'> = { kind: 'setAside' };

/** Cards out of the scenario: removed from the game, or back with the player who owns them. */
export const outOfGame: ZoneOf<'outOfGame'> = { kind: 'outOfGame' };

/** A drawn encounter card while its revelation resolves. */
export const resolvingZone: ZoneOf<'resolving'> = { kind: 'resolving' };

/** Cards worth victory points the players have earned this scenario, counted at its end. */
export const victoryDisplay: ZoneOf<'victoryDisplay'> = { kind: 'victoryDisplay' };

/** A scenario deck of the scenario's own; its order is top first. */
export function scenarioDeck(deck: ScenarioDeck): ZoneOf<'scenarioDeck'> {
  return { kind: 'scenarioDeck', deck };
}

/**
 * The zone of an unengaged card at a location, e.g. an enemy that spawned there. Like the other
 * zone helpers it takes a reference in card data: `atLocation(onlyCopy(codes.parlor))`.
 */
export function atLocation<L extends InstanceId | RelativeCard>(
  locationId: L,
): { kind: 'atLocation'; locationId: L } {
  return { kind: 'atLocation', locationId };
}

/** The zone of an enemy engaged with an investigator. */
export function engagedWith<I extends InvestigatorId | RelativeInvestigator>(
  investigatorId: I,
): { kind: 'engaged'; investigatorId: I } {
  return { kind: 'engaged', investigatorId };
}

/** The zone of a non-enemy card in an investigator's threat area; `threatAreaOf(you())` in card data. */
export function threatAreaOf<I extends InvestigatorId | RelativeInvestigator>(
  investigatorId: I,
): { kind: 'threatArea'; investigatorId: I } {
  return { kind: 'threatArea', investigatorId };
}

/** The zone of a card `investigatorId` controls (`takeControl`). */
export function playAreaOf<I extends InvestigatorId | RelativeInvestigator>(
  investigatorId: I,
): { kind: 'playArea'; investigatorId: I } {
  return { kind: 'playArea', investigatorId };
}

/** The zone of a card attached to another card (a location, an enemy, an agenda, …). */
export function attachedTo<H extends InstanceId | RelativeCard>(
  hostId: H,
): { kind: 'attachedTo'; hostId: H } {
  return { kind: 'attachedTo', hostId };
}
