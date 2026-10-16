import { expect, test as base } from '@playwright/test';
import cards from './cards.json' with { type: 'json' };
import packs from './packs.json' with { type: 'json' };

/** ArkhamDB endpoints the app reads, answered with the invented catalog. */
const catalogFixtures = new Map<string, unknown>([
  ['/api/public/packs/', packs],
  ['/api/public/cards/', cards],
]);

/**
 * `test` with a network guard: the ArkhamDB catalog (on any language host) is answered from the
 * invented fixtures in this folder, and every other non-local request is aborted and recorded, so
 * a test fails instead of silently reaching the network (CI has none) or real card data/images.
 */
export const test = base.extend<{ externalRequests: string[] }>({
  externalRequests: [
    async ({ page, baseURL }, use) => {
      const localOrigin = new URL(baseURL ?? 'http://localhost').origin;
      const unexpected: string[] = [];
      await page.route(
        (url) => url.origin !== localOrigin && url.protocol.startsWith('http'),
        (route) => {
          const url = new URL(route.request().url());
          if (catalogFixtures.has(url.pathname)) {
            return route.fulfill({
              json: catalogFixtures.get(url.pathname),
              headers: { 'Access-Control-Allow-Origin': '*' },
            });
          }
          unexpected.push(url.href);
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
