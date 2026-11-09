import { expect, test } from '../fixtures/test';

// The loading screen and the inline spinner (coding guidelines §3).

/** ArkhamDB's card list; while its answer is held, the card data stays on its way. */
const isCardList = (url: URL) => url.pathname === '/api/public/cards/';

test('the loading screen with the games loaded and the card data on its way', async ({ page }) => {
  await page.route(isCardList, () => undefined);

  await page.goto('/#/');

  await expect(page.getByRole('progressbar', { name: 'Starting the app' })).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
  await expect(page.getByRole('list', { name: 'Start-up steps' })).toContainText('Card data');
});

test('the spinner on paper while the wizard refreshes the investigators', async ({ page }) => {
  // The first start downloads the card data; after that the wizard refreshes it from ArkhamDB.
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Arkham Companion' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.route(isCardList, () => undefined);

  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Loading investigators…')).toBeVisible();
});
