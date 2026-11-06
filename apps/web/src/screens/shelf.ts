import type { CampaignSummary, GameSummary, ScenarioId } from '@arkham/engine';

/**
 * One cover on the home shelf (MD.3b): a campaign with the games of its scenarios, or a game of
 * one scenario on its own. `lastPlayed` is the newest change to any of them, epoch ms.
 */
export type ShelfEntry =
  | {
      readonly kind: 'campaign';
      readonly campaign: CampaignSummary;
      /** The campaign's scenario games, newest first. */
      readonly games: readonly GameSummary[];
      readonly lastPlayed: number;
    }
  | { readonly kind: 'game'; readonly game: GameSummary; readonly lastPlayed: number };

/**
 * The covers on the home shelf, last played first. A game joins the cover of the campaign it
 * belongs to; one whose campaign is not on this device (an imported campaign game) stands alone.
 * `games` comes newest first from the store, and each campaign keeps that order.
 */
export function shelfEntries(
  campaigns: readonly CampaignSummary[],
  games: readonly GameSummary[],
): ShelfEntry[] {
  const known = new Set(campaigns.map((c) => c.campaignId));
  const ofCampaign = (campaign: CampaignSummary) =>
    games.filter((game) => game.campaignId === campaign.campaignId);
  const entries: ShelfEntry[] = [
    ...campaigns.map((campaign) => {
      const own = ofCampaign(campaign);
      return {
        kind: 'campaign' as const,
        campaign,
        games: own,
        lastPlayed: Math.max(campaign.updatedAt, ...own.map((game) => game.updatedAt)),
      };
    }),
    ...games
      .filter((game) => !game.campaignId || !known.has(game.campaignId))
      .map((game) => ({ kind: 'game' as const, game, lastPlayed: game.updatedAt })),
  ];
  return entries.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

/**
 * Where a campaign stands, which picks its cover's button: over (read the log), a chapter's game
 * under way (continue it), a chapter with no game yet (set it up from the log), or past its last
 * scenario with the ending still to be written (the log again). `chapter` counts from 1.
 */
export type CampaignStanding =
  | { readonly kind: 'over'; readonly result: NonNullable<CampaignSummary['result']> }
  | {
      readonly kind: 'playing';
      readonly chapter: number;
      readonly scenarioId: ScenarioId;
      readonly game: GameSummary;
    }
  | { readonly kind: 'setUp'; readonly chapter: number; readonly scenarioId: ScenarioId }
  | { readonly kind: 'ending' };

/**
 * Where `campaign` stands, given its scenario `games` (newest first) and the scenario order of its
 * definition. The chapter's game is the newest game of the scenario the log is at, since the log
 * moves on only once a scenario's resolution is written.
 */
export function campaignStanding(
  campaign: CampaignSummary,
  games: readonly GameSummary[],
  scenarios: readonly ScenarioId[],
): CampaignStanding {
  if (campaign.result) return { kind: 'over', result: campaign.result };
  const scenarioId = scenarios[campaign.position];
  if (!scenarioId) return { kind: 'ending' };
  const chapter = campaign.position + 1;
  const game = games.find((g) => g.scenarioId === scenarioId);
  return game
    ? { kind: 'playing', chapter, scenarioId, game }
    : { kind: 'setUp', chapter, scenarioId };
}
