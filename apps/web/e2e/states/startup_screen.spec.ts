import { expect, isCardList, test } from '../fixtures/test';

// Corner cases of the loading screen and the inline spinner,
// checked by what the page holds, without a picture (coding guidelines §3).
test.use({ endPicture: false });

test('the spinner on paper while the wizard refreshes the investigators', async ({ page }) => {
  // The first start downloads the card data; the next start reads it from the cache, and the
  // wizard refreshes it from ArkhamDB once in that run.
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Arkham Companion' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.route(isCardList, () => undefined);

  await page.goto('/#/new');
  await page.reload();
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Loading investigators…')).toBeVisible();
});
