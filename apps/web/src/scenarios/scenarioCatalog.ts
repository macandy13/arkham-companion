import { nightOfTheZealot, theGathering, theGatheringCards } from '@arkham/scenarios';
import type { CampaignDefinition, CardDb, ScenarioDefinition } from '@arkham/engine';

/** A scenario the wizard can start: its definition plus the card data the engine needs to run it. */
export interface ScenarioEntry {
  id: string;
  /** i18n key of the display name; scenario names are UI strings, not card text. */
  nameKey: string;
  definition: ScenarioDefinition;
  cards: CardDb;
}

/** A campaign the wizard can start; it begins with the first scenario of `definition`. */
export interface CampaignEntry {
  id: string;
  nameKey: string;
  /** Scenario order and chaos bags; `StartCampaign` is compiled from it. */
  definition: CampaignDefinition;
  /**
   * ArkhamDB codes of the packs that contain the campaign (`PackDef.code`); the settings offer
   * only these packs for the collection, since the app plays no other campaign yet.
   */
  packCodes: readonly string[];
}

/**
 * Every playable scenario. The wizard only reads this list, so replacing The Gathering test
 * scenario with real scenarios later means editing it here and nowhere else.
 */
export const scenarioCatalog: readonly ScenarioEntry[] = [
  {
    id: theGathering.id,
    nameKey: 'scenarios.theGathering',
    definition: theGathering,
    cards: theGatheringCards,
  },
];

/** Every playable campaign. */
export const campaignCatalog: readonly CampaignEntry[] = [
  {
    id: nightOfTheZealot.id,
    nameKey: 'campaigns.nightOfTheZealot',
    definition: nightOfTheZealot,
    // The Revised Core Set reprints the Core Set with the same campaign.
    packCodes: ['core', 'rcore'],
  },
];

/** The scenario with `id`, if the catalog has it. */
export function findScenario(id: string): ScenarioEntry | undefined {
  return scenarioCatalog.find((entry) => entry.id === id);
}
