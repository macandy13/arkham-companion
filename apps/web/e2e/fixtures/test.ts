import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import cards from './cards.json' with { type: 'json' };
import packs from './packs.json' with { type: 'json' };
import { mockCardArt } from './mock_card_art';

/** ArkhamDB endpoints the app reads, answered with the invented catalog. */
const catalogFixtures = new Map<string, unknown>([
  ['/api/public/packs/', packs],
  ['/api/public/cards/', cards],
]);

/**
 * Where ArkhamDB serves card pictures. The guard answers those the E2E games name, and each
 * campaign's key art from FFG, with our own mock artworks (`mock_card_art.ts`), so every run shows
 * the same art without the network; the rest it turns down, as when the player is offline, so
 * those card faces keep their pattern.
 */
const CARD_PICTURES = /^\/bundles\/cards\//;

/**
 * The option `playwright.config.ts` sets for the projects that photograph each test as it ends:
 * for the PR preview (`scripts/screencast/cli.ts` compares the picture with the base's) and, with
 * `GOLDENS=1`, against the test's committed golden in `e2e/__screenshots__/`.
 */
export interface PictureOptions {
  readonly endPicture: boolean;
}

/**
 * How many pixels of a picture may differ from its golden: antialiasing at edges varies by a few
 * pixels between runs on the same runner image (the preview's base comparison allows the same).
 */
const GOLDEN_NOISE = 20;

/**
 * The option a test sets (`test.use({ realPlaymats: true })`) to show the tables' own playmats.
 * Every other test lies on a flat colour of its table: the playmats are large detailed drawings
 * that fill most of each picture's bytes and differ by a few pixels from run to run, while one
 * picture per playmat is enough to cover them.
 */
export interface PlaymatOptions {
  readonly realPlaymats: boolean;
}

/**
 * The flat colour each playmat (by its file name, `src/styles/playmat*.svg`) is replaced with:
 * its table's `--color-background` in `tokens.css`, the colour the playmat lies on.
 */
const FLAT_PLAYMATS: Readonly<Record<string, string>> = {
  playmat: '#0b1614',
  playmat_stars: '#0a0820',
  playmat_rlyeh: '#031416',
  playmat_parchment: '#e8dcbf',
};

/** A built playmat's address: Vite adds a content hash to the file name. */
const PLAYMAT = /\/assets\/(playmat(?:_[a-z]+)?)-[\w-]+\.svg$/;

/**
 * `test` with a network guard: the ArkhamDB catalog (on any language host) is answered from the
 * invented fixtures in this folder, card pictures with mock artworks, and every other non-local request
 * is aborted and recorded, so a test fails instead of silently reaching the network (the tests themselves must not)
 * or real card data. Each page draws a fixed `Math.random` sequence, and in the picture projects
 * the test is photographed once it has settled (`endPicture`).
 */
export const test = base.extend<
  PictureOptions & PlaymatOptions & { externalRequests: string[]; picture: void; playmats: void }
