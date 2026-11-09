/** Why an import refused a file; the UI maps it to a translated message. */
export type GameImportFailure = 'invalid' | 'newerVersion';

/**
 * Thrown by `parseGameExport` and `parseExportFile`; `reason` is a stable code, the message is
 * for developers only. It lives apart from those parsers so home can tell the reasons apart
 * without loading zod, which the store only loads when a file is exported or imported.
 */
export class GameImportError extends Error {
  constructor(readonly reason: GameImportFailure) {
    super(`Cannot import game: ${reason}`);
    this.name = 'GameImportError';
  }
}
