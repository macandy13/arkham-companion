import { expect, test } from '../fixtures/test';
import { houseOpenedExport, importGame } from '../fixtures/saved_games';

// Situations on the home screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the game list with one saved game', { tag: '@shot' }, async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await expect(page.getByRole('list', { name: 'Games' })).toContainText('The house is open');
});

test('the question before a saved game is deleted', { tag: '@shot' }, async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test("the app bar's menu open over the game list", { tag: '@shot' }, async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await page.getByRole('banner').getByRole('button', { name: 'Menu' }).click();

  await expect(page.getByRole('banner').getByRole('link', { name: 'Settings' })).toBeVisible();
});
