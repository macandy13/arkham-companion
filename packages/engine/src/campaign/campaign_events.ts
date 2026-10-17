import type { InvestigatorCode } from '../ids';
import type { ChaosToken, Difficulty } from '../state';
import type {
  CampaignInvestigator,
  InvestigatorFate,
  StoryValue,
  TraumaKind,
  XpAccount,
} from './campaign_log';

/**
 * Facts of the campaign aggregate. Like the game's `Event`s they carry
 * everything `applyCampaign` needs, so replaying a stored campaign log never
 * validates or looks anything up. Regular commands and `AdjustCampaign`
 * corrections produce the same events.
 */
export type CampaignEvent =
  | CampaignStarted
  | StoryRecorded
  | StoryRecordRemoved
  | ChaosTokenAdded
  | ChaosTokenRemoved
  | XpChanged
  | TraumaChanged
  | InvestigatorFateChanged
  | InvestigatorReplaced
  | ScenarioPositionChanged;

/** A campaign began; replaces the whole log. Produced by `StartCampaign`. */
export interface CampaignStarted {
  readonly type: 'CampaignStarted';
  readonly campaignId: string;
  readonly definitionId: string;
  readonly difficulty: Difficulty;
  /** Already in their starting state: no trauma, no XP, alive. */
  readonly investigators: readonly CampaignInvestigator[];
  readonly chaosBag: readonly ChaosToken[];
  readonly scenarioIds: readonly string[];
}

/** A story record was written or overwritten. Produced by `RecordStory`. */
export interface StoryRecorded {
  readonly type: 'StoryRecorded';
  readonly key: string;
  readonly value: StoryValue;
}

/** A story record was deleted. Produced by `AdjustCampaign` `removeStory`. */
export interface StoryRecordRemoved {
  readonly type: 'StoryRecordRemoved';
  readonly key: string;
}

/** One token went into the chaos bag. Produced by `AddChaosToken`. */
export interface ChaosTokenAdded {
  readonly type: 'ChaosTokenAdded';
  readonly token: ChaosToken;
}

/** One copy of a token left the chaos bag. Produced by `RemoveChaosToken`. */
export interface ChaosTokenRemoved {
  readonly type: 'ChaosTokenRemoved';
  readonly token: ChaosToken;
}

/** An XP total changed by `delta`. Produced by `AwardXp`, `SpendXp` and `AdjustCampaign` `xp`. */
export interface XpChanged {
  readonly type: 'XpChanged';
  readonly code: InvestigatorCode;
  readonly account: XpAccount;
  readonly delta: number;
}

/** A trauma count changed by `delta`. Produced by `AddTrauma` and `AdjustCampaign` `trauma`. */
export interface TraumaChanged {
  readonly type: 'TraumaChanged';
  readonly code: InvestigatorCode;
  readonly kind: TraumaKind;
  readonly delta: number;
}

/**
 * A team member's fate changed. Produced by `MarkKilled`, `MarkInsane`,
 * `AddTrauma` reaching the limit and `AdjustCampaign` `fate`.
 */
export interface InvestigatorFateChanged {
  readonly type: 'InvestigatorFateChanged';
  readonly code: InvestigatorCode;
  readonly fate: InvestigatorFate;
}

/**
 * A killed or insane team member left the team for a new investigator in
 * the same seat. Produced by `ReplaceInvestigator`.
 */
export interface InvestigatorReplaced {
  readonly type: 'InvestigatorReplaced';
  /** Code of the investigator who moves to `formerInvestigators`. */
  readonly code: InvestigatorCode;
  /** The newcomer in their starting state. */
  readonly by: CampaignInvestigator;
}

/** The scenario position moved. Produced by `AdvanceScenario` and `AdjustCampaign` `position`. */
export interface ScenarioPositionChanged {
  readonly type: 'ScenarioPositionChanged';
  readonly position: number;
}
