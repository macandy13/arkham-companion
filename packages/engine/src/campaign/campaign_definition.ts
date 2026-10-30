import type { ChaosToken, Difficulty } from '../state';
import type { CampaignDefinitionId, CampaignId, InvestigatorCode, ScenarioId } from '../ids';
import type { StartCampaign } from './campaign_commands';

/**
 * A campaign as data (architecture §8), the campaign counterpart of
 * `ScenarioDefinition`: which scenarios it plays in which order and the
 * chaos bag it starts with. `compileStart` turns it into a
 * `StartCampaign`. Resolutions and `campaignSetup` live on each
 * `ScenarioDefinition` (M1C.3/M1C.4), because they belong to the scenario.
 */
export interface CampaignDefinition {
  /** Stored as `CampaignLog.definitionId`. */
  readonly id: CampaignDefinitionId;
  /**
   * `ScenarioDefinition.id`s in campaign order. A fixed list is enough for
   * Night of the Zealot; campaigns whose next scenario depends on the log
   * will pick it from the played scenarios instead (M1C.4 follow-up).
   */
  readonly scenarios: readonly ScenarioId[];
  /**
   * Starting chaos bag per difficulty. The campaign's own bag, separate from
   * each scenario's standalone bag, since resolutions modify it from here on.
   */
  readonly chaosBag: Record<Difficulty, readonly ChaosToken[]>;
  /** Interludes between scenarios; placeholder until a campaign needs them. */
  readonly interludes?: readonly InterludeDefinition[];
  /** What its campaign log shows besides the sheets every campaign has. */
  readonly log: CampaignLogLayout;
}

/**
 * The campaign's part of its log page. Every log has a team card, a scenario path, campaign
 * notes, the killed and insane, and the chaos bag; a campaign says which of its story records
 * the notes show and adds its own sheets. A record that no note or sheet names stays hidden,
 * for the rules only. Research for all campaigns: docs/product.md "Campaign screen".
 */
export interface CampaignLogLayout {
  /** Story record keys written as campaign notes, in the order the campaign guide records them. */
  readonly notes: readonly string[];
  /** The campaign's own sheets, in reading order. */
  readonly sheets: readonly LogSheet[];
}

/**
 * One of a campaign's own log sheets, showing the story record `record`. Kinds join as the
 * campaigns that need them are entered (tallies for The Path to Carcosa, rosters for Edge of the
 * Earth); the page lays every kind out the same way.
 */
export type LogSheet =
  /** Names written under a heading, e.g. "Cultists Who Got Away"; crossed-out ones stay struck. */
  { readonly kind: 'nameList'; readonly record: string };

/**
 * An interlude: story read between two scenarios, which may write to the
 * campaign log. Only its place in the order for now; its steps get a type
 * once a campaign with interludes is entered (none in the Core Set's first
 * scenarios needs it).
 */
export interface InterludeDefinition {
  readonly id: string;
  /** `ScenarioDefinition.id` of the scenario the interlude follows. */
  readonly afterScenario: ScenarioId;
}

/** What the players choose when starting a campaign from a `CampaignDefinition`. */
export interface CampaignOptions {
  /** Unique ID of this play-through, chosen by the caller (the engine generates no IDs). */
  readonly campaignId: CampaignId;
  readonly difficulty: Difficulty;
  readonly investigators: readonly InvestigatorCode[];
}

/** The `StartCampaign` for `definition` with the players' choices. */
export function compileStart(
  definition: CampaignDefinition,
  options: CampaignOptions,
): StartCampaign {
  return {
    type: 'StartCampaign',
    campaignId: options.campaignId,
    definitionId: definition.id,
    difficulty: options.difficulty,
    investigators: options.investigators,
    chaosBag: definition.chaosBag[options.difficulty],
    scenarioIds: definition.scenarios,
  };
}
