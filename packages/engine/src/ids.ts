/**
 * Branded ID types. They are plain strings at runtime; the brand only stops
 * mixing up e.g. a card instance ID with an investigator ID at compile time.
 */
/**
 * Adds a compile-time-only tag `B` to `T`. Also used outside IDs for open-ended
 * string sets such as `Trait`.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Unique ID of one physical card on the table (see architecture "Game state"). */
export type InstanceId = Brand<string, 'InstanceId'>;
/** ID of an `Investigator` in `GameState.investigators`. */
export type InvestigatorId = Brand<string, 'InvestigatorId'>;
/** ArkhamDB card code, e.g. '01111' for the Study; `CardStats.code` and `CardInstance.code`. */
export type CardCode = Brand<string, 'CardCode'>;
/**
 * ArkhamDB card code of an investigator card, e.g. '01001' for Roland Banks.
 * Unlike `InvestigatorId` it names the investigator, not one seat in one game,
 * so the campaign log keys its team by it. A `CardCode` with a second tag, so
 * it can look up its card in the `CardDb` but a plain card code is no
 * investigator code.
 */
export type InvestigatorCode = CardCode & { readonly __investigatorCode: true };
/**
 * The printed name of a card as a player says it ("Hallway", "Swarm of Rats"),
 * for what the views show and the matchers compare. A name is not an identity:
 * several copies of a card share it, so `InstanceId` stays the exact reference.
 * Compared with `comparableName` (case and a trailing full stop do not matter).
 */
export type CardName = Brand<string, 'CardName'>;
/** ArkhamDB encounter set code, e.g. 'rats'; `CardStats.encounterCode`. */
export type EncounterSetCode = Brand<string, 'EncounterSetCode'>;
/** `ScenarioDefinition.id`, e.g. 'the-gathering'; wherever a game or campaign refers to a scenario. */
export type ScenarioId = Brand<string, 'ScenarioId'>;
/** `CampaignDefinition.id`, e.g. 'night-of-the-zealot'; `CampaignLog.definitionId`. */
export type CampaignDefinitionId = Brand<string, 'CampaignDefinitionId'>;
/** UUID (v4) identifying one game; never device-bound so it stays valid for later cloud sync (architecture "Persistence"). */
export type GameId = Brand<string, 'GameId'>;
/**
 * ID of one campaign play-through (`CampaignLog.campaignId`), chosen by the
 * caller of `compileStart`; the games of a campaign carry it as
 * `GameSummary.campaignId`.
 */
export type CampaignId = Brand<string, 'CampaignId'>;
/** ID of a map in `Board.maps` (a scenario can have several). */
export type MapId = Brand<string, 'MapId'>;
/** ID of a pending `Decision`. */
export type DecisionId = Brand<string, 'DecisionId'>;

/** Constructors that tag a plain string with the matching ID brand. */
export const instanceId = (id: string) => id as InstanceId;
export const investigatorId = (id: string) => id as InvestigatorId;
export const investigatorCode = (code: string) => code as InvestigatorCode;
export const cardCode = (code: string) => code as CardCode;
export const cardName = (name: string) => name as CardName;
export const encounterSetCode = (code: string) => code as EncounterSetCode;
export const scenarioId = (id: string) => id as ScenarioId;
export const campaignDefinitionId = (id: string) => id as CampaignDefinitionId;
export const gameId = (id: string) => id as GameId;
export const campaignId = (id: string) => id as CampaignId;
export const mapId = (id: string) => id as MapId;
export const decisionId = (id: string) => id as DecisionId;
