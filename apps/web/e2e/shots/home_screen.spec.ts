import { expect, test } from '../fixtures/test';
import {
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
} from '../fixtures/saved_campaigns';
import { houseOpenedExport, importGame } from '../fixtures/saved_games';

// Situations on the home screen, each photographed as it ends (`@shot`, coding guidelines §3).

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

test('the question before a campaign is deleted with its games', async ({ page }) => {
  await openStoredCampaign(page, 'Sunday with Kim', (id) =>
    gatheringKilledEvents(id, [rolandBanks, fakeSeeker], fakeSeeker),
  );
  await page.goto('/#/');

  await page.getByRole('button', { name: 'More for Sunday with Kim' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('alertdialog')).toContainText('the games of its scenarios');
});

test('a game’s menu open on its cover', { tag: '@shot' }, async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'More for The house is open' }).click();

  // The menu reaches below the cover; the photograph shows it down to Delete.
  const deleteEntry = page.getByRole('button', { name: 'Delete' });
  await deleteEntry.scrollIntoViewIfNeeded();
  await expect(deleteEntry).toBeInViewport();
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
