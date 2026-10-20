import type { StoreApi } from 'zustand/vanilla';
import type { GameId } from '@arkham/engine';
import type { AppState } from '../state/appStore';

/**
 * Offers `text` to the user as a file download. Uses a temporary object URL and anchor click
 * because browsers have no direct "save file" API that works on tablets as well.
 */
export function downloadTextFile(fileName: string, text: string, mimeType = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads the export of a saved game as `<title>.arkham.json`. Every screen that offers an
 * export calls this, so a game is saved under the same file name wherever it is exported.
 */
export async function downloadGameExport(
  store: StoreApi<AppState>,
  gameId: GameId,
  title: string,
): Promise<void> {
  downloadTextFile(`${toFileStem(title)}.arkham.json`, await store.getState().exportGame(gameId));
}

/** Turns a game title into a safe file name stem (no path separators or reserved characters). */
export function toFileStem(title: string): string {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'game';
}
