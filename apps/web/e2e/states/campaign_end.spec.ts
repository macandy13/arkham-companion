import { expect, test } from '../fixtures/test';
import {
  fakeGuardian,
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
} from '../fixtures/saved_campaigns';

// Corner cases of a campaign's log once the campaign is over,
// checked by what the page holds, without a picture (coding guidelines §3).
test.use({ endPicture: false });

test('the log of a campaign lost for want of investigators', async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – everyone', (id) =>
    gatheringKilledEvents(id, [fakeSeeker, fakeGuardian, rolandBanks], fakeSeeker),
  );
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();
  await page.getByRole('button', { name: 'End the campaign' }).click();

  const over = page.getByRole('region', { name: 'Campaign over' });
  await expect(over).toContainText('Lost');
  await over.scrollIntoViewIfNeeded();
});
