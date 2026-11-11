import { expect, test } from '../fixtures/test';
import {
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
} from '../fixtures/saved_campaigns';
import { houseOpenedExport, importGame } from '../fixtures/saved_games';

// Corner cases of the home screen,
// checked by what the page holds, without a picture (coding guidelines §3).
test.use({ endPicture: false });

test('the question before a campaign is deleted with its games', async ({ page }) => {
  await openStoredCampaign(page, 'Sunday with Kim', (id) =>
    gatheringKilledEvents(id, [rolandBanks, fakeSeeker], fakeSeeker),
  );
  await page.goto('/#/');

  await page.getByRole('button', { name: 'More for Sunday with Kim' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('alertdialog')).toContainText('the games of its scenarios');
});

test('a game’s menu open on its cover', async ({ page }) => {
  await importGame(page, houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'More for The house is open' }).click();

  // The menu reaches below the cover; the photograph shows it down to Delete.
  const deleteEntry = page.getByRole('button', { name: 'Delete' });
  await deleteEntry.scrollIntoViewIfNeeded();
  await expect(deleteEntry).toBeInViewport();
});
