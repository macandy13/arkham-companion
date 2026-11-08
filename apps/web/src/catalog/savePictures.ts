import type { CardImagePath } from '@arkham/engine';
import { cardImageUrl } from './cardImageUrl';

/** How far `savePictures` got: pictures fetched, pictures that failed, and how many there are. */
export interface PictureProgress {
  saved: number;
  failed: number;
  total: number;
}

/** A `fetch` as `savePictures` calls it; tests pass their own. */
export type PictureFetch = (url: string, init: RequestInit) => Promise<unknown>;

/** How many pictures load at once: enough to keep a slow line busy without flooding ArkhamDB. */
const PARALLEL_FETCHES = 4;

/**
 * Fetches each picture in `paths` from ArkhamDB once, so the service worker's card picture cache
 * (`cardImageCaching`) holds it before a game at a table without network (M6.4). The fetch goes
 * out as `no-cors`, like the `img` that shows the picture later, so the two share one cache entry.
 * `onProgress` hears after each picture; a picture that fails is counted and warned about, and
 * the rest go on. Only a network failure counts as failed: an opaque response hides its status,
 * so a picture ArkhamDB lacks counts as saved, and the drawn frame stands in for it at the table
 * as it does online. Without a service worker in control (a first visit) the pictures only warm
 * the browser's own cache.
 */
export async function savePictures(
  paths: readonly CardImagePath[],
  onProgress: (progress: PictureProgress) => void,
  fetchFn: PictureFetch = (url, init) => fetch(url, init),
): Promise<PictureProgress> {
  const progress: PictureProgress = { saved: 0, failed: 0, total: paths.length };
  const queue = [...paths];
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      try {
        await fetchFn(cardImageUrl(path), { mode: 'no-cors' });
        progress.saved++;
      } catch (error) {
        console.warn(`Could not save the card picture ${path} for offline play.`, error);
        progress.failed++;
      }
      onProgress({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_FETCHES, paths.length) }, worker));
  return progress;
}
