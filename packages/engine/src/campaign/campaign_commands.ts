import type { ChaosToken, Difficulty } from '../state';
import type { StoryValue } from './campaign_log';

/**
 * Intents for the campaign aggregate, kept apart from the game's `Command`:
 * a campaign outlives each game and has its own event log. `handleCampaign`
 * validates them against the `CampaignLog` and produces `CampaignEvent`s.
 */
export type CampaignCommand =
  StartCampaign | RecordStory | AddChaosToken | RemoveChaosToken | AdvanceScenario;

/** The `type` of every campaign command. */
export type CampaignCommandType = CampaignCommand['type'];

/**
 * An investigator as they join the campaign: card code plus printed name,
 * health and sanity (looked up in the `CardDb` by the caller, so the campaign log
 * needs no card data). They start without trauma or XP.
 */
export interface JoiningInvestigator {
  readonly code: string;
  readonly name: string;
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

/**
 * Moves on to the next scenario of the campaign, once the current one is
 * resolved. Produces `ScenarioPositionChanged`.
 */
export interface AdvanceScenario {
  readonly type: 'AdvanceScenario';
}
