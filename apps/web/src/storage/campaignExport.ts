import { z } from 'zod';
import {
  RELIANCES,
  STATE_VERSION,
  campaign,
  type CampaignSummary,
  type ImportedCampaign,
  type ImportedGame,
  type StoredCampaignEvent,
  type StoredEvent,
} from '@arkham/engine';
import {
  GameImportError,
  exportedEvent,
  exportedGame,
  exportedGameSchema,
  parseGameExport,
  readExportJson,
  toImportedGame,
} from './gameExport';

/** Marker of a campaign's export, beside a single game's (`gameExport`). */
const FORMAT = 'arkham-companion-campaign';

/**
 * Envelope of an exported campaign: its log and the games of its scenarios. Like a game's events,
 * the log's events are only checked for being objects with a `type` here, and its causes for a
 * `kind`: `parseExportFile` replays the log, which refuses what it can't read.
 */
const exportSchema = z.object({
  format: z.literal(FORMAT),
  stateVersion: z.number().int().positive(),
  campaign: z.object({
    title: z.string(),
    createdAt: z.number(),
    reliance: z.enum(RELIANCES).optional(),
  }),
  events: z.array(
    z.object({
      timestamp: z.number(),
      commandId: z.string(),
      event: z.looseObject({ type: z.string() }),
      cause: z.looseObject({ kind: z.string() }).optional(),
    }),
  ),
  games: z.array(exportedGameSchema),
});

/** One game of a campaign's export: its title, when it was made, and its log. */
export interface CampaignGameExport {
  readonly title: string;
  readonly createdAt: number;
  readonly events: readonly StoredEvent[];
}

/**
 * Serialises a campaign (`summary`), its log and the games of its scenarios to the JSON export
 * format, so the whole campaign moves to another device in one file. Like a game's export, it
 * holds the logs and no state.
 */
export function serialiseCampaignExport(
  summary: Pick<CampaignSummary, 'title' | 'createdAt' | 'reliance'>,
  events: readonly StoredCampaignEvent[],
  games: readonly CampaignGameExport[],
): string {
  return JSON.stringify({
    format: FORMAT,
    stateVersion: STATE_VERSION,
    campaign: {
      title: summary.title,
      createdAt: summary.createdAt,
      reliance: summary.reliance,
    },
    events: events.map(exportedEvent),
    games: games.map((game) => exportedGame(game.title, game.createdAt, game.events)),
  });
}

/** What an export file holds: a single game, or a campaign with its games. */
export type ParsedExport =
  | { readonly kind: 'game'; readonly game: ImportedGame }
  | { readonly kind: 'campaign'; readonly campaign: ImportedCampaign };

/**
 * Parses and validates an export file of either kind, told apart by its `format`, so home loads
 * both through one button. Throws `GameImportError`.
 */
export function parseExportFile(text: string): ParsedExport {
  const json = readExportJson(text);
  const format = z.looseObject({ format: z.literal(FORMAT) }).safeParse(json);
  if (!format.success) return { kind: 'game', game: parseGameExport(text) };
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) throw new GameImportError('invalid');
  // The schema cannot vouch for event payloads or causes, but the cast is checked by the replay.
  const events = parsed.data.events as unknown as ImportedCampaign['events'];
  try {
    if (!campaign.replayEvents(events.map((e) => e.event))) throw new Error('unknown event');
  } catch (error) {
    console.warn('Import rejected: the campaign log does not replay.', error);
    throw new GameImportError('invalid');
  }
  return {
    kind: 'campaign',
    campaign: {
      title: parsed.data.campaign.title,
      ...(parsed.data.campaign.reliance === undefined
        ? {}
        : { reliance: parsed.data.campaign.reliance }),
      events,
      games: parsed.data.games.map(toImportedGame),
    },
  };
}
