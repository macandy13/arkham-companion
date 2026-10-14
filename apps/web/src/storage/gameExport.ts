import { z } from 'zod';
import {
  STATE_VERSION,
  replay,
  type Event,
  type ImportedGame,
  type StoredEvent,
} from '@arkham/engine';

/** Marker so arbitrary JSON files are rejected early with a clear reason. */
const FORMAT = 'arkham-companion-game';

/**
 * Envelope of an exported game. Events are only checked for being objects with a `type`:
 * the full `Event` union lives in the engine and would have to be duplicated here. Structural
 * errors inside an event are caught by `parseGameExport` replaying the log instead.
 */
const exportSchema = z.object({
  format: z.literal(FORMAT),
  stateVersion: z.number().int().positive(),
  game: z.object({ title: z.string(), createdAt: z.number() }),
  events: z.array(
    z.object({
      timestamp: z.number(),
      event: z.looseObject({ type: z.string() }),
    }),
  ),
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
    game: { title, createdAt },
    events: events.map(({ timestamp, event }) => ({ timestamp, event })),
  });
}

/**
 * Parses and validates an export file into something `GameStore.importGame` accepts.
 * The version is checked before the rest of the schema so a file from a newer app reports
 * `newerVersion` even if its layout has changed. Throws `GameImportError`.
 */
export function parseGameExport(text: string): ImportedGame {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GameImportError('invalid');
  }
  const version = z.looseObject({ stateVersion: z.number() }).safeParse(json);
  if (version.success && version.data.stateVersion > STATE_VERSION) {
    throw new GameImportError('newerVersion');
  }
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) throw new GameImportError('invalid');

  // The schema above cannot vouch for event payloads, but the cast is checked by the replay below.
  const events = parsed.data.events as unknown as { timestamp: number; event: Event }[];
  try {
    if (!replay(events.map((e) => e.event))) throw new Error('unknown event');
  } catch {
    throw new GameImportError('invalid');
  }
  return { title: parsed.data.game.title, events };
}
