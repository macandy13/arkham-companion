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
  | CampaignManualAdjust;

/** The `type` of every campaign command. */
export type CampaignCommandType = CampaignCommand['type'];

/**
 * An investigator as they join the campaign: card code plus printed health
 * and sanity (looked up in the `CardDb` by the caller, so the campaign log
 * needs no card data). They start without trauma or XP.
 */
export interface JoiningInvestigator {
  readonly code: string;
  readonly health: number;
  readonly sanity: number;
}

/**
 * Starts a campaign with 1–4 investigators, the starting chaos bag of the
 * chosen difficulty and the scenario order. `compileCampaign` builds it from
 * a `CampaignDefinition`. Produces `CampaignStarted`.
 */
export interface StartCampaign {
  readonly type: 'StartCampaign';
  readonly campaignId: string;
  /** `CampaignDefinition.id`. */
  readonly definitionId: string;
  readonly difficulty: Difficulty;
  readonly investigators: readonly JoiningInvestigator[];
  readonly chaosBag: readonly ChaosToken[];
  /** At least one `ScenarioDefinition.id`, in campaign order. */
  readonly scenarioIds: readonly string[];
}

/**
 * Writes a story record, replacing any earlier value of the same kind
 * (crossing out a name or counting up is recording the new value). A record
 * never changes kind, which catches a resolution writing to the wrong key;
 * `ManualAdjust` `removeStory` clears it first if it really must.
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
  readonly code: string;
  readonly amount: number;
}

/**
 * Records XP the players spent on deck upgrades (positive integer, at most
 * the XP still available). The upgrades themselves stay with the players
 * (architecture §8). Produces `XpChanged` on `spent`.
 */
export interface SpendXp {
  readonly type: 'SpendXp';
  readonly code: string;
  readonly amount: number;
}

/**
 * Gives a living team member trauma (positive integer). Produces
 * `TraumaChanged`, then `InvestigatorFateChanged` when the trauma reaches
 * their health (killed) or sanity (insane), per the Rules Reference.
 */
export interface AddTrauma {
  readonly type: 'AddTrauma';
  readonly code: string;
  readonly kind: TraumaKind;
  readonly amount: number;
}

/** A living team member is killed (a resolution or story effect). Produces `InvestigatorFateChanged`. */
export interface MarkKilled {
  readonly type: 'MarkKilled';
  readonly code: string;
}

/** A living team member is driven insane. Produces `InvestigatorFateChanged`. */
export interface MarkInsane {
  readonly type: 'MarkInsane';
  readonly code: string;
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
  readonly code: string;
  readonly by: JoiningInvestigator;
}

/**
 * Moves on to the next scenario of the campaign, once the current one is
 * resolved. Produces `ScenarioPositionChanged`.
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
export interface CampaignManualAdjust {
  readonly type: 'ManualAdjust';
  readonly adjustment: CampaignAdjustment;
}

/** The corrections a `CampaignManualAdjust` can make; each produces the matching regular event. */
export type CampaignAdjustment =
  | { readonly kind: 'xp'; readonly code: string; readonly account: XpAccount; readonly delta: number }
  | {
      readonly kind: 'trauma';
      readonly code: string;
      readonly trauma: TraumaKind;
      readonly delta: number;
    }
  | { readonly kind: 'fate'; readonly code: string; readonly fate: InvestigatorFate }
  | { readonly kind: 'removeStory'; readonly key: string }
  | { readonly kind: 'position'; readonly position: number };
