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
  | { kind: 'engaged'; investigatorId: InvestigatorId }
  | { kind: 'threatArea'; investigatorId: InvestigatorId }
  /** Attachment to a location, enemy, agenda, … */
  | { kind: 'attachedTo'; hostId: InstanceId };

export type ZoneKind = Zone['kind'];

/** Stable string key of a zone, used to index `GameState.order`. */
export type ZoneKey = string & { readonly __brand: 'ZoneKey' };

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

export function sameZone(a: Zone, b: Zone): boolean {
  return zoneKey(a) === zoneKey(b);
}
