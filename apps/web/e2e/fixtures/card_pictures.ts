import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cardImagePath, type CardImagePath } from '@arkham/engine';
import {
  theDevourerBelowCardDefs,
  theGatheringCardDefs,
  theMidnightMasksCardDefs,
} from '@arkham/scenarios';

/** Where ArkhamDB serves the card pictures the app names (`CardStats.imageSrc`). */
const ARKHAMDB = 'https://arkhamdb.com';

/**
 * The local copies of the card pictures the E2E tests show, downloaded before the tests run.
 * Gitignored and never committed: card art is FFG's, and the deployed app always loads it from
 * ArkhamDB on the device. CI keeps the folder in its cache between runs.
 */
const CARD_PICTURE_DIR = join(import.meta.dirname, '..', '.card_pictures');

/** Roland Banks' picture, so the investigator card's art window shows a real crop in the shots. */
export const ROLAND_PICTURE = cardImagePath('/bundles/cards/01001.png');

/** The Gathering's reference card front, as `cards.json` names it for the card pictures theme. */
const GATHERING_REFERENCE_PICTURE = cardImagePath('/bundles/cards/01104.png');

/**
 * Every picture the E2E games name: the cards of the whole Night of the Zealot campaign (The
 * Gathering, The Midnight Masks and The Devourer Below), both sides, The Gathering's reference
 * card's front and Roland Banks'.
 */
function e2ePictures(): CardImagePath[] {
  const zealotCards = [
    ...theGatheringCardDefs,
    ...theMidnightMasksCardDefs,
    ...theDevourerBelowCardDefs,
  ];
  const sides = zealotCards.flatMap(({ imageSrc, backImageSrc }) => [
    ...(imageSrc ? [imageSrc] : []),
    ...(backImageSrc ? [backImageSrc] : []),
  ]);
  return [...new Set([...sides, GATHERING_REFERENCE_PICTURE, ROLAND_PICTURE])];
}

/** The local copy of the picture at `path` (an ArkhamDB path), if it has been downloaded. */
export function localCardPicture(path: string): string | undefined {
  const file = join(CARD_PICTURE_DIR, basename(path));
  return existsSync(file) ? file : undefined;
}

/** How many pictures download at once: ArkhamDB drops connections when all of them start together. */
const PARALLEL_DOWNLOADS = 4;

/** Tries per picture, a second apart, so one dropped connection doesn't leave a card without art. */
const TRIES = 3;

/** Downloads the picture at `path` (an ArkhamDB path) into the local folder. */
async function download(path: CardImagePath): Promise<void> {
  const response = await fetch(`${ARKHAMDB}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // A challenge or error page served with 200 would otherwise stay in CI's cache for good.
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not a picture (${type})`);
  await writeFile(
    join(CARD_PICTURE_DIR, basename(path)),
    Buffer.from(await response.arrayBuffer()),
  );
}

/** Downloads the picture at `path`, trying again after a failure; resolves to the last error. */
async function downloadWithRetries(path: CardImagePath): Promise<string | undefined> {
  let lastError = '';
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      await download(path);
      return undefined;
    } catch (error) {
      lastError =
        error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error);
      if (attempt < TRIES) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return lastError.trim();
}

/**
 * Playwright's global setup: downloads the pictures that have no local copy yet, a few at a time.
 * A picture that still fails (no network, ArkhamDB down) is only warned about, since the app then
 * shows the card's pattern, as it does offline, and no test depends on the art. After the first
 * such failure the rest are skipped: ArkhamDB stops answering a CI runner after a few dozen
 * pictures, and waiting out every timeout cost a run eight minutes. CI keeps what this run got,
 * and a later run fetches the rest.
 */
export default async function fetchCardPictures(): Promise<void> {
  await mkdir(CARD_PICTURE_DIR, { recursive: true });
  const queue = e2ePictures().filter((path) => localCardPicture(path) === undefined);
  const failed: string[] = [];
  const worker = async (): Promise<void> => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      const error = await downloadWithRetries(path);
      if (error === undefined) continue;
      failed.push(`${path} (${error})`);
      failed.push(...queue.splice(0).map((skipped) => `${skipped} (skipped)`));
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
  if (failed.length > 0)
    console.warn(
      `Could not download ${failed.length} card pictures; their cards show the pattern:\n` +
        failed.join('\n'),
    );
}
