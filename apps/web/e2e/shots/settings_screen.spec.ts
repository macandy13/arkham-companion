import { expect, test } from '../fixtures/test';

// Situations on the settings screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the settings with the unofficial fan project notice', async ({ page }) => {
  await page.goto('/#/settings');

  await expect(page.getByRole('region', { name: 'About' })).toContainText('unofficial fan project');
});
