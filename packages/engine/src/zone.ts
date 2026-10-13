import type { InstanceId, InvestigatorId, MapId } from './ids';

/** Where a card instance currently is (architecture §5). */
export type Zone =
  | { kind: 'encounterDeck' }
  | { kind: 'encounterDiscard' }
  | { kind: 'setAside' }
  | { kind: 'victoryDisplay' }
  | { kind: 'outOfGame' }
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
