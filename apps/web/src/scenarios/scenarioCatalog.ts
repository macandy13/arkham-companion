import { theGathering, theGatheringCards } from '@arkham/scenarios';
import type { CardDb, ScenarioDefinition } from '@arkham/engine';

/** A scenario the wizard can start: its definition plus the card data the engine needs to run it. */
export interface ScenarioEntry {
  id: string;
  /** i18n key of the display name; scenario names are UI strings, not card text. */
  nameKey: string;
  definition: ScenarioDefinition;
  cards: CardDb;
}

/** A campaign the wizard can start; it begins with the scenario `firstScenarioId`. */
export interface CampaignEntry {
  id: string;
  nameKey: string;
  firstScenarioId: string;
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

/** Every playable campaign; there is no campaign log yet, so a campaign just starts its first scenario. */
export const campaignCatalog: readonly CampaignEntry[] = [
  {
    id: 'night-of-the-zealot',
    nameKey: 'campaigns.nightOfTheZealot',
    firstScenarioId: theGathering.id,
  },
];

/** The scenario with `id`, if the catalog has it. */
export function findScenario(id: string): ScenarioEntry | undefined {
  return scenarioCatalog.find((entry) => entry.id === id);
}
