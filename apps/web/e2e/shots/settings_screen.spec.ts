import { expect, test } from '../fixtures/test';

// Situations on the settings screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the settings with the unofficial fan project notice', async ({ page }) => {
  await page.goto('/#/settings');

  await expect(page.getByRole('link', { name: /campaign/ })).toContainText('Nothing ticked yet');
  await expect(page.getByRole('region', { name: 'About' })).toContainText('unofficial fan project');
});

test('the settings on the parchment table', async ({ page }) => {
  await page.goto('/#/settings');

  await page.getByRole('radio', { name: 'Parchment' }).check();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test(
  'the settings telling the players only what they do by hand',
  { tag: '@shot' },
  async ({ page }) => {
    await page.goto('/#/settings');

    await page.getByRole('radio', { name: 'Only what you do by hand' }).check();

    await expect(page.getByRole('group', { name: 'What the app tells you' })).toBeVisible();
  },
);

test('the collection, the Core Set ticked', async ({ page }) => {
  await page.goto('/#/settings/collection');

  await page.getByRole('checkbox', { name: 'Core Set', exact: true }).check();

  await expect(page.getByRole('group', { name: 'Night of the Zealot' })).toContainText('Core Set');
});

test('the app bar’s menu open over the settings', async ({ page }) => {
  await page.goto('/#/settings');

  await page.getByRole('button', { name: 'Menu' }).click();

  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
