import { expect, test } from '../fixtures/test';

// Situations on the settings screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the settings with the unofficial fan project notice', { tag: '@shot' }, async ({ page }) => {
  await page.goto('/#/settings');

  await expect(page.getByRole('region', { name: 'About' })).toContainText('unofficial fan project');
});

test('the settings by day, on parchment', async ({ page }) => {
  await page.goto('/#/settings');

  await page.getByLabel('Theme').selectOption('Light');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
