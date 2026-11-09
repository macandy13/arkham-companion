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
  exportedEvent,
  exportedGame,
  exportedGameSchema,
  gameFromExportJson,
  readExportJson,
  toImportedGame,
} from './gameExport';
import { GameImportError } from './importError';

/** Marker of a campaign's export, beside a single game's (`gameExport`). */
const FORMAT = 'arkham-companion-campaign';

/**
 * A log event's `CampaignChangeCause`, checked in full: replay never reads it, but the log's notices
 * do, so nothing later would catch one they cannot word.
 */
const causeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('player') }),
  z.object({
    kind: z.literal('resolution'),
    scenarioId: z.string(),
    outcome: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('resolution'), id: z.string() }),
      z.object({ kind: z.literal('noResolution') }),
    ]),
  }),
  z.object({ kind: z.literal('interlude'), interludeId: z.string() }),
]);

/**
 * Envelope of an exported campaign: its log and the games of its scenarios. Like a game's events,
 * the log's events are only checked for being objects with a `type` here: `parseExportFile`
 * replays the log, which refuses what it can't read.
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
      cause: causeSchema.optional(),
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
  if (!format.success) return { kind: 'game', game: gameFromExportJson(json) };
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) throw new GameImportError('invalid');
  // The schema cannot vouch for event payloads, but the cast is checked by the replay below; it
  // checked the causes in full.
  const events = parsed.data.events as unknown as ImportedCampaign['events'];
  try {
    if (!campaign.replayEvents(events.map((e) => e.event))) throw new Error('unknown event');
  } catch (error) {
    console.warn('Import rejected: the campaign log does not replay.', error);
    throw new GameImportError('invalid');
  }
  const games = parsed.data.games.map(toImportedGame);
  // The new id is moved into the log's start and each game's copy of the log
  // (`GameStore.importCampaign`); a file without them would leave a campaign that names no id.
  const startsCampaign = events[0]?.event.type === 'CampaignStarted';
  const gamesOfCampaign = games.every(
    ({ events: [first] }) => first?.event.type === 'ScenarioStarted' && !!first.event.campaign,
  );
  if (!startsCampaign || !gamesOfCampaign) {
    console.warn('Import rejected: the campaign log or one of its games is not a campaign’s.');
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
      games,
    },
  };
}
