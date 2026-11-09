import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import cards from './cards.json' with { type: 'json' };
import packs from './packs.json' with { type: 'json' };
import { campaignKeyArts } from '../../src/catalog/campaignKeyArt';
import { localCardPicture } from './card_pictures';

/** ArkhamDB endpoints the app reads, answered with the invented catalog. */
const catalogFixtures = new Map<string, unknown>([
  ['/api/public/packs/', packs],
  ['/api/public/cards/', cards],
]);

/**
 * Where ArkhamDB serves card pictures. The hand-written test scenario names its cards' pictures,
 * so the app asks for them; the guard answers them from the local copies the global setup
 * downloaded (`card_pictures.ts`), and turns down the rest, as when the player is offline, so
 * those card faces keep their pattern. A campaign's key art from FFG (`campaignKeyArt`) is answered
 * from its local copy the same way.
 */
const CARD_PICTURES = /^\/bundles\/cards\//;

/**
 * The option `playwright.config.ts` sets for the projects that photograph each test as it ends
 * for the PR preview (`scripts/screencast/cli.ts` compares the picture with the base's).
 */
export interface PictureOptions {
  readonly endPicture: boolean;
}

/**
 * `test` with a network guard: the ArkhamDB catalog (on any language host) is answered from the
 * invented fixtures in this folder, card pictures from their local copies, and every other non-local request
 * is aborted and recorded, so a test fails instead of silently reaching the network (the tests themselves must not)
 * or real card data. Each page draws a fixed `Math.random` sequence, and in the picture projects
 * the test is photographed once it has settled (`endPicture`).
 */
export const test = base.extend<PictureOptions & { externalRequests: string[]; picture: void }>({
  endPicture: [false, { option: true }],
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
    },
    { auto: true },
  ],
  externalRequests: [
    async ({ context, baseURL }, use) => {
      const localOrigin = new URL(baseURL ?? 'http://localhost').origin;
      const unexpected: string[] = [];
      // On the context rather than the page, so it also sees what the service worker fetches
      // (it serves card pictures cache-first), which a page route never does.
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
          if (campaignKeyArts.includes(url.href)) {
            const keyArt = localCardPicture(url.pathname);
            return keyArt ? route.fulfill({ path: keyArt }) : route.abort();
          }
          if (!CARD_PICTURES.test(url.pathname)) {
            unexpected.push(url.href);
            return route.abort();
          }
          const picture = localCardPicture(url.pathname);
          return picture ? route.fulfill({ path: picture }) : route.abort();
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
 * stopped scrolling. A
 * click scrolls its target into view, and text that changes font afterwards moves the page under
 * it, so the preview's pictures (scripts/screencast/cli.ts) would differ from run to run; going
 * offline before the pictures arrive leaves them out. Not `waitForLoadState('networkidle')`: it
 * fires once per document, and the app changes screens without loading a new one.
 */
export async function waitUntilSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const fetched = () => performance.getEntriesByType('resource').length;
    for (let before = -1; before !== fetched();) {
      before = fetched();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
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
