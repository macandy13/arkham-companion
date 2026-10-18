import type { InstanceId, InvestigatorId, MapId } from './ids';

/** Where a card instance currently is (architecture "Game state"). */
export type Zone =
  | { kind: 'encounterDeck' }
  | { kind: 'encounterDiscard' }
  | { kind: 'setAside' }
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
  /** Attachment to a location, enemy, agenda, … */
  | { kind: 'attachedTo'; hostId: InstanceId };

/** Discriminator of `Zone`. */
export type ZoneKind = Zone['kind'];

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
      return `${zone.kind}:${zone.investigatorId}` as ZoneKey;
    case 'attachedTo':
      return `attachedTo:${zone.hostId}` as ZoneKey;
    default:
      return zone.kind as ZoneKey;
  }
}

/** True if both zones are the same place (same `zoneKey`). */
export function sameZone(a: Zone, b: Zone): boolean {
  return zoneKey(a) === zoneKey(b);
}

/** The encounter deck, shared by all investigators; its order is top first. */
export const encounterDeck: Zone = { kind: 'encounterDeck' };

/** The encounter discard pile; its order is top first. */
export const encounterDiscard: Zone = { kind: 'encounterDiscard' };

/** Cards the scenario set aside, out of play until a card or setup brings them in. */
export const setAside: Zone = { kind: 'setAside' };

/** The zone of an unengaged card at a location, e.g. an enemy that spawned there. */
export function atLocation(locationId: InstanceId): Zone {
  return { kind: 'atLocation', locationId };
}

/** The zone of an enemy engaged with an investigator. */
export function engagedWith(investigatorId: InvestigatorId): Zone {
  return { kind: 'engaged', investigatorId };
}

/** The zone of a non-enemy card in an investigator's threat area. */
export function threatAreaOf(investigatorId: InvestigatorId): Zone {
  return { kind: 'threatArea', investigatorId };
}

/** The zone of a card attached to another card (a location, an enemy, an agenda, …). */
export function attachedTo(hostId: InstanceId): Zone {
  return { kind: 'attachedTo', hostId };
}
