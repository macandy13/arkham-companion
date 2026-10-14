import { expect, test as base, type Page } from '@playwright/test';

const fixturePacks = [{ code: 'pack1', name: 'First Pack', position: 1, cycle_position: 1 }];

function fixtureInvestigator(code: string, name: string) {
  return {
    code,
    name,
    type_code: 'investigator',
    faction_code: 'seeker',
    health: 7,
    sanity: 7,
    skill_willpower: 3,
    skill_intellect: 3,
    skill_combat: 3,
    skill_agility: 3,
    pack_code: 'pack1',
  };
}

const fixtureCards = [fixtureInvestigator('a1', 'Alder'), fixtureInvestigator('b1', 'Birch')];

const catalogFixtures = new Map<string, unknown>([
  ['https://arkhamdb.com/api/public/packs/', fixturePacks],
  ['https://arkhamdb.com/api/public/cards/', fixtureCards],
]);

/**
 * `test` with a network guard: the ArkhamDB catalog is answered from fake fixtures and every other
 * non-local request is aborted and recorded, so a test fails instead of silently reaching the
 * network (CI has none). Fixtures are invented data, never real card data.
 */
export const test = base.extend<{ externalRequests: string[] }>({
  externalRequests: [
    async ({ page, baseURL }, use) => {
      const localOrigin = new URL(baseURL ?? 'http://localhost').origin;
      const unexpected: string[] = [];
      await page.route(
        (url) => url.origin !== localOrigin && url.protocol.startsWith('http'),
        (route) => {
          const url = route.request().url();
          if (catalogFixtures.has(url)) {
            return route.fulfill({
              json: catalogFixtures.get(url),
              headers: { 'Access-Control-Allow-Origin': '*' },
            });
          }
          unexpected.push(url);
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

/** Runs the quick-game wizard with Alder and Birch on the sandbox scenario and lands on the game route. */
export async function startQuickGame(page: Page) {
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const name of ['Alder', 'Birch']) {
    await page.getByRole('list', { name: 'Investigators' }).getByRole('button', { name }).click();
    await page.getByRole('button', { name: 'Select' }).click();
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);
}
