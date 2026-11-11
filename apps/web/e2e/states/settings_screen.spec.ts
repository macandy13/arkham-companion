import { expect, test } from '../fixtures/test';

// Corner cases of the settings screen,
// checked by what the page holds, without a picture (coding guidelines §3).
test.use({ endPicture: false });

test('the settings on the parchment table', async ({ page }) => {
  await page.goto('/#/settings');

  await page.getByRole('radio', { name: 'Parchment' }).check();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the settings telling the players only what they do by hand', async ({ page }) => {
  await page.goto('/#/settings');

  await page.getByRole('radio', { name: 'Only what you do by hand' }).check();

  await expect(page.getByRole('group', { name: 'What the app tells you' })).toBeVisible();
});

test('the app bar’s menu open over the settings', async ({ page }) => {
  await page.goto('/#/settings');

  await page.getByRole('button', { name: 'Menu' }).click();

  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
