import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cardImagePath, type CardImagePath } from '@arkham/engine';
import { theGatheringCardDefs } from '@arkham/scenarios';

/** Where ArkhamDB serves the card pictures the app names (`CardStats.imageSrc`). */
const ARKHAMDB = 'https://arkhamdb.com';

/**
 * The local copies of the card pictures the E2E tests show, downloaded before the tests run.
 * Gitignored and never committed: card art is FFG's, and the deployed app always loads it from
 * ArkhamDB on the device. CI keeps the folder in its cache between runs.
 */
const CARD_PICTURE_DIR = join(import.meta.dirname, '..', '.card_pictures');

/**
 * The picture of the invented investigator Alder: Roland Banks' scan, so the investigator card's
 * art window shows a real crop in the shots.
 */
export const ALDER_PICTURE = cardImagePath('/bundles/cards/01001.png');

/** Every picture the E2E games name: The Gathering's cards, both sides, and Alder's. */
function e2ePictures(): CardImagePath[] {
  const sides = theGatheringCardDefs.flatMap(({ imageSrc, backImageSrc }) => [
    ...(imageSrc ? [imageSrc] : []),
    ...(backImageSrc ? [backImageSrc] : []),
  ]);
  return [...new Set([...sides, ALDER_PICTURE])];
}

/** The local copy of the picture at `path` (an ArkhamDB path), if it has been downloaded. */
export function localCardPicture(path: string): string | undefined {
  const file = join(CARD_PICTURE_DIR, basename(path));
  return existsSync(file) ? file : undefined;
}

/**
 * Playwright's global setup: downloads the pictures that have no local copy yet. A picture that
 * fails (no network, ArkhamDB down) is only warned about, since the app then shows the card's
 * pattern, as it does offline, and no test depends on the art.
 */
export default async function fetchCardPictures(): Promise<void> {
  await mkdir(CARD_PICTURE_DIR, { recursive: true });
  const missing = e2ePictures().filter((path) => localCardPicture(path) === undefined);
  const failed: string[] = [];
  await Promise.all(
    missing.map(async (path) => {
      try {
        const response = await fetch(`${ARKHAMDB}${path}`, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await writeFile(
          join(CARD_PICTURE_DIR, basename(path)),
          Buffer.from(await response.arrayBuffer()),
        );
      } catch (error) {
        failed.push(`${path} (${error instanceof Error ? error.message : String(error)})`);
      }
    }),
  );
  if (failed.length > 0)
    console.warn(
      `Could not download ${failed.length} card pictures; their cards show the pattern:\n` +
        failed.join('\n'),
    );
}
