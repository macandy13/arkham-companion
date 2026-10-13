/**
 * Branded ID types. They are plain strings at runtime; the brand only stops
 * mixing up e.g. a card instance ID with an investigator ID at compile time.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Unique ID of one physical card on the table (see architecture §5). */
export type InstanceId = Brand<string, 'InstanceId'>;
export type InvestigatorId = Brand<string, 'InvestigatorId'>;
export type MapId = Brand<string, 'MapId'>;
export type SlotId = Brand<string, 'SlotId'>;
export type DecisionId = Brand<string, 'DecisionId'>;

export const instanceId = (id: string) => id as InstanceId;
export const investigatorId = (id: string) => id as InvestigatorId;
export const mapId = (id: string) => id as MapId;
export const slotId = (id: string) => id as SlotId;
export const decisionId = (id: string) => id as DecisionId;
