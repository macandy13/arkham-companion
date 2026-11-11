import { expect, test } from '../fixtures/test';

// Situations on the settings screen, each photographed as it ends; corner cases are in
// `e2e/states/` (coding guidelines §3).

test('the settings with the unofficial fan project notice', async ({ page }) => {
  await page.goto('/#/settings');

  await expect(page.getByRole('link', { name: /campaign/ })).toContainText('Nothing ticked yet');
  await expect(page.getByRole('region', { name: 'About' })).toContainText('unofficial fan project');
});

test('the collection, the Core Set ticked', async ({ page }) => {
  await page.goto('/#/settings/collection');

  await page.getByRole('checkbox', { name: 'Core Set', exact: true }).check();

  await expect(page.getByRole('group', { name: 'Night of the Zealot' })).toContainText('Core Set');
});