>({
  endPicture: [false, { option: true }],
  realPlaymats: [false, { option: true }],
  playmats: [
    async ({ context, realPlaymats }, use) => {
      if (!realPlaymats)
        await context.route(PLAYMAT, (route) => {
          const file = PLAYMAT.exec(new URL(route.request().url()).pathname)?.[1] ?? 'playmat';
          const colour = FLAT_PLAYMATS[file] ?? FLAT_PLAYMATS.playmat;
          return route.fulfill({
            contentType: 'image/svg+xml',
            body: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='${colour}'/></svg>`,
          });
        });
      await use();
    },
    { auto: true },
  ],
  // Instead of Playwright's `screenshot: 'on'`, which photographs a screen that may still be
  // loading or moving, so the same code would give different pictures from run to run.
  picture: [
    async ({ page, endPicture }, use, testInfo) => {
      // The app draws a skill test's token and seeds a new game with Math.random; a fixed
      // sequence gives the same draw, and so the same picture or recording, on every run.
      // `waitUntilSettled` counts the resources the page fetched, past the default 250.
      await page.addInitScript(() => {
        performance.setResourceTimingBufferSize(100_000);
        let state = 1;
        Math.random = () => {
          state = (state * 16807) % 2147483647;
          return (state - 1) / 2147483646;
        };
      });
      await use();
      if (!endPicture || testInfo.status !== 'passed') return;
      await waitUntilSettled(page);
      const path = testInfo.outputPath('end.png');
      await page.screenshot({ path, animations: 'disabled' });
      await testInfo.attach('screenshot', { path, contentType: 'image/png' });
      // The settled picture itself, not `toHaveScreenshot`, which would photograph the screen
      // twice more to see it stand still. Off by default because goldens are made on CI's runner
      // image (update-screenshots.yml): another machine renders text a few pixels differently.
      if (process.env.GOLDENS === '1')
        expect(await readFile(path)).toMatchSnapshot('end.png', { maxDiffPixels: GOLDEN_NOISE });
    },
    { auto: true },
  ],
  externalRequests: [
    async ({ context, baseURL }, use) => {
      const localOrigin = new URL(baseURL ?? 'http://localhost').origin;
      const unexpected: string[] = [];
      // On the context rather than the page, so it covers every page a test opens.
      await context.route(
        (url) => url.origin !== localOrigin && url.protocol.startsWith('http'),
        (route) => {
          const url = new URL(route.request().url());
          if (catalogFixtures.has(url.pathname)) {
            return route.fulfill({
              json: catalogFixtures.get(url.pathname),
              headers: { 'Access-Control-Allow-Origin': '*' },
            });
          }
          const art = mockCardArt(CARD_PICTURES.test(url.pathname) ? url.pathname : url.href);
          if (art) return route.fulfill({ path: art, contentType: 'image/svg+xml' });
          if (!CARD_PICTURES.test(url.pathname)) unexpected.push(url.href);
          return route.abort();
        },
      );
      await use(unexpected);
      expect(unexpected, 'unexpected external requests').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * ArkhamDB's card list, for a test that holds or turns down its answer to show the card data on
 * its way or not loaded; a route the test adds wins over the guard's.
 */
export const isCardList = (url: URL) => url.pathname === '/api/public/cards/';

/**
 * Waits until the page has fetched what it shows (card pictures, the fonts its text uses) and
 * stopped scrolling. A click scrolls its target into view, and text that changes font afterwards
 * moves the page under it, so the preview's pictures (scripts/screencast/cli.ts) would differ
 * from run to run; going offline before the pictures arrive leaves them out. Not
 * `waitForLoadState('networkidle')`: it fires once per document, and the app changes screens
 * without loading a new one.
 */
export async function waitUntilSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const fetched = () => performance.getEntriesByType('resource').length;
    for (let before = -1; before !== fetched();) {
      before = fetched();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    // Card art is an SVG <image>, which `document.images` leaves out and which can paint a frame
    // after it loads; on a busy runner a tile was photographed without it. Decoding the same
    // address puts it in the image cache, and two frames let the SVG paint it.
    await Promise.all(
      [...document.querySelectorAll('image')].map((image) => {
        const picture = new Image();
        picture.src = new URL(image.href.baseVal, document.baseURI).href;
        return picture.decode().catch(() => undefined);
      }),
    );
    // A face shows its art only once a probe of the loaded picture reports its shape, a state
    // change that can come well after the load on a busy runner; so the page must also have
    // stopped changing for a moment (at most a few seconds, as a failed picture never shows).
    await new Promise<void>((resolve) => {
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        observer.disconnect();
        clearTimeout(quiet);
        clearTimeout(limit);
        resolve();
      };
      const observer = new MutationObserver(() => {
        clearTimeout(quiet);
        quiet = setTimeout(done, 300);
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      quiet = setTimeout(done, 300);
      const limit = setTimeout(done, 5000);
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await document.fonts.ready;
    // A screen that scrolls an element into view after a layout change can still be on its way.
    const scrolled = () =>
      [document.scrollingElement, ...document.querySelectorAll('*')]
        .map((element) => (element ? `${element.scrollTop},${element.scrollLeft}` : ''))
        .join(';');
    for (let before = ''; before !== scrolled();) {
      before = scrolled();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  });
}
