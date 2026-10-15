/**
 * Branded ID types. They are plain strings at runtime; the brand only stops
 * mixing up e.g. a card instance ID with an investigator ID at compile time.
 */
/**
 * Adds a compile-time-only tag `B` to `T`. Also used outside IDs for open-ended
 * string sets such as `Trait`.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Unique ID of one physical card on the table (see architecture §5). */
export type InstanceId = Brand<string, 'InstanceId'>;
/** ID of an `Investigator` in `GameState.investigators`. */
export type InvestigatorId = Brand<string, 'InvestigatorId'>;
/** ID of a map in `Board.maps` (a scenario can have several). */
export type MapId = Brand<string, 'MapId'>;
/** ID of a layout slot in `Board.slots`. */
export type SlotId = Brand<string, 'SlotId'>;
/** ID of a pending `Decision`. */
export type DecisionId = Brand<string, 'DecisionId'>;

/** Constructors that tag a plain string with the matching ID brand. */
export const instanceId = (id: string) => id as InstanceId;
export const investigatorId = (id: string) => id as InvestigatorId;
export const mapId = (id: string) => id as MapId;
export const slotId = (id: string) => id as SlotId;
export const decisionId = (id: string) => id as DecisionId;
