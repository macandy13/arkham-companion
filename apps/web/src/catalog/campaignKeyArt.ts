import type { CampaignDefinitionId } from '@arkham/engine';

/**
 * Where Fantasy Flight Games keeps the pictures of its product pages; a campaign's key art is the
 * page's `og:image` there (1920×1080). The app loads it on the player's device and never bundles
 * it, like the card pictures from ArkhamDB.
 */
const FFG_IMAGES =
  'https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/image-converter';

/**
 * The key art of each campaign's box, by campaign definition id, for its cover on the home shelf
 * (`CoverArt`). The address is dated, so a campaign whose page moves its picture loses its key
 * art and its cover falls back to its chapter's agenda art until the address here is updated.
 * Night of the Zealot is the campaign of the Revised Core Set (product AHC60).
 */
const KEY_ART: Readonly<Record<string, string>> = {
  'night-of-the-zealot': `${FFG_IMAGES}/2026/09/FFG_AHC60_Hero-Slider.webp`,
};

/** The address of the key art of campaign `id`, if it has one. */
export function campaignKeyArt(id: CampaignDefinitionId): string | undefined {
  return KEY_ART[id];
}

/** Every campaign's key art, for the end-to-end tests to download ahead of a run. */
export const campaignKeyArts: readonly string[] = Object.values(KEY_ART);
