import type { Page } from '@playwright/test';
import cards from './cards.json' with { type: 'json' };
import packs from './packs.json' with { type: 'json' };

/**
 * Answers the ArkhamDB public API with a tiny fake catalog so E2E never touches the network
 * (and never needs real card data). Both language hosts are covered by the wildcard.
 */
export async function stubArkhamDb(page: Page): Promise<void> {
  const headers = { 'Access-Control-Allow-Origin': '*' };
  await page.route('**/api/public/packs/', (route) => route.fulfill({ json: packs, headers }));
  await page.route('**/api/public/cards/', (route) => route.fulfill({ json: cards, headers }));
}
