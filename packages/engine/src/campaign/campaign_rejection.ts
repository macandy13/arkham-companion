import type { InvestigatorCode } from '../ids';
import type { ChaosToken } from '../state';
import type { InvestigatorFate, StoryKind } from './campaign_log';

/**
 * Structured reason why `handleCommand` refused a campaign command; the
 * campaign counterpart of the game's `Rejection`. The UI switches on `code`
 * for a translated message; `CampaignCommandRejected.message` is only a
 * developer-facing fallback.
 */
export type CampaignRejection =
  /** Any command but `StartCampaign` before the campaign started. */
  | { code: 'campaignNotStarted' }
  /** `StartCampaign` on a log that already holds a campaign. */
  | { code: 'campaignAlreadyStarted' }
  /** `StartCampaign` with fewer than 1 or more than `MAX_TEAM_SIZE` investigators. */
  | { code: 'invalidTeamSize'; count: number }
  /** An investigator code that is already in the campaign, current or former. */
  | { code: 'duplicateInvestigator'; investigatorCode: InvestigatorCode }
  /** Printed health or sanity that is not a positive integer. */
  | {
      code: 'invalidInvestigatorStats';
      investigatorCode: InvestigatorCode;
      health: number;
      sanity: number;
    }
  /** `StartCampaign` without scenarios. */
  | { code: 'noScenarios' }
  /** No current team member has this code. */
  | { code: 'unknownInvestigator'; investigatorCode: InvestigatorCode }
  /** A joining investigator whose code is not an investigator card in the `CardDb`. */
  | { code: 'unknownInvestigatorCard'; investigatorCode: InvestigatorCode }
  /** The investigator is killed or insane and can no longer take part. */
  | { code: 'investigatorEliminated'; investigatorCode: InvestigatorCode; fate: InvestigatorFate }
  /** `ReplaceInvestigator` for an investigator who is still alive. */
  | { code: 'investigatorNotEliminated'; investigatorCode: InvestigatorCode }
  /** XP or trauma amount that is not a positive integer. */
  | { code: 'invalidAmount'; amount: number }
  /** `SpendXp` for more XP than is available. */
  | {
      code: 'notEnoughXp';
      investigatorCode: InvestigatorCode;
      available: number;
      requested: number;
    }
  /** A story key that is empty or only whitespace. */
  | { code: 'invalidStoryKey'; key: string }
  /** A count that is not a non-negative integer, or a list with an empty or repeated name. */
  | { code: 'invalidStoryValue'; key: string }
  /** `RecordStory` with a kind other than the one the record already has. */
  | { code: 'storyKindMismatch'; key: string; recorded: StoryKind; given: StoryKind }
  /** `RemoveChaosToken` for a token that is not in the bag. */
  | { code: 'chaosTokenNotInBag'; token: ChaosToken }
  /** `AdvanceScenario` after the last scenario. */
  | { code: 'campaignComplete' }
  /** `AdjustCampaign` delta that is zero or not an integer. */
  | { code: 'invalidDelta'; delta: number }
  /** `AdjustCampaign` `fate` to the fate the investigator already has. */
  | { code: 'fateUnchanged'; investigatorCode: InvestigatorCode; fate: InvestigatorFate }
  /** `AdjustCampaign` `removeStory` for a key with no record. */
  | { code: 'unknownStoryRecord'; key: string }
  /** `AdjustCampaign` `position` outside 0..`max` (the number of scenarios). */
  | { code: 'invalidPosition'; position: number; max: number }
  /** An `AdjustCampaign` that would leave the log inconsistent; `violations` from `checkInvariants`. */
  | { code: 'inconsistentAdjustment'; violations: readonly string[] };

/** The `code` of every campaign rejection. */
export type CampaignRejectionCode = CampaignRejection['code'];

/** Thrown by `handleCommand` when a command is not valid for the current log. */
export class CampaignCommandRejected extends Error {
  /** Machine-readable reason, see `CampaignRejection`. */
  readonly rejection: CampaignRejection;

  constructor(rejection: CampaignRejection) {
    super(describeCampaignRejection(rejection));
    this.name = 'CampaignCommandRejected';
    this.rejection = rejection;
  }
}

function describeCampaignRejection(r: CampaignRejection): string {
  switch (r.code) {
    case 'campaignNotStarted':
      return 'the campaign has not started';
    case 'campaignAlreadyStarted':
      return 'the campaign has already started';
    case 'invalidTeamSize':
      return `a campaign needs 1 to 4 investigators, got ${r.count}`;
    case 'duplicateInvestigator':
      return `investigator ${r.investigatorCode} is already in the campaign`;
    case 'invalidInvestigatorStats':
      return `health and sanity of ${r.investigatorCode} must be positive integers, got ${r.health} and ${r.sanity}`;
    case 'noScenarios':
      return 'a campaign needs at least one scenario';
    case 'unknownInvestigator':
      return `no investigator ${r.investigatorCode} on the team`;
    case 'unknownInvestigatorCard':
      return `no investigator card ${r.investigatorCode}`;
    case 'investigatorEliminated':
      return `investigator ${r.investigatorCode} is ${r.fate}`;
    case 'investigatorNotEliminated':
      return `investigator ${r.investigatorCode} is neither killed nor insane`;
    case 'invalidAmount':
      return `amount must be a positive integer, got ${r.amount}`;
    case 'notEnoughXp':
      return `${r.investigatorCode} has ${r.available} XP, ${r.requested} requested`;
    case 'invalidStoryKey':
      return `story key must not be blank, got "${r.key}"`;
    case 'invalidStoryValue':
      return `invalid value for story record ${r.key}`;
    case 'storyKindMismatch':
      return `story record ${r.key} is a ${r.recorded}, not a ${r.given}`;
    case 'chaosTokenNotInBag':
      return `no ${r.token} token in the chaos bag`;
    case 'campaignComplete':
      return 'the campaign has no further scenario';
    case 'invalidDelta':
      return `delta must be a non-zero integer, got ${r.delta}`;
    case 'fateUnchanged':
      return `investigator ${r.investigatorCode} is already ${r.fate}`;
    case 'unknownStoryRecord':
      return `no story record ${r.key}`;
    case 'invalidPosition':
      return `position ${r.position} out of range 0..${r.max}`;
    case 'inconsistentAdjustment':
      return `adjustment would break the campaign log: ${r.violations.join('; ')}`;
  }
}
