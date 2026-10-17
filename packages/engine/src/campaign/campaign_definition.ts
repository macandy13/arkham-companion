import type { ChaosToken, Difficulty } from '../state';
import type { InvestigatorCode } from '../ids';
import type { StartCampaign } from './campaign_commands';

/**
 * A campaign as data (architecture §8), the campaign counterpart of
 * `ScenarioDefinition`: which scenarios it plays in which order and the
 * chaos bag it starts with. `compileCampaign` turns it into a
 * `StartCampaign`. Resolutions and `campaignSetup` live on each
 * `ScenarioDefinition` (M1C.3/M1C.4), because they belong to the scenario.
 */
export interface CampaignDefinition {
  /** Stored as `CampaignLog.definitionId`. */
  readonly id: string;
  /**
   * `ScenarioDefinition.id`s in campaign order. A fixed list is enough for
   * Night of the Zealot; campaigns whose next scenario depends on the log
   * will pick it from the played scenarios instead (M1C.4 follow-up).
   */
  readonly scenarios: readonly string[];
  /**
   * Starting chaos bag per difficulty. The campaign's own bag, separate from
   * each scenario's standalone bag, since resolutions modify it from here on.
   */
  readonly chaosBag: Record<Difficulty, readonly ChaosToken[]>;
  /** Interludes between scenarios; placeholder until a campaign needs them. */
  readonly interludes?: readonly InterludeDefinition[];
}

/**
 * An interlude: story read between two scenarios, which may write to the
 * campaign log. Only its place in the order for now; its steps get a type
 * once a campaign with interludes is entered (none in the Core Set's first
 * scenarios needs it).
 */
export interface InterludeDefinition {
  readonly id: string;
  /** `ScenarioDefinition.id` of the scenario the interlude follows. */
  readonly afterScenario: string;
}

/** What the players choose when starting a campaign from a `CampaignDefinition`. */
export interface CampaignOptions {
  /** Unique ID of this play-through, chosen by the caller (the engine generates no IDs). */
  readonly campaignId: string;
  readonly difficulty: Difficulty;
  readonly investigators: readonly InvestigatorCode[];
}

/** The `StartCampaign` for `definition` with the players' choices. */
export function compileCampaign(
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
