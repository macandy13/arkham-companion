import type { CampaignDefinitionId, CampaignId, InvestigatorCode, ScenarioId } from '../ids';
import type { ChaosToken, Difficulty } from '../state';
import type { InvestigatorFate, StoryValue, TraumaKind, XpAccount } from './campaign_log';

/**
 * Intents for the campaign aggregate, kept apart from the game's `Command`:
 * a campaign outlives each game and has its own event log. `handleCampaign`
 * validates them against the `CampaignLog` and produces `CampaignEvent`s.
 */
export type CampaignCommand =
  | StartCampaign
  | RecordStory
  | AddChaosToken
  | RemoveChaosToken
  | AwardXp
  | SpendXp
  | AddTrauma
  | MarkKilled
  | MarkInsane
  | ReplaceInvestigator
  | AdvanceScenario
  | AdjustCampaign;

/** The `type` of every campaign command. */
export type CampaignCommandType = CampaignCommand['type'];

/**
 * Starts a campaign with 1–4 investigators, the starting chaos bag of the
 * chosen difficulty and the scenario order. `compileCampaign` builds it from
 * a `CampaignDefinition`. Produces `CampaignStarted`.
 */
export interface StartCampaign {
  readonly type: 'StartCampaign';
  readonly campaignId: CampaignId;
  /** `CampaignDefinition.id`. */
  readonly definitionId: CampaignDefinitionId;
  readonly difficulty: Difficulty;
  /** The team in seat order; the handler looks up their printed stats in the `CardDb`. */
  readonly investigators: readonly InvestigatorCode[];
  readonly chaosBag: readonly ChaosToken[];
  /** At least one `ScenarioDefinition.id`, in campaign order. */
  readonly scenarioIds: readonly ScenarioId[];
}

/**
 * Writes a story record, replacing any earlier value of the same kind
 * (crossing out a name or counting up is recording the new value). A record
 * never changes kind, which catches a resolution writing to the wrong key;
 * `AdjustCampaign` `removeStory` clears it first if it really must.
 * Produces `StoryRecorded`.
 */
export interface RecordStory {
  readonly type: 'RecordStory';
  readonly key: string;
  readonly value: StoryValue;
}

/** Adds one token to the campaign's chaos bag (a resolution or card effect). Produces `ChaosTokenAdded`. */
export interface AddChaosToken {
  readonly type: 'AddChaosToken';
  readonly token: ChaosToken;
}

/** Removes one copy of a token from the campaign's chaos bag. Produces `ChaosTokenRemoved`. */
export interface RemoveChaosToken {
  readonly type: 'RemoveChaosToken';
  readonly token: ChaosToken;
}

/** Gives a living team member XP (positive integer). Produces `XpChanged` on `earned`. */
export interface AwardXp {
  readonly type: 'AwardXp';
  readonly code: InvestigatorCode;
  readonly amount: number;
}

/**
 * Records XP the players spent on deck upgrades (positive integer, at most
 * the XP still available). The upgrades themselves stay with the players
 * (architecture §8). Produces `XpChanged` on `spent`.
 */
export interface SpendXp {
  readonly type: 'SpendXp';
  readonly code: InvestigatorCode;
  readonly amount: number;
}

/**
 * Gives a living team member trauma (positive integer). Produces
 * `TraumaChanged`, then `InvestigatorFateChanged` when the trauma reaches
 * their health (killed) or sanity (insane), per the Rules Reference.
 */
export interface AddTrauma {
  readonly type: 'AddTrauma';
  readonly code: InvestigatorCode;
  readonly kind: TraumaKind;
  readonly amount: number;
}

/** A living team member is killed (a resolution or story effect). Produces `InvestigatorFateChanged`. */
export interface MarkKilled {
  readonly type: 'MarkKilled';
  readonly code: InvestigatorCode;
}

/** A living team member is driven insane. Produces `InvestigatorFateChanged`. */
export interface MarkInsane {
  readonly type: 'MarkInsane';
  readonly code: InvestigatorCode;
}

/**
 * A player whose investigator was killed or driven insane picks a new one
 * (Rules Reference, "Campaign Play"). The new investigator takes the old
 * one's seat and starts without trauma or XP; the old one moves to
 * `formerInvestigators`. Produces `InvestigatorReplaced`.
 */
export interface ReplaceInvestigator {
  readonly type: 'ReplaceInvestigator';
  /** Code of the killed or insane team member. */
  readonly code: InvestigatorCode;
  /** The newcomer, looked up in the `CardDb` like the starting team. */
  readonly by: InvestigatorCode;
}

/**
 * Moves on to the next scenario of the campaign. The caller sends it once the
 * current scenario is resolved; the handler only refuses it past the last
 * scenario. Produces `ScenarioPositionChanged`.
 */
export interface AdvanceScenario {
  readonly type: 'AdvanceScenario';
}

/**
 * A correction by the players ("assistant, not referee"), for what the
 * regular commands cannot undo: lowering XP or trauma, reviving an
 * investigator, deleting a story record or moving the scenario position.
 * Adding tokens, XP or records goes through the regular commands. Every
 * correction must leave the log consistent (`checkCampaignInvariants`); it
 * does not cascade, so e.g. raising trauma to the limit here is rejected
 * instead of killing the investigator - use `AddTrauma` for that.
 */
export interface AdjustCampaign {
  readonly type: 'AdjustCampaign';
  readonly adjustment: CampaignAdjustment;
}

/** The corrections an `AdjustCampaign` can make; each produces the matching regular event. */
export type CampaignAdjustment =
  | {
      readonly kind: 'xp';
      readonly code: InvestigatorCode;
      readonly account: XpAccount;
      readonly delta: number;
    }
  | {
      readonly kind: 'trauma';
      readonly code: InvestigatorCode;
      readonly trauma: TraumaKind;
      readonly delta: number;
    }
  | { readonly kind: 'fate'; readonly code: InvestigatorCode; readonly fate: InvestigatorFate }
  | { readonly kind: 'removeStory'; readonly key: string }
  | { readonly kind: 'position'; readonly position: number };
