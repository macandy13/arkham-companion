import {
  nightOfTheZealot,
  theDevourerBelow,
  theDevourerBelowCards,
  theGathering,
  theGatheringCards,
  theMidnightMasks,
  theMidnightMasksCards,
} from '@arkham/scenarios';
import type {
  CampaignDefinition,
  CampaignDefinitionId,
  CardCode,
  CardDb,
  ScenarioDefinition,
  ScenarioId,
} from '@arkham/engine';

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
   * Prefix of the i18n keys that put its story records into words on the log page: a list's
   * heading at `<storyKey>.<record>`, a flag's note at `<storyKey>.<record>.yes` or `.no`.
   */
  storyKey: string;
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
  {
    id: theMidnightMasks.id,
    nameKey: 'scenarios.theMidnightMasks',
    definition: theMidnightMasks,
    cards: theMidnightMasksCards,
  },
  {
    id: theDevourerBelow.id,
    nameKey: 'scenarios.theDevourerBelow',
    definition: theDevourerBelow,
    cards: theDevourerBelowCards,
  },
];

/** Every playable campaign. */
export const campaignCatalog: readonly CampaignEntry[] = [
  {
    id: nightOfTheZealot.id,
    nameKey: 'campaigns.nightOfTheZealot',
    definition: nightOfTheZealot,
    storyKey: 'story.nightOfTheZealot',
    // The Revised Core Set reprints the Core Set with the same campaign.
    packCodes: ['core', 'rcore'],
  },
];

/** The scenario with `id`, if the catalog has it. */
export function findScenario(id: ScenarioId): ScenarioEntry | undefined {
  return scenarioCatalog.find((entry) => entry.id === id);
}

/** The campaign with definition id `id`, if the catalog has it. */
export function findCampaign(id: CampaignDefinitionId): CampaignEntry | undefined {
  return campaignCatalog.find((entry) => entry.id === id);
}

/**
 * The printed name of the scenario card `code`, such as a story card a campaign's investigator
 * earned, from whichever scenario of the catalog has it; the code itself if none does.
 */
export function scenarioCardName(code: CardCode): string {
  for (const entry of scenarioCatalog) {
    const card = entry.cards.get(code);
    if (card) return card.name;
  }
  return code;
}
