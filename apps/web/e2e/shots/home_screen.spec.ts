import { expect, test } from '../fixtures/test';
import {
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
} from '../fixtures/saved_campaigns';
import { houseOpenedExport, importGame } from '../fixtures/saved_games';

// Situations on the home screen, each photographed as it ends; corner cases are in
// `e2e/states/` (coding guidelines §3).

test('the welcome page on a first start, with nothing stored', async ({ page }) => {
  await page.goto('/#/');

  await expect(page.getByRole('article')).toContainText('unofficial fan project');
});

test('the game list with one saved game', async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await expect(page.getByRole('list', { name: 'Your games' })).toContainText('The house is open');
});

test('the shelf with a campaign waiting for its second chapter beside a game of one scenario', async ({
  page,
}) => {
  await openStoredCampaign(page, 'Sunday with Kim', (id) =>
    gatheringKilledEvents(id, [rolandBanks, fakeSeeker], fakeSeeker),
  );
  await page.goto('/#/');
  await importGame(page, houseOpenedExport('The house is open'));

  await expect(page.getByRole('link', { name: 'Set up chapter 2' })).toBeVisible();
  // Three pictures loaded: the campaign's box key art over The Midnight Masks' agenda, and The
  // Gathering's agenda on the game's cover.
  await expect(page.locator('#shelf > li > svg > svg[data-picture="shown"]')).toHaveCount(3);
});

test('the question before a saved game is deleted', async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'More for The house is open' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test("the app bar's menu open over the game list", async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await page.getByRole('banner').getByRole('button', { name: 'Menu' }).click();

  await expect(page.getByRole('banner').getByRole('link', { name: 'Settings' })).toBeVisible();
});
