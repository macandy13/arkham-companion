import { z } from 'zod';
import {
  PHASE_STEP_TITLES,
  STATE_VERSION,
  replay,
  type ImportedGame,
  type PhaseStepId,
  type StoredEvent,
} from '@arkham/engine';

/** Marker so arbitrary JSON files are rejected early with a clear reason. */
const FORMAT = 'arkham-companion-game';

/** The phase steps a rule cause may name, read from the engine's own list. */
const phaseSteps = Object.keys(PHASE_STEP_TITLES) as [PhaseStepId, ...PhaseStepId[]];

/**
 * An event's `ChangeCause`, checked in full: replay never reads it, so nothing later would catch
 * one the log cannot word. The window of a card cause is only checked for a `kind`, as only its
 * card is shown.
 */
const causeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('player') }),
  z.object({
    kind: z.literal('card'),
    cardId: z.string(),
    window: z.looseObject({ kind: z.string() }),
  }),
  z.object({ kind: z.literal('rule'), step: z.enum(phaseSteps) }),
]);

/**
 * One game in an export: its title and its log. Events are only checked for being objects with a
 * `type`: the full `Event` union lives in the engine and would have to be duplicated here.
 * Structural errors inside an event are caught by `toImportedGame` replaying the log instead. A
 * campaign's export holds its games in this shape too (`campaignExport`).
 */
export const exportedGameSchema = z.object({
  game: z.object({ title: z.string(), createdAt: z.number() }),
  events: z.array(
    z.object({
      timestamp: z.number(),
      commandId: z.string(),
      event: z.looseObject({ type: z.string() }),
      cause: causeSchema.optional(),
    }),
  ),
});

/** Envelope of an exported game: the game, marked as a game of this app's `stateVersion`. */
const exportSchema = exportedGameSchema.extend({
  format: z.literal(FORMAT),
  stateVersion: z.number().int().positive(),
});

/** Why `parseGameExport` refused a file; the UI maps it to a translated message. */
export type GameImportFailure = 'invalid' | 'newerVersion';

/** Thrown by `parseGameExport`; `reason` is a stable code, the message is for developers only. */
export class GameImportError extends Error {
  constructor(readonly reason: GameImportFailure) {
    super(`Cannot import game: ${reason}`);
    this.name = 'GameImportError';
  }
}

/**
 * Serialises a game's metadata and event log to the JSON export format. `stateVersion` is
 * stored so a later app version can migrate (or refuse) the log; the log itself is the
 * source of truth, no state is exported.
 */
export function serialiseGameExport(
  title: string,
  createdAt: number,
  events: readonly StoredEvent[],
): string {
  return JSON.stringify({
    format: FORMAT,
    stateVersion: STATE_VERSION,
    ...exportedGame(title, createdAt, events),
  });
}

/** A game as an export holds it (`exportedGameSchema`): the store's ids and sequence numbers left out. */
export function exportedGame(title: string, createdAt: number, events: readonly StoredEvent[]) {
  return { game: { title, createdAt }, events: events.map(exportedEvent) };
}

/** An event of a game or a campaign log as an export holds it: without the store's ids. */
export function exportedEvent<E>({
  timestamp,
  commandId,
  event,
  cause,
}: {
  timestamp: number;
  commandId: string;
  event: E;
  cause?: unknown;
}) {
  return { timestamp, commandId, event, ...(cause === undefined ? {} : { cause }) };
}

/**
 * The JSON of an export file, refused as `invalid` if it is none and as `newerVersion` if a newer
 * app wrote it. The version is checked before any schema so a file from a newer app reports
 * `newerVersion` even if its layout has changed. Throws `GameImportError`.
 */
export function readExportJson(text: string): unknown {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    console.warn('Import rejected: the file is not valid JSON.', error);
    throw new GameImportError('invalid');
  }
  const version = z.looseObject({ stateVersion: z.number() }).safeParse(json);
  if (version.success && version.data.stateVersion > STATE_VERSION) {
    throw new GameImportError('newerVersion');
  }
  return json;
}

/**
 * Parses and validates an export file into something `GameStore.importGame` accepts. Throws
 * `GameImportError`.
 */
export function parseGameExport(text: string): ImportedGame {
  return gameFromExportJson(readExportJson(text));
}

/** The game in the JSON of a game's export file (`readExportJson`); throws `GameImportError`. */
export function gameFromExportJson(json: unknown): ImportedGame {
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) throw new GameImportError('invalid');
  return toImportedGame(parsed.data);
}

/** The game an export holds, once its log replays; throws `GameImportError` if it doesn't. */
export function toImportedGame(exported: z.infer<typeof exportedGameSchema>): ImportedGame {
  // The schema cannot vouch for event payloads, but the cast is checked by the replay below; it
  // checked the causes in full.
  const events = exported.events as unknown as ImportedGame['events'];
  try {
    if (!replay(events.map((e) => e.event))) throw new Error('unknown event');
  } catch (error) {
    console.warn('Import rejected: the event log does not replay.', error);
    throw new GameImportError('invalid');
  }
  return { title: exported.game.title, events };
}
